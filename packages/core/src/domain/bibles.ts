// Repositório de Bíblias baixáveis: formato do catálogo (bibles-manifest.json na raiz do repositório), validação
// e recomendação por idioma. Puro: a rede, o download e os arquivos ficam em app/src/data/bibles.
// Contrato: docs/design/idiomas-biblias-fontes.md §2. Bíblias já registradas (BLivre, KJV) vêm de SOURCES.
import { SOURCES, langBase, sourceShort, type SourceTestament } from './sources';

/** Esquema do pacote SQLite de cada Bíblia (meta.schema_version). Sobe junto com o pipeline se o layout mudar. */
export const BIBLE_SCHEMA_VERSION = 1;

/** Esquema do próprio catálogo (campo schema_version de bibles-manifest.json). */
export const BIBLE_CATALOG_SCHEMA_VERSION = 1;

export interface BiblePackage {
  /** ZIP com uma única entrada: o banco SQLite da Bíblia (bible-<id>.db). */
  url: string;
  /** SHA-256 do ZIP. */
  sha256: string;
  /** Tamanho do ZIP em bytes. */
  size: number;
  /** Tamanho do banco descompactado, em bytes. */
  uncompressed_size: number;
}

export interface BibleEntry {
  /** Id estável: é o source_id do texto no banco e parte do nome do arquivo (minúsculas, números e hífen). */
  id: string;
  /** Sigla da barra superior e dos seletores ("RVR1909"). */
  abbr: string;
  name: string;
  /** Idioma (BCP-47: "pt", "es", "zh-Hans"). */
  lang: string;
  license: string;
  license_url: string | null;
  attribution: string;
  url: string;
  version: string;
  testaments: SourceTestament[];
  /** Ordem de recomendação dentro do idioma (1 = recomendada). */
  rank: number;
  /** true = já está no banco principal (BLivre, KJV): sem pacote, não removível. */
  bundled?: boolean;
  package?: BiblePackage;
}

export interface BibleCatalog {
  catalog_version: string;
  schema_version: number;
  bibles: BibleEntry[];
}

export class BibleCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BibleCatalogError';
  }
}

const ID_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
const LANG_RE = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;
const HTTP_URL_RE = /^https?:\/\//;
const TESTAMENTS: readonly string[] = ['OT', 'NT'];

type Raw = Record<string, unknown>;

function asRecord(v: unknown, where: string): Raw {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new BibleCatalogError(`${where} não é um objeto`);
  return v as Raw;
}

function text(o: Raw, key: string, where: string): string {
  const v = o[key];
  if (typeof v !== 'string' || v.trim() === '') throw new BibleCatalogError(`${where}.${key} ausente ou vazio`);
  return v.trim();
}

function httpUrl(o: Raw, key: string, where: string): string {
  const v = text(o, key, where);
  if (!HTTP_URL_RE.test(v)) throw new BibleCatalogError(`${where}.${key} não é uma URL http(s)`);
  return v;
}

function positiveInt(o: Raw, key: string, where: string): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v <= 0) {
    throw new BibleCatalogError(`${where}.${key} deve ser um inteiro positivo`);
  }
  return v;
}

function parsePackage(raw: unknown, where: string): BiblePackage {
  const o = asRecord(raw, where);
  const sha256 = text(o, 'sha256', where);
  if (!SHA256_RE.test(sha256)) throw new BibleCatalogError(`${where}.sha256 inválido (esperado SHA-256 em hexadecimal)`);
  return {
    url: httpUrl(o, 'url', where),
    sha256: sha256.toLowerCase(),
    size: positiveInt(o, 'size', where),
    uncompressed_size: positiveInt(o, 'uncompressed_size', where),
  };
}

function parseEntry(raw: unknown, where: string): BibleEntry {
  const o = asRecord(raw, where);
  const id = text(o, 'id', where);
  if (!ID_RE.test(id)) throw new BibleCatalogError(`${where}.id "${id}" inválido (use minúsculas, números e hífen, de 2 a 40 caracteres)`);
  const at = `${where} (${id})`;
  const lang = text(o, 'lang', at);
  if (!LANG_RE.test(lang)) throw new BibleCatalogError(`${at}.lang "${lang}" não é um código de idioma BCP-47`);
  const testaments = o.testaments;
  if (!Array.isArray(testaments) || testaments.length === 0) throw new BibleCatalogError(`${at}.testaments ausente ou vazio`);
  for (const t of testaments) {
    if (typeof t !== 'string' || !TESTAMENTS.includes(t)) throw new BibleCatalogError(`${at}.testaments aceita só OT ou NT`);
  }
  const licenseUrl = o.license_url ?? null;
  if (licenseUrl !== null && typeof licenseUrl !== 'string') throw new BibleCatalogError(`${at}.license_url deve ser texto ou null`);
  if (o.bundled !== undefined && typeof o.bundled !== 'boolean') throw new BibleCatalogError(`${at}.bundled deve ser true ou false`);
  const bundled = o.bundled === true;
  const entry: BibleEntry = {
    id,
    abbr: text(o, 'abbr', at),
    name: text(o, 'name', at),
    lang,
    license: text(o, 'license', at),
    license_url: licenseUrl,
    attribution: text(o, 'attribution', at),
    url: httpUrl(o, 'url', at),
    version: text(o, 'version', at),
    testaments: [...new Set(testaments as SourceTestament[])],
    rank: positiveInt(o, 'rank', at),
  };
  if (bundled) entry.bundled = true;
  if (o.package !== undefined) entry.package = parsePackage(o.package, `${at}.package`);
  else if (!bundled) throw new BibleCatalogError(`${at}.package ausente (Bíblia que não é bundled precisa de pacote)`);
  return entry;
}

/** Valida o JSON do catálogo. Lança BibleCatalogError com a primeira causa encontrada; não aceita campos ausentes. */
export function parseBibleCatalog(input: unknown): BibleCatalog {
  const o = asRecord(input, 'catálogo');
  const catalogVersion = text(o, 'catalog_version', 'catálogo');
  const schema = positiveInt(o, 'schema_version', 'catálogo');
  if (schema !== BIBLE_CATALOG_SCHEMA_VERSION) {
    throw new BibleCatalogError(`catálogo com esquema ${schema}; este app lê o ${BIBLE_CATALOG_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(o.bibles)) throw new BibleCatalogError('catálogo.bibles deve ser uma lista');
  const bibles = o.bibles.map((raw, i) => parseEntry(raw, `bibles[${i}]`));
  const seen = new Set<string>();
  for (const b of bibles) {
    if (seen.has(b.id)) throw new BibleCatalogError(`id de Bíblia repetido: ${b.id}`);
    seen.add(b.id);
  }
  return { catalog_version: catalogVersion, schema_version: schema, bibles };
}

/** Bíblia do catálogo pelo id, ou null. */
export function findBible(catalog: BibleCatalog | null | undefined, id: string): BibleEntry | null {
  return catalog?.bibles.find((b) => b.id === id) ?? null;
}

/** Um grupo de Bíblias de um idioma (código base, ex.: "es"). */
export interface BibleLangGroup {
  lang: string;
  bibles: BibleEntry[];
}

export interface BibleRecommendation {
  /** Bíblias do idioma pedido, da recomendada (rank 1) para as demais. */
  recommended: BibleEntry[];
  /** As demais, agrupadas por idioma, na ordem em que o catálogo as traz. */
  others: BibleLangGroup[];
}

const byRank = (a: BibleEntry, b: BibleEntry): number => a.rank - b.rank || a.id.localeCompare(b.id);

/**
 * Bíblias do idioma do app primeiro (por rank); as demais agrupadas por idioma. A comparação é pelo código base
 * (langBase): "zh-Hans" e "zh-Hant" são do mesmo idioma, e a recomendada continua sendo a de rank 1.
 */
export function recommendBibles(catalog: BibleCatalog, lang: string): BibleRecommendation {
  const want = langBase(lang);
  const recommended: BibleEntry[] = [];
  const groups = new Map<string, BibleEntry[]>();
  for (const b of catalog.bibles) {
    const base = langBase(b.lang) ?? b.lang;
    if (base === want) {
      recommended.push(b);
      continue;
    }
    const list = groups.get(base);
    if (list) list.push(b);
    else groups.set(base, [b]);
  }
  const others = [...groups].map(([code, bibles]) => ({ lang: code, bibles: bibles.sort(byRank) }));
  return { recommended: recommended.sort(byRank), others };
}

/**
 * Sigla de uma Bíblia: a do registro de fontes (BLivre, KJV), depois a do catálogo, depois o próprio id.
 * O registro vence para as Bíblias do banco principal, que valem sem o catálogo.
 */
export function bibleAbbr(id: string, catalog: BibleCatalog | null): string {
  const registered = Object.hasOwn(SOURCES, id) ? SOURCES[id]?.abbr : undefined;
  if (registered) return registered;
  return findBible(catalog, id)?.abbr ?? id;
}

/**
 * Rótulo curto de uma Bíblia dentro de uma citação ("Bíblia Livre Fp 2:5", "RVR1909 Fp 2:5"). A do banco principal
 * usa o nome curto do registro; a baixada não tem linha na tabela de fontes e usa a sigla do catálogo.
 */
export function bibleCiteShort(id: string, catalog: BibleCatalog | null): string {
  return Object.hasOwn(SOURCES, id) ? sourceShort(id) : bibleAbbr(id, catalog);
}

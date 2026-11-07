// Regras puras das Bíblias baixadas: nomes de arquivo, ordem da lista, texto padrão válido, conferência do banco
// instalado e a linha de cada Bíblia. Sem rede, sem arquivos e sem React (testes em bible-model.test.ts).
import {
  BIBLE_SCHEMA_VERSION,
  bibleAbbr,
  DEFAULT_TEXT_SOURCE,
  findBible,
  appLangInfo,
  isAppLang,
  langBase,
  recommendBibles,
  sourceLangOf,
  sourceLong,
  type BibleCatalog,
  type BibleEntry,
} from '@sensus/core';

const FILE_RE = /^bible-([a-z0-9][a-z0-9-]{1,39})\.db$/;

/** Nome do banco de uma Bíblia baixada, dentro da pasta do SQLite. */
export function bibleFileName(id: string): string {
  return `bible-${id}.db`;
}

/** Nome provisório enquanto o banco extraído é conferido (não entra na lista de instaladas). */
export function bibleStagedFileName(id: string): string {
  return `bible-${id}.db.new`;
}

/** Id da Bíblia a partir do nome do arquivo; null se não for banco de Bíblia (sidecars e provisórios não são). */
export function bibleIdOfFile(name: string): string | null {
  return FILE_RE.exec(name)?.[1] ?? null;
}

/**
 * Ids instalados: as Bíblias baixadas, pelos nomes de arquivo (nenhuma vem com o app). Seguem a ordem do catálogo;
 * quem não está no catálogo vai por último, em ordem de id.
 */
export function installedBibleIds(fileNames: readonly string[], catalog: BibleCatalog | null): string[] {
  const downloaded = new Set<string>();
  for (const name of fileNames) {
    const id = bibleIdOfFile(name);
    if (id) downloaded.add(id);
  }
  const position = (id: string): number => {
    const i = catalog?.bibles.findIndex((b) => b.id === id) ?? -1;
    return i < 0 ? Number.POSITIVE_INFINITY : i;
  };
  const sorted = [...downloaded].sort((a, b) => {
    const pa = position(a);
    const pb = position(b);
    return pa === pb ? a.localeCompare(b) : pa - pb;
  });
  return sorted;
}

/**
 * Bíblia principal válida (o texto do leitor). A escolhida, se ainda estiver instalada; senão a recomendada instalada
 * do idioma (rank mais baixo entre as instaladas); senão a primeira instalada (a primeira baixada vira a principal);
 * sem nenhuma instalada, BLivre, que só os dados completos trazem. Puro: quem chama decide quando aplicar.
 */
export function resolveTextSource(input: {
  stored: string | null;
  installed: readonly string[];
  catalog: BibleCatalog | null;
  lang: string;
}): string {
  const { stored, installed, catalog, lang } = input;
  if (stored !== null && installed.includes(stored)) return stored;
  if (catalog) {
    const pick = recommendBibles(catalog, lang).recommended.find((b) => installed.includes(b.id));
    if (pick) return pick.id;
  }
  return installed[0] ?? DEFAULT_TEXT_SOURCE;
}

/** Pode remover? Nunca a única instalada: sem Bíblia, o leitor fica sem texto. */
export function canRemoveBible(id: string, installed: readonly string[]): boolean {
  return installed.includes(id) && installed.length > 1;
}

/**
 * Compara versões ("2026.11.06", "2026.9.1"): número a número, pelo valor (9 < 11); outros trechos, em ordem de texto.
 * Negativo se `a` é mais antiga, positivo se é mais nova, zero se são iguais. Sem trecho sobrando, a mais curta é a antiga.
 */
export function compareBibleVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/);
  const pb = b.split(/[.-]/);
  for (let i = 0; ; i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === undefined && y === undefined) return 0;
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    if (/^\d+$/.test(x) && /^\d+$/.test(y)) return Number(x) - Number(y);
    return x < y ? -1 : 1;
  }
}

/**
 * Há versão nova para atualizar? Só para Bíblia do catálogo com pacote (baixável), instalada com versão conhecida, e
 * quando o catálogo traz versão mais nova que a instalada (meta.version do banco).
 */
export function bibleHasUpdate(entry: BibleEntry | null | undefined, installedVersion: string | null | undefined): boolean {
  if (!entry?.package || !installedVersion) return false;
  return compareBibleVersions(entry.version, installedVersion) > 0;
}

export type BibleMetaCheck = 'ok' | 'corrupt' | 'schema' | 'mismatch';

/**
 * Confere a meta de um banco de Bíblia extraído: sem meta é corrompido; esquema diferente do que o app lê; id ou
 * versão diferentes do que o catálogo anunciou.
 */
export function checkBibleMeta(meta: Readonly<Record<string, string>>, expected: { id: string; version: string }): BibleMetaCheck {
  if (Object.keys(meta).length === 0) return 'corrupt';
  if (meta.schema_version !== String(BIBLE_SCHEMA_VERSION)) return 'schema';
  if (meta.bible_id !== expected.id || meta.version !== expected.version) return 'mismatch';
  return 'ok';
}

/**
 * Nome do idioma para a tela, escrito nele mesmo ("Español", "中文（简体）"), como nos seletores de idioma. Idioma fora
 * dos 14 do app aparece pelo código em maiúsculas.
 */
export function langName(lang: string): string {
  const base = langBase(lang) ?? lang;
  return isAppLang(base) ? appLangInfo(base).endonym : base.toUpperCase();
}

/** O que a linha de uma Bíblia precisa, vinda do catálogo ou (instalada fora dele) do registro de fontes. */
export interface BibleRowInfo {
  id: string;
  abbr: string;
  name: string;
  /** Idioma (BCP-47); vazio se não houver. */
  lang: string;
  license: string | null;
  sizeBytes: number | null;
  /** Tem pacote no catálogo (pode ser baixada). */
  downloadable: boolean;
}

export function bibleRowInfo(id: string, catalog: BibleCatalog | null): BibleRowInfo {
  const entry = findBible(catalog, id);
  if (entry) {
    return {
      id,
      abbr: entry.abbr,
      name: entry.name,
      lang: entry.lang,
      license: entry.license,
      sizeBytes: entry.package?.size ?? null,
      downloadable: entry.package !== undefined,
    };
  }
  return {
    id,
    abbr: bibleAbbr(id, null),
    name: sourceLong(id),
    lang: sourceLangOf(id) ?? '',
    license: null,
    sizeBytes: null,
    downloadable: false,
  };
}

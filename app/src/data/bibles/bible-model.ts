// Regras puras das Bíblias baixadas: nomes de arquivo, ordem da lista, texto padrão válido, conferência do banco
// instalado e a linha de cada Bíblia. Sem rede, sem arquivos e sem React (testes em bible-model.test.ts).
import {
  BIBLE_SCHEMA_VERSION,
  bibleAbbr,
  DEFAULT_TEXT_SOURCE,
  findBible,
  langBase,
  recommendBibles,
  sourceLangOf,
  sourceLong,
  textSources,
  type BibleCatalog,
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
 * Ids instalados: as do banco principal (sempre, na ordem dada) e as baixadas, pelos nomes de arquivo. As baixadas
 * seguem a ordem do catálogo; quem não está no catálogo vai por último, em ordem de id.
 */
export function installedBibleIds(fileNames: readonly string[], bundled: readonly string[], catalog: BibleCatalog | null): string[] {
  const downloaded = new Set<string>();
  for (const name of fileNames) {
    const id = bibleIdOfFile(name);
    if (id && !bundled.includes(id)) downloaded.add(id);
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
  return [...bundled, ...sorted];
}

/**
 * Texto padrão válido. A escolhida, se ainda estiver instalada; senão a recomendada instalada do idioma (rank
 * mais baixo entre as instaladas); senão BLivre. Puro: quem chama decide quando aplicar.
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
  return DEFAULT_TEXT_SOURCE;
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

/** Nomes dos idiomas que aparecem como títulos de grupo (código base; os demais viram o próprio código). */
const LANG_NAMES: Readonly<Record<string, string>> = {
  pt: 'Português',
  en: 'Inglês',
  es: 'Espanhol',
  fr: 'Francês',
  de: 'Alemão',
  it: 'Italiano',
  ru: 'Russo',
  zh: 'Chinês',
  ja: 'Japonês',
  ko: 'Coreano',
  hi: 'Hindi',
  bn: 'Bengali',
  ur: 'Urdu',
  ar: 'Árabe',
  id: 'Indonésio',
  vi: 'Vietnamita',
  tr: 'Turco',
  sw: 'Suaíli',
  fa: 'Persa',
  he: 'Hebraico',
  el: 'Grego',
  grc: 'Grego antigo',
  hbo: 'Hebraico antigo',
};

/** Nome do idioma para a tela ("Espanhol"); códigos fora da lista aparecem em maiúsculas. */
export function langName(lang: string): string {
  const base = langBase(lang) ?? lang;
  return LANG_NAMES[base] ?? base.toUpperCase();
}

/** O que a linha de uma Bíblia precisa, vinda do catálogo ou (para as do banco principal) do registro de fontes. */
export interface BibleRowInfo {
  id: string;
  abbr: string;
  name: string;
  /** Idioma (BCP-47); vazio se não houver. */
  lang: string;
  license: string | null;
  sizeBytes: number | null;
  /** Vem com o app: não pode ser removida. */
  bundled: boolean;
  /** Tem pacote no catálogo (pode ser baixada). */
  downloadable: boolean;
}

export function bibleRowInfo(id: string, catalog: BibleCatalog | null): BibleRowInfo {
  const entry = findBible(catalog, id);
  const bundled = textSources().includes(id) || entry?.bundled === true;
  if (entry) {
    return {
      id,
      abbr: entry.abbr,
      name: entry.name,
      lang: entry.lang,
      license: entry.license,
      sizeBytes: entry.package?.size ?? null,
      bundled,
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
    bundled,
    downloadable: false,
  };
}

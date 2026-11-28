// Busca por palavra na Bíblia: regras puras da consulta, do destaque e do índice (sem banco).
// O índice é FTS5 com o tokenizador unicode61 remove_diacritics 2 (ver search-sql.ts). As funções daqui reproduzem
// a mesma ideia de palavra (letras e números, sem acento, em minúsculas): servem ao destaque do termo, à busca sem
// índice (aparelho sem FTS5) e para montar a expressão MATCH sem deixar passar operadores do FTS.

/** Formato do índice: muda quando o esquema ou o tokenizador mudam (o índice é refeito). */
export const SEARCH_INDEX_FORMAT = 1;

/** Termos demais tornam a busca lenta e o destaque confuso: os excedentes são ignorados. */
export const MAX_SEARCH_TERMS = 6;

/** Linhas por lote na montagem do índice (cada lote atualiza o progresso). */
export const INDEX_CHUNK_ROWS = 2000;

const WORD_RE = /[\p{L}\p{N}]+/gu;

/** Um caractere sem acento e em minúsculas ("Ç" → "c"), com o mesmo comprimento (as posições batem com o original). */
function foldChar(ch: string): string {
  const base = ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (base.length === ch.length) return base;
  const lower = ch.toLowerCase();
  return lower.length === ch.length ? lower : ch;
}

/** Texto sem acentos e em minúsculas, caractere a caractere (as posições batem com o original). */
export function foldText(text: string): string {
  let out = '';
  for (const ch of text) out += foldChar(ch);
  return out;
}

/** Termos de busca: as palavras do texto digitado, sem acento e em minúsculas, sem repetição (até MAX_SEARCH_TERMS). */
export function searchTerms(input: string): string[] {
  const words = foldText(input.normalize('NFC')).match(WORD_RE) ?? [];
  return [...new Set(words)].slice(0, MAX_SEARCH_TERMS);
}

/**
 * Expressão MATCH do FTS5: cada termo entre aspas (aspas internas dobradas), todos obrigatórios. Com `prefix`, cada
 * termo vale também como começo de palavra ("graca"*). Operadores digitados (OR, NEAR, *, ^, :, parênteses) viram texto.
 */
export function ftsMatch(terms: readonly string[], prefix: boolean): string {
  return terms.map((t) => `"${t.replace(/"/g, '""')}"${prefix ? '*' : ''}`).join(' ');
}

/** Intervalos [início, fim) das palavras do texto que casam com algum termo (inteira, ou começo com `prefix`). */
export function matchRanges(text: string, terms: readonly string[], prefix: boolean): Array<[number, number]> {
  if (terms.length === 0) return [];
  const folded = foldText(text);
  const out: Array<[number, number]> = [];
  for (const m of folded.matchAll(WORD_RE)) {
    const w = m[0];
    if (terms.some((t) => (prefix ? w.startsWith(t) : w === t))) out.push([m.index, m.index + w.length]);
  }
  return out;
}

/** O versículo tem todos os termos (busca sem índice; a mesma regra do MATCH). */
export function textMatches(text: string, terms: readonly string[], prefix: boolean): boolean {
  if (terms.length === 0) return false;
  const words = foldText(text).match(WORD_RE) ?? [];
  return terms.every((t) => words.some((w) => (prefix ? w.startsWith(t) : w === t)));
}

/** Marca gravada no banco da Bíblia quando o índice termina: formato + versão do pacote. */
export function indexStamp(version: string): string {
  return `${SEARCH_INDEX_FORMAT}:${version}`;
}

/** O índice gravado vale para esta versão do pacote? */
export function indexIsCurrent(stored: string | null, version: string): boolean {
  return stored === indexStamp(version);
}

/** Lotes de rowid [de, até] para montar o índice de 1 a `maxRowid`. */
export function indexChunks(maxRowid: number, size = INDEX_CHUNK_ROWS): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let from = 1; from <= maxRowid; from += size) out.push([from, Math.min(maxRowid, from + size - 1)]);
  return out;
}

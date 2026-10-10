// Relevância determinística para o contexto histórico-cultural (dicionários, índices temáticos, entidades).
import type { Book, Token, VerseRange } from './types';
import type { DictionaryHit, EntityHit } from './repo';
import { isContentToken } from './morph';

/** Verbete cujo intervalo de referências é mais largo que isto (em vids) é descartado, salvo casamento. */
export const WIDE_REF_MIN = 12;
/** Ou mais largo que este múltiplo da amplitude do trecho. */
export const WIDE_REF_FACTOR = 4;
/** Entidades com pelo menos tantos versículos são "genéricas" (ex.: Deus, Jesus). */
export const GENERIC_ENTITY_REFS = 20;

/** Cabeçalhos de verbete que são palavras comuns (ex.: ISBE "AS"), não assuntos. */
const STOP_HEADWORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'and', 'as', 'at', 'be', 'by', 'for', 'from', 'if', 'in', 'is', 'it', 'no', 'not', 'of',
  'on', 'or', 'so', 'that', 'the', 'this', 'to', 'was', 'were', 'what', 'which', 'who', 'with',
]);

/** Minúsculas, sem acentos, só letras, dígitos e espaços. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Primeiro segmento do cabeçalho, antes da vírgula: "CHRIST, OFFICES OF" -> "christ". */
export function headFirst(headword: string): string {
  return normalizeText(headword.split(',')[0] ?? headword);
}

export function isStopHeadword(headword: string): boolean {
  const first = headFirst(headword);
  return first.length <= 2 || STOP_HEADWORDS.has(first);
}

export interface RelevanceContext {
  range: VerseRange;
  /** Nomes normalizados do livro (inglês e português). */
  bookNames: string[];
  /** Nomes normalizados das entidades do trecho, inteiros e por palavra. */
  entityNames: Set<string>;
  /** Glosas (inglês) das palavras de conteúdo do trecho, normalizadas. */
  glosses: Set<string>;
}

export function buildRelevanceContext(
  range: VerseRange,
  book: Pick<Book, 'name_en' | 'name_pt'> | undefined,
  entityNames: readonly string[],
  tokens: readonly Token[],
): RelevanceContext {
  const names = new Set<string>();
  for (const name of entityNames) {
    const full = normalizeText(name);
    if (full) names.add(full);
    for (const word of full.split(' ')) if (word.length >= 4) names.add(word);
  }
  const glosses = new Set<string>();
  for (const t of tokens) {
    if (!t.gloss_en || !isContentToken(t)) continue;
    const g = normalizeText(t.gloss_en);
    if (g) glosses.add(g);
  }
  return {
    range,
    bookNames: book ? [normalizeText(book.name_en), normalizeText(book.name_pt)].filter(Boolean) : [],
    entityNames: names,
    glosses,
  };
}

/** O cabeçalho casa com o trecho: nome do livro, entidade ou glosa de palavra de conteúdo. */
export function matchesPassage(headword: string, ctx: RelevanceContext): boolean {
  const first = headFirst(headword);
  if (!first) return false;
  return ctx.bookNames.includes(first) || ctx.entityNames.has(first) || ctx.glosses.has(first);
}

/**
 * Ordena verbetes por relevância e descarta os improváveis:
 * - palavras comuns como cabeçalho (ex.: "AS");
 * - referências muito mais largas que o trecho (ex.: um capítulo inteiro), salvo casamento;
 * Pontuação: especificidade (1 / total de referências) + 1 se o cabeçalho casa com o trecho.
 */
export function rankDictionary(entries: readonly DictionaryHit[], ctx: RelevanceContext, limit: number): DictionaryHit[] {
  const passageSpan = ctx.range.end - ctx.range.start;
  const wideLimit = Math.max(WIDE_REF_MIN, WIDE_REF_FACTOR * passageSpan);
  const scored: Array<{ entry: DictionaryHit; score: number }> = [];
  for (const entry of entries) {
    const matched = matchesPassage(entry.headword, ctx);
    if (!matched && (isStopHeadword(entry.headword) || entry.ref_span > wideLimit)) continue;
    scored.push({ entry, score: 1 / Math.max(1, entry.total_refs) + (matched ? 1 : 0) });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.entry.ref_span - b.entry.ref_span ||
      cmp(a.entry.headword, b.entry.headword) ||
      cmp(a.entry.cite_id, b.entry.cite_id),
  );
  return scored.slice(0, limit).map((s) => s.entry);
}

/**
 * Entidades por especificidade. Entidades genéricas (>= GENERIC_ENTITY_REFS versículos) só entram
 * quando não há nenhuma outra entidade e nenhum outro item histórico (`othersExist`, ex.: verbetes).
 */
export function rankEntities(
  entities: readonly EntityHit[],
  limit: number,
  opts: { othersExist?: boolean } = {},
): EntityHit[] {
  const specific = entities.filter((e) => e.total_refs < GENERIC_ENTITY_REFS);
  if (specific.length === 0 && opts.othersExist) return [];
  const pool = specific.length > 0 ? specific : [...entities];
  return [...pool]
    .sort((a, b) => a.total_refs - b.total_refs || cmp(a.name, b.name) || cmp(a.cite_id, b.cite_id))
    .slice(0, limit);
}

const cmp = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);

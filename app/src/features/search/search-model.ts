// Regras da tela de busca, sem banco nem React: filtros (testamento pelo domínio, livro), contagem por livro,
// grupos com "Mais N", trecho com o termo destacado e buscas recentes.
import { BOOK_TABLE, DEFAULT_APP_LANG, bookAbbrOf, bookNameOf, splitVid, testamentOfBook, type AppLang, type Testament, type Vid } from '@sensus/core';

export type TestamentFilter = 'all' | Testament;

export interface HitFilter {
  testament: TestamentFilter;
  /** Livro escolhido (número canônico) ou null = todos. */
  book: number | null;
}

/** Versículos que passam pelos filtros, na ordem recebida (canônica). */
export function filterHits(vids: readonly Vid[], f: HitFilter): Vid[] {
  return vids.filter((v) => {
    const book = splitVid(v).book;
    if (f.book !== null && book !== f.book) return false;
    return f.testament === 'all' || testamentOfBook(book) === f.testament;
  });
}

export interface BookCount {
  book: number;
  count: number;
}

/** Contagem por livro, na ordem canônica. */
export function countByBook(vids: readonly Vid[]): BookCount[] {
  const counts = new Map<number, number>();
  for (const v of vids) {
    const b = splitVid(v).book;
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([book, count]) => ({ book, count }));
}

/** Quantos versículos cada livro mostra antes de "Mais N". */
export const PER_BOOK = 3;

export interface HitGroup {
  book: number;
  total: number;
  /** Versículos mostrados. */
  shown: Vid[];
  /** Quantos ficaram atrás de "Mais N" (0 = nenhum). */
  more: number;
}

/** Grupos por livro: 3 por livro, todos nos livros abertos ou quando só há um livro (filtro). */
export function groupHits(vids: readonly Vid[], expanded: ReadonlySet<number>, perBook = PER_BOOK): HitGroup[] {
  const counts = countByBook(vids);
  const single = counts.length === 1;
  return counts.map(({ book, count }) => {
    const all = vids.filter((v) => splitVid(v).book === book);
    const open = single || expanded.has(book);
    const shown = open ? all : all.slice(0, perBook);
    return { book, total: count, shown, more: count - shown.length };
  });
}

export interface SnippetPart {
  text: string;
  hit: boolean;
}

/** Tamanho do trecho em caracteres (versículos longos são cortados em volta do primeiro termo). */
export const SNIPPET_MAX = 170;
/** Contexto antes do primeiro termo quando o versículo é cortado. */
const SNIPPET_LEAD = 60;

/**
 * Partes do trecho com os termos marcados. Versículo longo é cortado em volta do primeiro termo, em fronteira de
 * palavra, com reticências nas pontas cortadas.
 */
export function snippetParts(text: string, ranges: ReadonlyArray<readonly [number, number]>, max = SNIPPET_MAX): SnippetPart[] {
  let from = 0;
  let to = text.length;
  if (text.length > max) {
    const first = ranges[0]?.[0] ?? 0;
    from = Math.max(0, first - SNIPPET_LEAD);
    if (from > 0) {
      const space = text.indexOf(' ', from);
      from = space >= 0 && space < first ? space + 1 : from;
    }
    to = Math.min(text.length, from + max);
    if (to < text.length) {
      const space = text.lastIndexOf(' ', to);
      to = space > from ? space : to;
    }
  }
  const parts: SnippetPart[] = [];
  if (from > 0) parts.push({ text: '…', hit: false });
  let pos = from;
  for (const [a, b] of ranges) {
    if (b <= from || a >= to) continue;
    const s = Math.max(a, from);
    const e = Math.min(b, to);
    if (s > pos) parts.push({ text: text.slice(pos, s), hit: false });
    parts.push({ text: text.slice(s, e), hit: true });
    pos = e;
  }
  if (pos < to) parts.push({ text: text.slice(pos, to), hit: false });
  if (to < text.length) parts.push({ text: '…', hit: false });
  return parts;
}

/** Quantas buscas recentes ficam guardadas. */
export const MAX_RECENT = 5;

/** Põe a busca no começo da lista, sem repetir (sem diferenciar maiúsculas e acentos), até MAX_RECENT. */
export function pushRecent(list: readonly string[], query: string, fold: (s: string) => string): string[] {
  const q = query.trim();
  if (!q) return [...list];
  const key = fold(q);
  return [q, ...list.filter((x) => fold(x) !== key)].slice(0, MAX_RECENT);
}

/** Referência curta de um resultado no idioma do app: "Rm 5:2". */
export function hitRef(vid: Vid, lang: AppLang = DEFAULT_APP_LANG): string {
  const { book, chapter, verse } = splitVid(vid);
  return `${bookAbbrOf(book, lang)} ${chapter}:${verse}`;
}

/** Nome do livro no idioma do app (cabeçalho do grupo, filtro). */
export function hitBookName(book: number, lang: AppLang = DEFAULT_APP_LANG): string {
  return bookNameOf(BOOK_TABLE[book - 1], book, lang);
}

/** Abreviação do livro no idioma do app (faixa de contagem). */
export function hitBookAbbr(book: number, lang: AppLang = DEFAULT_APP_LANG): string {
  return bookAbbrOf(book, lang);
}

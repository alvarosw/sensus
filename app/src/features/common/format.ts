import { formatShortRef, type Book, type VerseRange, type Vid } from '@sensus/core';

/** "Fp 2:5" — referência curta com abreviação do livro. */
export function shortRef(vid: Vid, books: readonly Book[]): string {
  return formatShortRef(vid, vid, books, true);
}

/** "Fp 1:30–2:1" — intervalo curto com abreviação do livro. */
export function rangeLabel(range: VerseRange, books: readonly Book[]): string {
  return formatShortRef(range.start, range.end, books, true);
}

// Regras puras da lista Minhas marcas: qual intervalo mostrar (o que a Bíblia ativa tem) e como agrupar por livro.
import { splitVid, type Vid, type VerseRange } from '@sensus/core';

export interface VisibleRange extends VerseRange {
  /** A Bíblia ativa não tem nenhum versículo da marca (ex.: At 8:37 num texto crítico). */
  missing: boolean;
}

/**
 * Intervalo a mostrar de uma marca: do primeiro ao último versículo que a Bíblia ativa tem dentro dele. Sem nenhum,
 * o intervalo guardado, marcado como ausente. `existing` são os vids que a Bíblia ativa devolveu para o intervalo.
 */
export function visibleRange(stored: VerseRange, existing: readonly Vid[]): VisibleRange {
  if (existing.length === 0) return { start: stored.start, end: stored.end, missing: true };
  let start = existing[0]!;
  let end = existing[0]!;
  for (const v of existing) {
    if (v < start) start = v;
    if (v > end) end = v;
  }
  return { start, end, missing: false };
}

export interface BookGroup<T> {
  book: number;
  items: T[];
}

/** Agrupa itens (já na ordem desejada) por livro, mantendo a ordem de aparição. */
export function groupByBook<T extends { startVid: Vid }>(items: readonly T[]): BookGroup<T>[] {
  const groups: BookGroup<T>[] = [];
  for (const item of items) {
    const book = splitVid(item.startVid).book;
    const last = groups[groups.length - 1];
    if (last && last.book === book) last.items.push(item);
    else groups.push({ book, items: [item] });
  }
  return groups;
}

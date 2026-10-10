// Capítulos como unidade do leitor contínuo: índice linear (livro, capítulo) ↔ posição na Bíblia,
// carregamento dos versículos e agrupamento em parágrafos/títulos (text_division).
import { BOOK_TABLE, DEFAULT_TEXT_SOURCE, LAST_VERSE, chapterRange, makeVid, splitVid, type Repo, type Vid } from '@sensus/core';
import { buildFlow, type FlowBlock } from '../nav/verse-flow';

const FIRST_IDX: number[] = []; // índice (0-based) do capítulo 1 de cada livro, por número do livro
let total = 0;
for (const b of BOOK_TABLE) {
  FIRST_IDX[b.num] = total;
  total += b.chapters;
}
export const TOTAL_CHAPTERS = total;

export interface ChapterRef {
  book: number;
  chapter: number;
}

export function chapterIndex(book: number, chapter: number): number {
  return (FIRST_IDX[book] ?? 0) + chapter - 1;
}

export function chapterAt(idx: number): ChapterRef {
  let lo = 0;
  let hi = BOOK_TABLE.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((FIRST_IDX[BOOK_TABLE[mid]!.num] ?? 0) <= idx) lo = mid;
    else hi = mid - 1;
  }
  const b = BOOK_TABLE[lo]!;
  return { book: b.num, chapter: idx - (FIRST_IDX[b.num] ?? 0) + 1 };
}

export function vidChapterIndex(vid: Vid): number {
  const p = splitVid(vid);
  return chapterIndex(p.book, Math.max(p.chapter, 1));
}

export function bookName(book: number): string {
  return BOOK_TABLE[book - 1]?.name_pt ?? '';
}

export interface ChapterData {
  idx: number;
  book: number;
  chapter: number;
  blocks: FlowBlock[];
  /** Primeiro e último versículo (vid) com texto. */
  first: Vid;
  last: Vid;
}

const cache = new Map<string, Promise<ChapterData>>();

/** Versículos do capítulo na fonte dada, em blocos (parágrafos e títulos). Em cache por fonte. */
export function loadChapter(repo: Repo, source: string, idx: number): Promise<ChapterData> {
  const key = `${source}:${idx}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const { book, chapter } = chapterAt(idx);
      const range = chapterRange(book, chapter);
      const [verses, divisions] = await Promise.all([
        repo.chapter(source, book, chapter),
        // Divisões são da edição-base; valem para qualquer tradução de mesma versificação.
        repo.divisions(DEFAULT_TEXT_SOURCE, range),
      ]);
      const body = verses.filter((v) => splitVid(v.vid).verse >= 1);
      const inside = divisions.filter((d) => d.vid >= range.start && d.vid <= range.end);
      return {
        idx,
        book,
        chapter,
        blocks: buildFlow(body, inside),
        first: body[0]?.vid ?? makeVid(book, chapter, 1),
        last: body[body.length - 1]?.vid ?? makeVid(book, chapter, LAST_VERSE),
      };
    })();
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

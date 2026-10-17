// Aritmética de vid (livro*1_000_000 + capítulo*1000 + versículo). Toda conta de vid fica aqui.
// Versículo 0 = introdução de capítulo ou livro.
import { makeVid, splitVid } from '../refs';
import type { Vid } from '../types';

export function isIntroVid(vid: Vid): boolean {
  return splitVid(vid).verse === 0;
}

/** Comentário de introdução: começa ou termina numa introdução (versículo 0). */
export function isIntroCommentary(range: { start_vid: Vid; end_vid: Vid }): boolean {
  return isIntroVid(range.start_vid) || isIntroVid(range.end_vid);
}

/** Primeiro versículo do livro (1:1). */
export function bookStartVid(book: number): Vid {
  return makeVid(book, 1, 1);
}

/** Primeiro versículo do capítulo (ch:1). */
export function chapterStartVid(book: number, chapter: number): Vid {
  return makeVid(book, chapter, 1);
}

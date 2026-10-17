// Aritmética de vid (livro × 1 000 000 + capítulo × 1000 + versículo). Toda conta de vid fica aqui.
// Versículo 0 = introdução de capítulo ou livro. Não importa refs.ts (refs.ts valida e chama estas funções).
import type { Vid } from '../types';

const BOOK_FACTOR = 1_000_000;
const CHAPTER_FACTOR = 1_000;

/** Último número de versículo; usado para "capítulo inteiro". */
export const LAST_VERSE = 999;
export const MAX_BOOK = 66;

export interface VidFields {
  book: number;
  chapter: number;
  verse: number;
}

/** Empacota livro, capítulo e versículo num vid (com as faixas validadas: livro 1-66, capítulo e versículo 0-999). */
export function packVid(book: number, chapter: number, verse: number): Vid {
  if (!Number.isInteger(book) || book < 1 || book > MAX_BOOK) throw new RangeError(`livro inválido: ${book}`);
  if (!Number.isInteger(chapter) || chapter < 0 || chapter > LAST_VERSE) throw new RangeError(`capítulo inválido: ${chapter}`);
  if (!Number.isInteger(verse) || verse < 0 || verse > LAST_VERSE) throw new RangeError(`versículo inválido: ${verse}`);
  return book * BOOK_FACTOR + chapter * CHAPTER_FACTOR + verse;
}

/** Separa um vid em livro, capítulo e versículo. */
export function unpackVid(vid: Vid): VidFields {
  return {
    book: Math.floor(vid / BOOK_FACTOR),
    chapter: Math.floor(vid / CHAPTER_FACTOR) % CHAPTER_FACTOR,
    verse: vid % CHAPTER_FACTOR,
  };
}

export function isIntroVid(vid: Vid): boolean {
  return unpackVid(vid).verse === 0;
}

/** Comentário de introdução: começa ou termina numa introdução (versículo 0). */
export function isIntroCommentary(range: { start_vid: Vid; end_vid: Vid }): boolean {
  return isIntroVid(range.start_vid) || isIntroVid(range.end_vid);
}

/** Primeiro versículo do livro (1:1). */
export function bookStartVid(book: number): Vid {
  return packVid(book, 1, 1);
}

/** Primeiro versículo do capítulo (ch:1). */
export function chapterStartVid(book: number, chapter: number): Vid {
  return packVid(book, chapter, 1);
}

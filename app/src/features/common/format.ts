// Formatação de referências e de texto para o app. A referência curta é a do núcleo (formatShortRef); aqui só há o
// atalho com a tabela de livros de fallback e o texto da palavra.
import { BOOK_TABLE, formatShortRef, type Book, type Vid } from '@sensus/core';

/** "1:27–2:4" (sem livro) ou "Fp 1:27–2:4" (com livro abreviado). Sem a lista de livros carregada, usa a do núcleo. */
export function refShort(start: Vid, end: Vid, books: readonly Book[], withBook = false): string {
  return formatShortRef(start, end, books.length > 0 ? (books as Book[]) : BOOK_TABLE, withBook);
}

/** "1:30" (capítulo e versículo de um vid, sem livro). */
export function chv(vid: Vid): string {
  return formatShortRef(vid, vid, BOOK_TABLE, false);
}

/** Palavra sem pontuação de borda. */
export function bareWord(surface: string): string {
  return surface.normalize('NFC').replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '');
}

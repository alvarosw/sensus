// Agrupamento dos livros por categoria (intervalos canônicos, inclusivos).
import type { Book, Testament } from '@sensus/core';

/** Categorias dos livros. O nome de cada uma vem de READER.bookCategory (por idioma). */
export type BookCategoryId =
  | 'law'
  | 'history-ot'
  | 'poetry'
  | 'major-prophets'
  | 'minor-prophets'
  | 'gospels'
  | 'history-nt'
  | 'pauline'
  | 'general'
  | 'prophecy';

export interface BookCategory {
  id: BookCategoryId;
  testament: Testament;
  from: number;
  to: number;
}

export const BOOK_CATEGORIES: readonly BookCategory[] = [
  { id: 'law', testament: 'OT', from: 1, to: 5 },
  { id: 'history-ot', testament: 'OT', from: 6, to: 17 },
  { id: 'poetry', testament: 'OT', from: 18, to: 22 },
  { id: 'major-prophets', testament: 'OT', from: 23, to: 27 },
  { id: 'minor-prophets', testament: 'OT', from: 28, to: 39 },
  { id: 'gospels', testament: 'NT', from: 40, to: 43 },
  { id: 'history-nt', testament: 'NT', from: 44, to: 44 },
  { id: 'pauline', testament: 'NT', from: 45, to: 57 },
  { id: 'general', testament: 'NT', from: 58, to: 65 },
  { id: 'prophecy', testament: 'NT', from: 66, to: 66 },
];

export interface CategoryGroup {
  category: BookCategory;
  books: Book[];
}

/** Livros de um testamento, agrupados por categoria na ordem canônica. */
export function groupBooks(books: readonly Book[], testament: Testament): CategoryGroup[] {
  return BOOK_CATEGORIES.filter((c) => c.testament === testament).map((category) => ({
    category,
    books: books.filter((b) => b.num >= category.from && b.num <= category.to),
  }));
}

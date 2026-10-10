// Agrupamento dos livros por categoria (intervalos canônicos, inclusivos).
import type { Book } from '@sensus/core';

export interface BookCategory {
  id: string;
  title: string;
  testament: 'OT' | 'NT';
  from: number;
  to: number;
}

export const BOOK_CATEGORIES: readonly BookCategory[] = [
  { id: 'law', title: 'Lei', testament: 'OT', from: 1, to: 5 },
  { id: 'history-ot', title: 'Históricos', testament: 'OT', from: 6, to: 17 },
  { id: 'poetry', title: 'Poéticos', testament: 'OT', from: 18, to: 22 },
  { id: 'major-prophets', title: 'Profetas maiores', testament: 'OT', from: 23, to: 27 },
  { id: 'minor-prophets', title: 'Profetas menores', testament: 'OT', from: 28, to: 39 },
  { id: 'gospels', title: 'Evangelhos', testament: 'NT', from: 40, to: 43 },
  { id: 'history-nt', title: 'Histórico', testament: 'NT', from: 44, to: 44 },
  { id: 'pauline', title: 'Cartas paulinas', testament: 'NT', from: 45, to: 57 },
  { id: 'general', title: 'Cartas gerais', testament: 'NT', from: 58, to: 65 },
  { id: 'prophecy', title: 'Profecia', testament: 'NT', from: 66, to: 66 },
];

export interface CategoryGroup {
  category: BookCategory;
  books: Book[];
}

/** Livros de um testamento, agrupados por categoria na ordem canônica. */
export function groupBooks(books: readonly Book[], testament: 'OT' | 'NT'): CategoryGroup[] {
  return BOOK_CATEGORIES.filter((c) => c.testament === testament).map((category) => ({
    category,
    books: books.filter((b) => b.num >= category.from && b.num <= category.to),
  }));
}

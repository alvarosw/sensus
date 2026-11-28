// "Ir para" com referência ou palavra: decide as opções do campo (docs/design/1a-busca.html). Função pura.
//  - referência ("fp 2:5", "2:5" no livro atual): Ir para;
//  - palavra: Buscar;
//  - nome de livro sem número ("joão"): as duas, Ir para primeiro (sem número, quase sempre é o livro);
//  - texto com número que não fecha uma referência: erro "Não reconheço essa referência".
import type { Book } from '@sensus/core';
import { searchTerms } from '../../data/bibles/search-model';
import { analyzeQuery, type RefMatch } from './reference';
import { bookByAbbr } from './abbrev';

export type JumpOption = { kind: 'goto'; ref: RefMatch } | { kind: 'search'; query: string };

export interface JumpPlan {
  options: JumpOption[];
  /** Parece referência (tem número) mas não fecha. */
  bad: boolean;
}

const CHAPTER_ONLY_RE = /^\s*\d+\s*([:.,]\s*\d+)?(\s*[-–]\s*\d+)?\s*$/;

export function planJump(input: string, books: readonly Book[], currentBook: Book): JumpPlan {
  const text = input.trim();
  if (!text) return { options: [], bad: false };
  // "2:5" sem livro vale para o livro atual.
  const q = CHAPTER_ONLY_RE.test(text) ? `${currentBook.name_pt} ${text}` : text;
  const { ref } = analyzeQuery(q, books);
  if (ref) return { options: [{ kind: 'goto', ref }], bad: false };
  if (/\d/.test(text)) return { options: [], bad: true };
  const options: JumpOption[] = [];
  const book = bookByAbbr(text, books);
  const chapterOne = book ? analyzeQuery(`${book.name_pt} 1`, books).ref : null;
  if (chapterOne) options.push({ kind: 'goto', ref: chapterOne });
  if (searchTerms(text).length > 0) options.push({ kind: 'search', query: text });
  return { options, bad: false };
}

// Interpreta o texto da busca: referência completa ("fp 2:5-8", "jo 3:16", "1co 13") ou prefixo de livro.
import { LAST_VERSE, parseRef, splitVid, type Book, type VerseRange } from '@sensus/core';
import { bookByAbbr, suggestBooks } from './abbrev';

// Livro (pode começar com dígito, ex.: "1co") + capítulo/versículos.
const REF_INPUT_RE = /^\s*(\d?\s*\D+?)\s*[.,]?\s*(\d.*?)\s*$/u;

export interface RefMatch {
  book: Book;
  range: VerseRange;
  chapter: number;
  /** Versículo inicial; null quando a referência é capítulo inteiro. */
  verse: number | null;
  /** Versículo final quando o intervalo fica no mesmo capítulo. */
  verseEnd: number | null;
  wholeChapter: boolean;
}

export interface QueryAnalysis {
  /** Livros que combinam com o prefixo digitado (quando ainda não há referência). */
  suggestions: Book[];
  ref: RefMatch | null;
  /** Texto digitado não corresponde a nenhum livro ou referência válida. */
  unmatched: boolean;
}

function toMatch(book: Book, range: VerseRange): RefMatch {
  const s = splitVid(range.start);
  const e = splitVid(range.end);
  const wholeChapter = s.verse <= 1 && e.verse >= LAST_VERSE;
  return {
    book,
    range,
    chapter: s.chapter,
    verse: wholeChapter ? null : Math.max(s.verse, 1),
    verseEnd: wholeChapter || s.chapter !== e.chapter ? null : e.verse,
    wholeChapter,
  };
}

export function analyzeQuery(input: string, books: readonly Book[]): QueryAnalysis {
  const q = input.trim();
  if (!q) return { suggestions: [], ref: null, unmatched: false };

  const m = REF_INPUT_RE.exec(q);
  if (m) {
    const book = bookByAbbr(m[1] ?? '', books);
    // parseRef só entende nomes completos; passamos o nome canônico do livro.
    const range = book ? parseRef(`${book.name_pt} ${(m[2] ?? '').replace(/,/g, ':')}`, books) : null;
    if (!book || !range) return { suggestions: [], ref: null, unmatched: true };
    return { suggestions: [], ref: toMatch(book, range), unmatched: false };
  }

  const suggestions = suggestBooks(q, books);
  return { suggestions, ref: null, unmatched: suggestions.length === 0 };
}

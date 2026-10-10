// Navegação para leitura e estudo. Parâmetros de estudo: start/end (vid), como antes.
import { router } from 'expo-router';
import type { VerseRange } from '@sensus/core';

export function openReaderAt(book: number, chapter: number, verse?: number, verseEnd?: number): void {
  router.push({
    pathname: '/reader/[book]/[chapter]',
    params: {
      book: String(book),
      chapter: String(chapter),
      ...(verse ? { verse: String(verse) } : {}),
      ...(verse && verseEnd && verseEnd !== verse ? { verseEnd: String(verseEnd) } : {}),
    },
  });
}

export function openStudy(range: VerseRange): void {
  router.push({ pathname: '/study', params: { start: String(range.start), end: String(range.end) } });
}

import { router } from 'expo-router';

/** Abre a tela de uma fonte (cite_id). Use "src:<source_id>" para a ficha da fonte. */
export function openSource(cite: string): void {
  router.push({ pathname: '/source/[cite]', params: { cite } });
}

export function openReader(book: number, chapter: number): void {
  router.push({ pathname: '/reader/[book]/[chapter]', params: { book: String(book), chapter: String(chapter) } });
}

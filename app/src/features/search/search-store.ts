// Estado da busca entre a tela de resultados e o leitor: o texto, os filtros, os livros abertos e a navegação de
// resultados no leitor (a pílula "‹ n de N · termo ›"). Some quando o app fecha; só as buscas recentes ficam
// gravadas (settings/app-prefs).
import { create } from 'zustand';
import type { Vid } from '@sensus/core';
import type { TestamentFilter } from './search-model';

export interface SearchNav {
  /** Resultados na ordem da lista (já filtrados). */
  hits: Vid[];
  index: number;
  terms: string[];
  prefix: boolean;
  query: string;
}

interface SearchState {
  query: string;
  prefix: boolean;
  testament: TestamentFilter;
  book: number | null;
  /** Livros com "Mais N" aberto. */
  expanded: number[];
  nav: SearchNav | null;
  /** Começa uma busca nova (filtros zerados). */
  start(query: string): void;
  setPrefix(on: boolean): void;
  setTestament(t: TestamentFilter): void;
  setBook(book: number | null): void;
  expand(book: number): void;
  setNav(nav: SearchNav | null): void;
  /** Passa ao resultado anterior (-1) ou ao próximo (+1); devolve o vid, ou null na ponta. */
  step(delta: -1 | 1): Vid | null;
}

export const useSearch = create<SearchState>()((set, get) => ({
  query: '',
  prefix: false,
  testament: 'all',
  book: null,
  expanded: [],
  nav: null,
  start: (query) => set({ query, prefix: false, testament: 'all', book: null, expanded: [] }),
  setPrefix: (prefix) => set({ prefix, expanded: [] }),
  setTestament: (testament) => set({ testament, book: null, expanded: [] }),
  setBook: (book) => set({ book, expanded: [] }),
  expand: (book) => set((s) => ({ expanded: s.expanded.includes(book) ? s.expanded : [...s.expanded, book] })),
  setNav: (nav) => set({ nav }),
  step: (delta) => {
    const nav = get().nav;
    if (!nav) return null;
    const index = nav.index + delta;
    if (index < 0 || index >= nav.hits.length) return null;
    set({ nav: { ...nav, index } });
    return nav.hits[index] ?? null;
  },
}));

// Pedidos de navegação ao leitor (livros, "ir para") e a posição atual (para o título do topo).
// Fica separado do estado de estudo: só o leitor e a barra superior o usam.
import { create } from 'zustand';
import type { Vid } from '@sensus/core';

export interface NavRequest {
  id: number;
  vid: Vid;
  /** 'chapter' rola ao marcador do capítulo; 'verse' ao versículo. */
  kind: 'chapter' | 'verse';
  /** Realce breve do versículo (motion.flash). */
  flash?: boolean;
  animated?: boolean;
}

interface ReaderNav {
  /** Capítulo mostrado no título (derivado da rolagem). */
  position: { book: number; chapter: number };
  request: NavRequest | null;
  setPosition(book: number, chapter: number): void;
  goChapter(book: number, chapter: number): void;
  goVerse(vid: Vid, opts?: { flash?: boolean; animated?: boolean }): void;
  consume(id: number): void;
}

let seq = 0;

export const useReaderNav = create<ReaderNav>()((set) => ({
  position: { book: 50, chapter: 1 },
  request: null,
  setPosition: (book, chapter) =>
    set((s) => (s.position.book === book && s.position.chapter === chapter ? s : { position: { book, chapter } })),
  // O título já mostra o destino (a rolagem confirma depois, pelo próprio leitor).
  goChapter: (book, chapter) =>
    set({
      position: { book, chapter },
      request: { id: ++seq, kind: 'chapter', vid: book * 1_000_000 + chapter * 1000 + 1, animated: true },
    }),
  goVerse: (vid, opts) => {
    const book = Math.floor(vid / 1_000_000);
    const chapter = Math.floor((vid % 1_000_000) / 1000);
    const request: NavRequest = { id: ++seq, kind: 'verse', vid, flash: opts?.flash, animated: opts?.animated ?? true };
    if (book >= 1 && chapter >= 1) set({ position: { book, chapter }, request });
    else set({ request });
  },
  consume: (id) => set((s) => (s.request?.id === id ? { request: null } : s)),
}));

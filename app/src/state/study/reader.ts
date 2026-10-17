// Leitor: texto corrido, grego sob os versículos, referência fixada no topo e "ir para".
import type { StateCreator } from 'zustand';
import type { Vid } from '@sensus/core';
import type { StudyState } from './index';

/** Referência cruzada fixada no topo do leitor ("lado a lado"). */
export interface PinnedRef {
  citeId: string;
  start: Vid;
  end: Vid;
}

export interface ReaderSlice {
  /**
   * Fonte do texto corrido ('blivre' | 'kjv').
   * Espelho, não fonte da verdade: a fonte é `useAppPrefs.textSource` (persistida em `settings/app-prefs.ts`).
   * Só `app-prefs` grava aqui (ao carregar e em `setTextSource`); o leitor e a folha leem daqui por ser síncrono.
   */
  textSource: string;
  /** Grego TR sob os versículos selecionados (botão Αα). */
  greek: boolean;
  pinned: PinnedRef | null;
  /** Versículo para rolar até e realçar brevemente ("ir para"); o leitor zera após consumir. */
  jumpTarget: Vid | null;

  setTextSource(id: string): void;
  toggleGreek(): void;
  pin(p: PinnedRef | null): void;
  jumpTo(vid: Vid | null): void;
}

export const createReaderSlice: StateCreator<StudyState, [], [], ReaderSlice> = (set) => ({
  textSource: 'blivre',
  greek: false,
  pinned: null,
  jumpTarget: null,

  setTextSource: (id) => set({ textSource: id }),
  toggleGreek: () => set((s) => ({ greek: !s.greek })),
  pin: (p) => set({ pinned: p }),
  jumpTo: (vid) => set({ jumpTarget: vid }),
});

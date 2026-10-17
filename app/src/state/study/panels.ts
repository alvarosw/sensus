// Prévia de referência e painéis empilhados em tela cheia (com trilha de volta).
import type { StateCreator } from 'zustand';
import type { Vid } from '@sensus/core';
import type { StudyState } from './index';

/** Escopos do mapa em tela cheia: seleção, perícope e livro (intervalos de versículos). */
export interface MapScope {
  range: { start: Vid; end: Vid };
  unit: { start: Vid; end: Vid } | null;
  book: { start: Vid; end: Vid };
  /** Escopo que abre primeiro. */
  initial: 'selection' | 'unit' | 'book';
}

export type PanelEntry =
  | { kind: 'word'; tokenCiteId: string }
  | { kind: 'lemma'; strongBase: string }
  | { kind: 'source'; citeId: string }
  | { kind: 'entity'; citeId: string }
  | { kind: 'map'; scope: MapScope };

export interface PanelsSlice {
  /** Prévia de referência aberta (cite_id), ou null. */
  popoverCite: string | null;
  /** Pilha de painéis em tela cheia; o último é o visível. */
  panels: PanelEntry[];

  openPopover(citeId: string): void;
  closePopover(): void;
  pushPanel(p: PanelEntry): void;
  popPanel(): void;
  popPanelsTo(index: number): void;
  closePanels(): void;
}

export const createPanelsSlice: StateCreator<StudyState, [], [], PanelsSlice> = (set) => ({
  popoverCite: null,
  panels: [],

  openPopover: (citeId) => set({ popoverCite: citeId }),
  closePopover: () => set({ popoverCite: null }),
  pushPanel: (p) => set((s) => ({ panels: [...s.panels, p], popoverCite: null })),
  popPanel: () => set((s) => ({ panels: s.panels.slice(0, -1) })),
  popPanelsTo: (index) => set((s) => ({ panels: s.panels.slice(0, index + 1) })),
  closePanels: () => set({ panels: [] }),
});

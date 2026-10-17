// Seleção de versículos do leitor (intervalo, âncora do primeiro toque e desfazer da última redução).
import type { StateCreator } from 'zustand';
import type { Vid } from '@sensus/core';
import type { StudyState } from './index';

export interface Selection {
  start: Vid;
  end: Vid;
  /** Versículo do primeiro toque (o intervalo se estende a partir dele). */
  anchor: Vid;
}

export interface SelectionSlice {
  selection: Selection | null;
  /** Seleção anterior, para "desfazer" após reduzir. */
  previousSelection: Selection | null;

  /** Toque em versículo: sem seleção → seleciona; fora do intervalo → estende a partir da âncora; dentro → reduz (guarda desfazer). */
  tapVerse(vid: Vid): void;
  setSelection(start: Vid, end: Vid, anchor?: Vid): void;
  undoSelection(): void;
  clearSelection(): void;
}

/** Ordena um intervalo de versículos (início antes do fim). */
const ordered = (a: Vid, b: Vid): [Vid, Vid] => (a <= b ? [a, b] : [b, a]);

export const createSelectionSlice: StateCreator<StudyState, [], [], SelectionSlice> = (set, get) => ({
  selection: null,
  previousSelection: null,

  tapVerse: (vid) => {
    const { selection, detent } = get();
    if (!selection) {
      set({ selection: { start: vid, end: vid, anchor: vid }, previousSelection: null, detent: detent === 'closed' ? 'peek' : detent });
      return;
    }
    if (vid >= selection.start && vid <= selection.end) {
      if (selection.start === selection.end) return;
      set({ previousSelection: selection, selection: { start: vid, end: vid, anchor: vid } });
      return;
    }
    const [start, end] = ordered(selection.anchor, vid);
    set({ selection: { start, end, anchor: selection.anchor } });
  },
  setSelection: (a, b, anchor) => {
    const [start, end] = ordered(a, b);
    set((s) => ({ selection: { start, end, anchor: anchor ?? start }, detent: s.detent === 'closed' ? 'peek' : s.detent }));
  },
  undoSelection: () => set((s) => (s.previousSelection ? { selection: s.previousSelection, previousSelection: null } : {})),
  clearSelection: () => set({ selection: null, previousSelection: null, detent: 'closed', popoverCite: null }),
});

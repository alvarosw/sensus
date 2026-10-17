// Folha de estudo: só a altura (detent). O que aparece dentro dela está em lenses.ts.
import type { StateCreator } from 'zustand';
import type { Detent } from '../../design/tokens';
import type { StudyState } from './index';

export interface SheetSlice {
  detent: Detent;
  setDetent(d: Detent): void;
}

export const createSheetSlice: StateCreator<StudyState, [], [], SheetSlice> = (set) => ({
  detent: 'closed',
  setDetent: (d) => set({ detent: d }),
});

// Estado compartilhado da experiência ler → selecionar → estudar → perguntar.
// Um store `useStudy`, composto de slices por domínio (um arquivo cada). A API pública é a mesma de antes:
// quem importa `@/state/study` não muda. Só estado e ações síncronas; streaming de IA e consultas ao banco ficam
// nos módulos de feature. Nada aqui é persistido (regra do projeto: conteúdo de IA não é salvo).
//
// Quem usa o quê (ver docs/ARCHITECTURE.md §3, item 4): o store de cada feature fica na feature. Aqui só entra o que
// é compartilhado entre leitor, folha e chat. Campos usados por uma feature só (ex.: `tradition`, `compare`) estão nos
// slices por ora, para não mudar chamadores (candidatos a sair do store compartilhado: ver o relatório do passo 15).
import { create } from 'zustand';
import { createReaderSlice, type ReaderSlice } from './reader';
import { createSelectionSlice, type SelectionSlice } from './selection';
import { createSheetSlice, type SheetSlice } from './sheet';
import { createLensesSlice, type LensesSlice } from './lenses';
import { createGenerationsSlice, type GenerationsSlice } from './generations';
import { createPanelsSlice, type PanelsSlice } from './panels';
import { createChatSlice, type ChatSlice } from './chat';
import { createToastSlice, type ToastSlice } from './toast';

export type StudyState = ReaderSlice &
  SelectionSlice &
  SheetSlice &
  LensesSlice &
  GenerationsSlice &
  PanelsSlice &
  ChatSlice &
  ToastSlice;

export const useStudy = create<StudyState>()((...a) => ({
  ...createReaderSlice(...a),
  ...createSelectionSlice(...a),
  ...createSheetSlice(...a),
  ...createLensesSlice(...a),
  ...createGenerationsSlice(...a),
  ...createPanelsSlice(...a),
  ...createChatSlice(...a),
  ...createToastSlice(...a),
}));

export { LENS_KEYS, LENS_LABELS, type LensKey, type CompareSource } from './lenses';
export type { Selection } from './selection';
export type { Generation } from './generations';
export type { MapScope, PanelEntry } from './panels';
export type { Attachment, BubblePosition, ChatTurn } from './chat';
export type { PinnedRef } from './reader';
export type { StudyToast } from './toast';

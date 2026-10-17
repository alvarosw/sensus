// Aviso curto na tela (uma mensagem por vez, com ação opcional).
import type { StateCreator } from 'zustand';
import type { StudyState } from './index';

export interface StudyToast {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface ToastSlice {
  toast: StudyToast | null;

  showToast(t: StudyToast | null): void;
}

export const createToastSlice: StateCreator<StudyState, [], [], ToastSlice> = (set) => ({
  toast: null,

  showToast: (t) => set({ toast: t }),
});

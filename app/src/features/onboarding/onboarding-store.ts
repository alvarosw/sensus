// Passo atual da apresentação. Fica num store (e não no estado do componente) porque trocar o idioma remonta a árvore
// inteira (key={lang} na raiz): o fluxo volta ao mesmo passo. Em memória: uma nova abertura começa do início.
// `bibleOnly`: a apresentação foi aberta só para baixar uma Bíblia (ver OnboardingGate e onboarding-model).
import { create } from 'zustand';
import type { OnboardingStep } from './onboarding-model';

interface OnboardingState {
  step: OnboardingStep;
  bibleOnly: boolean;
  go(step: OnboardingStep): void;
  /** Abre no passo de Bíblia, sem os demais. */
  startBibleOnly(): void;
  /** Volta ao começo, no fluxo completo. */
  reset(): void;
}

export const useOnboarding = create<OnboardingState>()((set) => ({
  step: 'abertura',
  bibleOnly: false,
  go: (step) => set({ step }),
  startBibleOnly: () => set({ step: 'biblia', bibleOnly: true }),
  reset: () => set({ step: 'abertura', bibleOnly: false }),
}));

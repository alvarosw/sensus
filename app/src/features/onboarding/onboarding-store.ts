// Passo atual da apresentação. Fica num store (e não no estado do componente) porque trocar o idioma remonta a árvore
// inteira (key={lang} na raiz): o fluxo volta ao mesmo passo. Em memória: uma nova abertura começa do início.
import { create } from 'zustand';
import type { OnboardingStep } from './onboarding-model';

interface OnboardingState {
  step: OnboardingStep;
  go(step: OnboardingStep): void;
}

export const useOnboarding = create<OnboardingState>()((set) => ({
  step: 'abertura',
  go: (step) => set({ step }),
}));

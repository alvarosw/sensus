// Gerações de IA na folha (resumo por perícope e "Detalhar" por lente). Só em memória: conteúdo de IA não é salvo.
import type { StateCreator } from 'zustand';
import type { StudyState } from './index';

/** Geração de IA. Chave: `${unitStart}-${unitEnd}` (+ `:${lens}`). */
export interface Generation {
  text: string;
  status: 'idle' | 'streaming' | 'done' | 'error';
  error?: string;
  /** Raciocínio em curso, sem texto ainda (ver ChatTurn.thinking). */
  thinking?: boolean;
}

export interface GenerationsSlice {
  generations: Record<string, Generation>;

  setGeneration(key: string, g: Partial<Generation>): void;
  appendGeneration(key: string, chunk: string): void;
}

export const createGenerationsSlice: StateCreator<StudyState, [], [], GenerationsSlice> = (set) => ({
  generations: {},

  setGeneration: (key, g) =>
    set((s) => {
      const cur: Generation = s.generations[key] ?? { text: '', status: 'idle' };
      return { generations: { ...s.generations, [key]: { ...cur, ...g } } };
    }),
  appendGeneration: (key, chunk) =>
    set((s) => {
      const cur = s.generations[key] ?? { text: '', status: 'streaming' as const };
      // Chegou texto: a geração deixa de estar "pensando".
      return { generations: { ...s.generations, [key]: { ...cur, text: cur.text + chunk, thinking: false } } };
    }),
});

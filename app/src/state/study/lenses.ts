// Lentes da folha: a lente visível, a lente para a qual rolar, e o que cada lente mostra (comparação, tradição, "ver todos").
import type { StateCreator } from 'zustand';
import type { SectionKey } from '@sensus/core';
import type { StudyState } from './index';

/** Lentes da folha: visão geral + seções do resumo. */
export type LensKey = 'visao' | SectionKey;
export const LENS_KEYS: readonly LensKey[] = ['visao', 'texto', 'literario', 'historico', 'lingua', 'intertexto', 'interpretacao', 'aplicacao'];
export const LENS_LABELS: Record<LensKey, string> = {
  visao: 'Visão geral',
  texto: 'Texto',
  literario: 'Literário',
  historico: 'Histórico',
  lingua: 'Língua',
  intertexto: 'Intertexto',
  interpretacao: 'Interpretação',
  aplicacao: 'Aplicação',
};

export type CompareSource = 'blivre' | 'kjv' | 'original';

export interface LensesSlice {
  /** Lente visível (sincronizada com o trilho e a rolagem). */
  lens: LensKey;
  /** Lente para a qual a folha deve rolar (consumido pela folha). */
  lensTarget: LensKey | null;
  compare: CompareSource;
  /** Filtro de tradição na lente de interpretação (null = todas). */
  tradition: string | null;
  /** "Ver todos" por lente/grupo. */
  expanded: Record<string, boolean>;

  setLens(l: LensKey): void;
  goToLens(l: LensKey): void;
  consumeLensTarget(): void;
  setCompare(c: CompareSource): void;
  setTradition(t: string | null): void;
  toggleExpanded(key: string): void;
}

export const createLensesSlice: StateCreator<StudyState, [], [], LensesSlice> = (set) => ({
  lens: 'visao',
  lensTarget: null,
  compare: 'blivre',
  tradition: null,
  expanded: {},

  setLens: (l) => set({ lens: l }),
  goToLens: (l) => set((s) => ({ lensTarget: l, lens: l, detent: s.detent === 'peek' || s.detent === 'closed' ? 'half' : s.detent })),
  consumeLensTarget: () => set({ lensTarget: null }),
  setCompare: (c) => set({ compare: c }),
  setTradition: (t) => set({ tradition: t }),
  toggleExpanded: (key) => set((s) => ({ expanded: { ...s.expanded, [key]: !s.expanded[key] } })),
});

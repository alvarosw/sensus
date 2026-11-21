// Contextos da folha de estudo. Três, de propósito: os dados determinísticos mudam só com a seleção; a IA muda a
// cada pedaço do stream; a curiosidade muda uma vez por unidade. O provedor fica em useStudyData.tsx.
import { createContext, useContext } from 'react';
import type { CuriosityView, StudyAi, StudyData } from './study-state';

export const DataCtx = createContext<StudyData | null>(null);
export const AiCtx = createContext<StudyAi | null>(null);
/** Curiosidade do trecho (null quando não há uma aprovada). Contexto à parte: o cartão não re-renderiza a rolagem a cada pedaço da IA. */
export const CuriosityCtx = createContext<CuriosityView | null>(null);

export function useStudyData(): StudyData {
  const v = useContext(DataCtx);
  if (!v) throw new Error('useStudyData fora de <StudyDataProvider>');
  return v;
}

export function useStudyAi(): StudyAi {
  const v = useContext(AiCtx);
  if (!v) throw new Error('useStudyAi fora de <StudyDataProvider>');
  return v;
}

export function useStudyCuriosity(): CuriosityView | null {
  return useContext(CuriosityCtx);
}

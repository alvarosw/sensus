// Contextos da folha de estudo. Dois, de propósito: os dados determinísticos mudam só com a seleção; a IA muda a
// cada pedaço do stream. O provedor fica em useStudyData.tsx.
import { createContext, useContext } from 'react';
import type { StudyAi, StudyData } from './study-state';

export const DataCtx = createContext<StudyData | null>(null);
export const AiCtx = createContext<StudyAi | null>(null);

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

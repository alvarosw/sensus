// Análise morfológica (STEPBible/TEGMC, código Robinson): classes de palavra e valores gramaticais.
import type { Token } from './types';

/** Classes gramaticais de função (Robinson/STEPBible): artigos, conjunções, preposições, partículas, pronomes. */
export const FUNCTION_POS: ReadonlySet<string> = new Set([
  'T',
  'CONJ',
  'PREP',
  'PRT',
  'INJ',
  'P',
  'R',
  'D',
  'C',
  'I',
  'K',
  'X',
  'S',
  'F',
  'Q',
]);

/** Palavra de conteúdo (substantivo, verbo, adjetivo, advérbio ou código desconhecido), não de função. */
export function isContentToken(t: Pick<Token, 'morph'>): boolean {
  if (!t.morph) return true;
  const pos = t.morph.split('-')[0] ?? '';
  return !FUNCTION_POS.has(pos);
}

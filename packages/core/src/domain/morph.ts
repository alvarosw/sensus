// Morfologia por língua: classe principal, palavra de conteúdo, verbo, nome próprio.
// Grego: código Robinson/STEPBible (V-AAI-3S, N-GSM-P). Hebraico e aramaico: TAHOT/OSHB (HTo, HR/Ncmsa, ANcbsd/Ta).
import type { Token } from '../types';
import { langOfToken } from './language';

/** Classes de função do grego (Robinson/STEPBible). ADV (advérbio) é conteúdo. */
export const GREEK_FUNCTION_POS: ReadonlySet<string> = new Set([
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

/**
 * Classes de função do TAHOT/OSHB, pela letra de classe: C conjunção, R preposição, T partícula (inclui artigo Td,
 * partícula de objeto To, negação Tn, relativa Tr), P pronome, S sufixo. Advérbio (D) é conteúdo, como ADV no grego.
 */
export const SEMITIC_FUNCTION_POS: ReadonlySet<string> = new Set(['C', 'R', 'T', 'P', 'S']);

/**
 * Código da classe principal de um token. No hebraico/aramaico a forma pode ter prefixos (conjunção, preposição,
 * artigo: "HC/To", "HR/Ncmsa") e sufixos (pronome, artigo: "HNcmsc/Sp3ms", "ANcbsd/Ta"). O segmento principal é o
 * primeiro com classe N, A ou V (a palavra lexical); se não houver, o primeiro segmento (forma só de função).
 */
export function mainSegmentOf(token: Pick<Token, 'corpus' | 'morph'>): string {
  const morph = token.morph ?? '';
  if (langOfToken(token) === 'grc') return morph.split('-')[0] ?? '';
  const segments = morph.slice(1).split('/');
  return segments.find((s) => /^[NAV]/.test(s)) ?? segments[0] ?? '';
}

/** Palavra de conteúdo (substantivo, verbo, adjetivo, advérbio ou código desconhecido), não de função. */
export function isContentToken(token: Pick<Token, 'corpus' | 'morph'>): boolean {
  if (!token.morph) return true;
  const main = mainSegmentOf(token);
  if (langOfToken(token) === 'grc') return !GREEK_FUNCTION_POS.has(main);
  return !SEMITIC_FUNCTION_POS.has(main.charAt(0));
}

/** Verbo: classe V (grego e hebraico/aramaico). */
export function isVerbToken(token: Pick<Token, 'corpus' | 'morph'>): boolean {
  if (!token.morph) return false;
  return mainSegmentOf(token).charAt(0) === 'V';
}

/**
 * Nome próprio. Grego: marcação "Name type=" na descrição morfológica (Individual, Location, Title…).
 * Hebraico e aramaico: classe N seguida de p (Np, Npm, Npl, Npt).
 */
export function isProperNameToken(token: Pick<Token, 'corpus' | 'morph' | 'morph_desc'>): boolean {
  if (langOfToken(token) === 'grc') return (token.morph_desc ?? '').includes('Name type=');
  if (!token.morph) return false;
  return mainSegmentOf(token).startsWith('Np');
}

// Interlinear do leitor: o texto original do testamento de cada versículo selecionado (TR no NT, WLC no AT).
import { corpusOfTestament, testamentRange, type Corpus, type Testament, type VerseRange } from '@sensus/core';

export interface OriginalQuery {
  corpus: Corpus;
  range: VerseRange;
}

const TESTAMENTS: readonly Testament[] = ['OT', 'NT'];

/**
 * Consultas do original sob a seleção: uma por testamento que ela toca, com o intervalo cortado às bordas do
 * testamento (a seleção pode atravessar Malaquias e Mateus; cada parte vai ao corpus dela).
 */
export function originalQueries(selection: VerseRange): OriginalQuery[] {
  const out: OriginalQuery[] = [];
  for (const testament of TESTAMENTS) {
    const bounds = testamentRange(testament);
    const start = Math.max(selection.start, bounds.start);
    const end = Math.min(selection.end, bounds.end);
    if (start <= end) out.push({ corpus: corpusOfTestament(testament), range: { start, end } });
  }
  return out;
}

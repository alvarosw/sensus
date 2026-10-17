import { describe, expect, it } from 'vitest';
import { CORPUS, packVid, testamentRange } from '@sensus/core';
import { originalQueries } from './interlinear';

const FP_2_5_8 = { start: packVid(50, 2, 5), end: packVid(50, 2, 8) };
const RS_15_15 = { start: packVid(11, 15, 15), end: packVid(11, 15, 15) };

describe('interlinear do leitor: original por testamento', () => {
  it('NT: a seleção em Filipenses pede o grego (corpus gnt) no intervalo selecionado', () => {
    expect(originalQueries(FP_2_5_8)).toEqual([{ corpus: 'gnt', range: FP_2_5_8 }]);
  });

  it('AT: a seleção em 1 Reis pede o hebraico (corpus hot), não o grego', () => {
    const q = originalQueries(RS_15_15);
    expect(q).toEqual([{ corpus: 'hot', range: RS_15_15 }]);
    expect(CORPUS[q[0]!.corpus].interlinearText).toBe('hbo-wlc');
  });

  it('seleção que atravessa Malaquias e Mateus parte em duas consultas, cada uma no seu corpus', () => {
    const selection = { start: packVid(39, 4, 5), end: packVid(40, 1, 2) };
    const q = originalQueries(selection);
    expect(q).toEqual([
      { corpus: 'hot', range: { start: packVid(39, 4, 5), end: testamentRange('OT').end } },
      { corpus: 'gnt', range: { start: testamentRange('NT').start, end: packVid(40, 1, 2) } },
    ]);
  });

  it('o corte não ultrapassa as bordas do testamento da seleção', () => {
    const q = originalQueries({ start: packVid(1, 1, 1), end: packVid(66, 22, 21) });
    expect(q.map((x) => x.corpus)).toEqual(['hot', 'gnt']);
    expect(q[0]!.range).toEqual(testamentRange('OT'));
    expect(q[1]!.range).toEqual({ start: testamentRange('NT').start, end: packVid(66, 22, 21) });
  });
});

import { describe, expect, it } from 'vitest';
import { addLane, initialLanes, PARALLEL_COMBOS } from './parallel-lanes';

describe('escolha das linhas do paralelo', () => {
  const known = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);

  it('abre só com a linha de origem, mesmo que haja favoritas', () => {
    expect(initialLanes('b', ['a', 'c'], known)).toEqual(['b']);
    expect(initialLanes('zzz', ['a'], known)).toEqual([]);
  });

  it('sem origem, abre com as favoritas (ordem de marcação) até o limite de 6', () => {
    expect(initialLanes(undefined, ['c', 'x', 'a'], known)).toEqual(['c', 'a']);
    expect(initialLanes(undefined, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], known)).toHaveLength(6);
    expect(initialLanes(undefined, [], known)).toEqual([]);
  });

  it('adicionar não repete e para no limite', () => {
    expect(addLane(['a'], 'b')).toEqual(['a', 'b']);
    expect(addLane(['a'], 'a')).toEqual(['a']);
    const full = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(addLane(full, 'g')).toEqual(full);
  });

  it('combinações prontas têm ids únicos e cabem no limite', () => {
    const ids = PARALLEL_COMBOS.flatMap((c) => c.lines);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of PARALLEL_COMBOS) expect(c.lines.length).toBeLessThanOrEqual(6);
  });
});

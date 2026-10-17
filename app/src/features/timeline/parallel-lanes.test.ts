import { describe, expect, it } from 'vitest';
import { PARALLEL_COMBOS } from '@sensus/core';
import { addLane, initialLanes } from './parallel-lanes';

describe('escolha das linhas do paralelo', () => {
  const known = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);

  it('abre só com a linha de origem; sem origem, com nenhuma (a entrada mostra as combinações)', () => {
    expect(initialLanes('b', known)).toEqual(['b']);
    expect(initialLanes('zzz', known)).toEqual([]);
    expect(initialLanes(undefined, known)).toEqual([]);
  });

  it('adicionar não repete e não tem limite de linhas', () => {
    expect(addLane(['a'], 'b')).toEqual(['a', 'b']);
    expect(addLane(['a'], 'a')).toEqual(['a']);
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    expect(addLane(many, 'x')).toEqual([...many, 'x']);
  });

  it('combinações prontas têm ids únicos', () => {
    const ids = PARALLEL_COMBOS.flatMap((c) => c.lines);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

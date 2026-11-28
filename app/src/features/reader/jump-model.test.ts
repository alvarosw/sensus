// Opções do "Ir para": referência, palavra, nome de livro (as duas) e erro; NT e AT.
import { describe, expect, it } from 'vitest';
import { BOOK_TABLE } from '@sensus/core';
import { planJump } from './jump-model';

const FP = BOOK_TABLE[49]!;
const kinds = (s: string) => planJump(s, BOOK_TABLE, FP).options.map((o) => o.kind);

describe('planJump', () => {
  it('referência do NT e do AT: só Ir para', () => {
    expect(kinds('fp 2:5')).toEqual(['goto']);
    const at = planJump('1rs 15:15', BOOK_TABLE, FP).options[0];
    expect(at?.kind === 'goto' && at.ref.book.num).toBe(11);
  });
  it('"2:5" sem livro vale para o livro atual', () => {
    const o = planJump('2:5', BOOK_TABLE, FP).options[0];
    expect(o?.kind === 'goto' && o.ref.book.num).toBe(50);
  });
  it('palavra: só Buscar', () => {
    expect(kinds('graça')).toEqual(['search']);
    expect(kinds('pela graça')).toEqual(['search']);
  });
  it('nome de livro sem número: Ir para (capítulo 1) e Buscar', () => {
    const plan = planJump('joão', BOOK_TABLE, FP);
    expect(plan.options.map((o) => o.kind)).toEqual(['goto', 'search']);
    const go = plan.options[0];
    expect(go?.kind === 'goto' && [go.ref.book.num, go.ref.chapter]).toEqual([43, 1]);
  });
  it('número que não fecha uma referência: erro', () => {
    expect(planJump('xyz 3', BOOK_TABLE, FP)).toEqual({ options: [], bad: true });
    expect(planJump('   ', BOOK_TABLE, FP)).toEqual({ options: [], bad: false });
  });
});

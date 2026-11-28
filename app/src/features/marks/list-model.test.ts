import { describe, expect, it } from 'vitest';
import { makeVid } from '@sensus/core';
import { groupByBook, visibleRange } from './list-model';

const DN_2_4 = makeVid(27, 2, 4);
const DN_2_5 = makeVid(27, 2, 5);
const AT_8_36 = makeVid(44, 8, 36);
const AT_8_37 = makeVid(44, 8, 37);
const AT_8_38 = makeVid(44, 8, 38);
const FP_2_5 = makeVid(50, 2, 5);

describe('intervalo visível de uma marca', () => {
  it('mostra do primeiro ao último versículo que a Bíblia ativa tem (AT aramaico)', () => {
    expect(visibleRange({ start: DN_2_4, end: DN_2_5 }, [DN_2_4, DN_2_5])).toEqual({ start: DN_2_4, end: DN_2_5, missing: false });
    expect(visibleRange({ start: DN_2_4, end: DN_2_5 }, [DN_2_5])).toEqual({ start: DN_2_5, end: DN_2_5, missing: false });
  });

  it('sem versículo na Bíblia ativa (At 8:37 fora de um texto crítico): ausente, com o guardado', () => {
    expect(visibleRange({ start: AT_8_37, end: AT_8_37 }, [])).toEqual({ start: AT_8_37, end: AT_8_37, missing: true });
  });

  it('versículos ausentes no meio ou nas bordas não quebram o intervalo (AT e NT)', () => {
    expect(visibleRange({ start: AT_8_36, end: AT_8_38 }, [AT_8_36, AT_8_38])).toEqual({ start: AT_8_36, end: AT_8_38, missing: false });
    expect(visibleRange({ start: FP_2_5, end: FP_2_5 }, [FP_2_5])).toEqual({ start: FP_2_5, end: FP_2_5, missing: false });
  });
});

describe('agrupamento por livro (ordem bíblica)', () => {
  it('agrupa itens seguidos do mesmo livro, e mantém a ordem (AT antes do NT)', () => {
    const items = [
      { startVid: DN_2_4, id: 1 },
      { startVid: DN_2_5, id: 2 },
      { startVid: FP_2_5, id: 3 },
    ];
    const groups = groupByBook(items);
    expect(groups.map((g) => [g.book, g.items.map((i) => i.id)])).toEqual([
      [27, [1, 2]],
      [50, [3]],
    ]);
  });
});

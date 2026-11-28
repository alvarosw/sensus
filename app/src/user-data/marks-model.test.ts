import { describe, expect, it } from 'vitest';
import { makeVid } from '@sensus/core';
import {
  carve,
  colorAt,
  countByBook,
  filterMarks,
  noteOn,
  notesEndingAt,
  paintPlan,
  sortMarks,
  uniformColor,
  type Mark,
} from './marks-model';

// Fixtures: Fp 2:5-8 (NT grego) e 1Rs 15:15 / Dn 2:4 (AT hebraico e aramaico).
const FP_2_5 = makeVid(50, 2, 5);
const FP_2_6 = makeVid(50, 2, 6);
const FP_2_7 = makeVid(50, 2, 7);
const FP_2_8 = makeVid(50, 2, 8);
const FP_2_9 = makeVid(50, 2, 9);
const RS_15_15 = makeVid(11, 15, 15);
const DN_2_4 = makeVid(27, 2, 4);
const DN_2_5 = makeVid(27, 2, 5);

let nextId = 1;
function mark(startVid: number, endVid: number, extra: Partial<Mark> = {}): Mark {
  return { id: nextId++, startVid, endVid, color: 'amarelo', note: null, createdAt: 1, updatedAt: 1, ...extra };
}
const note = (startVid: number, endVid: number, text = 'texto', extra: Partial<Mark> = {}) =>
  mark(startVid, endVid, { color: null, note: text, ...extra });

describe('recorte e pintura de grifos', () => {
  it('grifo sem sobreposição: só o intervalo novo é adicionado', () => {
    const plan = paintPlan([], FP_2_5, FP_2_8, 'verde', 10);
    expect(plan.remove).toEqual([]);
    expect(plan.add).toEqual([{ startVid: FP_2_5, endVid: FP_2_8, color: 'verde', note: null, createdAt: 10, updatedAt: 10 }]);
  });

  it('grifo novo no meio de um antigo: o antigo volta em duas partes, e o novo vence no meio (NT)', () => {
    const old = mark(FP_2_5, FP_2_9, { color: 'azul' });
    const plan = paintPlan([old], FP_2_6, FP_2_7, 'rosa', 20);
    expect(plan.remove).toEqual([old]);
    const colors = plan.add.map((m) => [m.startVid, m.endVid, m.color]);
    expect(colors).toEqual([
      [FP_2_5, FP_2_5, 'azul'],
      [FP_2_8, FP_2_9, 'azul'],
      [FP_2_6, FP_2_7, 'rosa'],
    ]);
    // a parte que sobrou guarda a data de criação do original
    expect(plan.add[0]!.createdAt).toBe(old.createdAt);
  });

  it('grifo novo que cobre o início do antigo: sobra só a parte depois (AT)', () => {
    const old = mark(DN_2_4, DN_2_5, { color: 'verde' });
    const plan = paintPlan([old], DN_2_4, DN_2_4, 'lilas', 5);
    expect(plan.add.filter((m) => m.color === 'verde').map((m) => [m.startVid, m.endVid])).toEqual([[DN_2_5, DN_2_5]]);
    expect(plan.add.filter((m) => m.color === 'lilas')).toHaveLength(1);
  });

  it('apagar (cor nula) só tira o trecho; notas que tocam o intervalo ficam como estão (AT)', () => {
    const hl = mark(RS_15_15, RS_15_15 + 3, { color: 'verde' });
    const nt = note(RS_15_15, RS_15_15 + 3, 'nota');
    const plan = paintPlan([hl, nt], RS_15_15 + 1, RS_15_15 + 1, null, 9);
    expect(plan.remove).toEqual([hl]);
    expect(plan.add.every((m) => m.note === null)).toBe(true);
    expect(plan.add.map((m) => [m.startVid, m.endVid])).toEqual([
      [RS_15_15, RS_15_15],
      [RS_15_15 + 2, RS_15_15 + 3],
    ]);
  });

  it('carve não cria partes vazias quando o corte é a borda exata', () => {
    const m = mark(FP_2_5, FP_2_8);
    expect(carve(m, FP_2_5, FP_2_8)).toEqual([]);
    expect(carve(m, FP_2_5, FP_2_6)).toEqual([expect.objectContaining({ startVid: FP_2_7, endVid: FP_2_8 })]);
  });
});

describe('cor e nota de um versículo', () => {
  it('colorAt acha o grifo que cobre o versículo (NT e AT)', () => {
    const hl = [mark(FP_2_5, FP_2_8, { color: 'rosa' }), mark(DN_2_4, DN_2_5, { color: 'azul' })];
    expect(colorAt(hl, FP_2_8)).toBe('rosa');
    expect(colorAt(hl, FP_2_9)).toBeNull();
    expect(colorAt(hl, DN_2_5)).toBe('azul');
  });

  it('notesEndingAt considera só o versículo final da nota', () => {
    const notes = [note(FP_2_5, FP_2_8), note(FP_2_6, FP_2_8, 'outra'), note(RS_15_15, RS_15_15 + 1)];
    expect(notesEndingAt(notes, FP_2_8)).toHaveLength(2);
    expect(notesEndingAt(notes, FP_2_5)).toHaveLength(0);
  });

  it('noteOn exige o mesmo intervalo exato', () => {
    const n = note(FP_2_5, FP_2_8);
    expect(noteOn([n], FP_2_5, FP_2_8)).toBe(n);
    expect(noteOn([n], FP_2_5, FP_2_7)).toBeNull();
  });
});

describe('cor uniforme da seleção (ponto na barra)', () => {
  it('um grifo que cobre tudo: a cor', () => {
    expect(uniformColor([mark(FP_2_5, FP_2_9, { color: 'verde' })], FP_2_6, FP_2_8)).toBe('verde');
  });

  it('dois grifos da mesma cor encadeados: a cor; com cor diferente ou buraco: nulo', () => {
    const same = [mark(FP_2_5, FP_2_6, { color: 'verde' }), mark(FP_2_7, FP_2_9, { color: 'verde' })];
    expect(uniformColor(same, FP_2_5, FP_2_9)).toBe('verde');
    const diff = [mark(FP_2_5, FP_2_6, { color: 'verde' }), mark(FP_2_7, FP_2_9, { color: 'rosa' })];
    expect(uniformColor(diff, FP_2_5, FP_2_9)).toBeNull();
    const gap = [mark(FP_2_5, FP_2_6, { color: 'verde' }), mark(FP_2_8, FP_2_9, { color: 'verde' })];
    expect(uniformColor(gap, FP_2_5, FP_2_9)).toBeNull();
  });

  it('sem grifo na seleção: nulo (AT)', () => {
    expect(uniformColor([mark(FP_2_5, FP_2_6)], DN_2_4, DN_2_5)).toBeNull();
  });
});

describe('filtros e ordem da lista Minhas marcas', () => {
  const hl1 = mark(FP_2_5, FP_2_8, { color: 'verde', updatedAt: 500 });
  const hl2 = mark(RS_15_15, RS_15_15, { color: 'azul', updatedAt: 300 });
  const nt1 = note(DN_2_4, DN_2_5, 'nota', { updatedAt: 200 });
  const all = [hl1, hl2, nt1];
  const none = { kind: 'all' as const, colors: [], book: null };

  it('tipo: grifos ou notas', () => {
    expect(filterMarks(all, { ...none, kind: 'highlights' })).toEqual([hl1, hl2]);
    expect(filterMarks(all, { ...none, kind: 'notes' })).toEqual([nt1]);
  });

  it('cores (pode marcar mais de uma) escondem as notas, que não têm cor', () => {
    expect(filterMarks(all, { ...none, colors: ['verde', 'azul'] })).toEqual([hl1, hl2]);
    expect(filterMarks(all, { ...none, colors: ['rosa'] })).toEqual([]);
  });

  it('livro: compara pelo livro do versículo inicial (AT e NT)', () => {
    expect(filterMarks(all, { ...none, book: 50 })).toEqual([hl1]);
    expect(filterMarks(all, { ...none, book: 27 })).toEqual([nt1]);
    expect(countByBook(all)).toEqual(new Map([[50, 1], [11, 1], [27, 1]]));
  });

  it('ordem Recentes: alteradas por último primeiro; ordem bíblica: livro, depois versículo (AT antes de NT)', () => {
    expect(sortMarks(all, 'recent').map((m) => m.id)).toEqual([hl1.id, hl2.id, nt1.id]);
    expect(sortMarks(all, 'biblical').map((m) => m.id)).toEqual([hl2.id, nt1.id, hl1.id]);
  });
});

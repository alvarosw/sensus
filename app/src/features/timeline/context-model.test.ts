import { describe, expect, it } from 'vitest';
import { makeVid } from '@sensus/core';
import {
  anchorIndex,
  contextItems,
  contextRows,
  rowAtYear,
  rulerMarks,
  rulerStep,
  scopeEvents,
  spanFromParams,
  type ContextEvent,
} from './context-model';

// Atos 16:19-26 (o trecho) e outros eventos de Atos e de Romanos.
const span = { start: makeVid(44, 16, 19), end: makeVid(44, 16, 26) };
const ev = (id: string, sortKey: number, first: number, last: number, period?: { id: string; name: string }): ContextEvent => ({
  cite_id: id,
  source_id: 'theographic',
  title: `Evento ${id}`,
  startDate: null,
  sortKey,
  participants: [],
  first_vid: first,
  last_vid: last,
  lines: period ? [{ id: period.id, kind: 'period', name: period.name }] : [],
});

const events: ContextEvent[] = [
  ev('a', 40, makeVid(44, 1, 1), makeVid(44, 1, 26)),
  ev('b', 50, makeVid(44, 16, 6), makeVid(44, 16, 10), { id: 'viagem-2', name: 'Segunda viagem' }),
  ev('c', 51, makeVid(44, 16, 19), makeVid(44, 16, 26), { id: 'viagem-2', name: 'Segunda viagem' }),
  ev('d', 60, makeVid(44, 18, 1), makeVid(44, 18, 3), { id: 'viagem-3', name: 'Terceira viagem' }),
  ev('r', 61, makeVid(45, 1, 1), makeVid(45, 1, 7)),
];

describe('spanFromParams', () => {
  it('lê o intervalo da rota e recusa valores inválidos', () => {
    expect(spanFromParams(String(span.start), String(span.end))).toEqual(span);
    expect(spanFromParams(undefined, '5')).toBeNull();
    expect(spanFromParams('9', '3')).toBeNull();
    expect(spanFromParams('0', '3')).toBeNull();
  });
});

describe('escopo', () => {
  it('livro: só os eventos do livro do trecho; Bíblia inteira: todos', () => {
    const book = 44;
    expect(scopeEvents(events, 'book', book).map((e) => e.cite_id)).toEqual(['a', 'b', 'c', 'd']);
    expect(scopeEvents(events, 'bible', book)).toHaveLength(5);
    // Evento que começa em Lucas e termina em Atos: é de Lucas.
    const cross = ev('cruza', 10, makeVid(42, 24, 1), makeVid(44, 1, 3));
    expect(scopeEvents([cross], 'book', 44)).toHaveLength(0);
  });
});

describe('grupos da fonte', () => {
  it('agrupa eventos do mesmo período na posição do primeiro e marca o grupo do trecho', () => {
    const items = contextItems(scopeEvents(events, 'book', 44), span);
    expect(items.map((i) => (i.kind === 'group' ? `grupo:${i.group.id}` : `evento:${i.event.cite_id}`))).toEqual([
      'evento:a',
      'grupo:viagem-2',
      'grupo:viagem-3',
    ]);
    const viagem2 = items[1];
    expect(viagem2?.kind === 'group' && viagem2.group.inTrecho).toBe(true);
    expect(viagem2?.kind === 'group' && viagem2.group.events.map((e) => e.cite_id)).toEqual(['b', 'c']);
  });

  it('o evento-pai vira o cabeçalho do grupo, sem repetir como evento; sem filhos no escopo, segue como evento', () => {
    // Em ordem cronológica, como chega de Repo.
    const parentEvents = [
      ev('solo', 45, makeVid(44, 1, 1), makeVid(44, 1, 2)),
      ev('pai', 46, makeVid(44, 15, 40), makeVid(44, 18, 22)),
      ev('filho', 47, makeVid(44, 16, 19), makeVid(44, 16, 26), { id: 'pai', name: 'Segunda viagem' }),
    ];
    const items = contextItems(parentEvents, span);
    expect(items.map((i) => (i.kind === 'group' ? `grupo:${i.group.id}:${i.group.name}` : `evento:${i.event.cite_id}`))).toEqual([
      'evento:solo',
      'grupo:pai:Evento pai',
    ]);
    const lonely = contextItems([ev('pai', 46, makeVid(44, 15, 40), makeVid(44, 18, 22)), ev('x', 50, makeVid(44, 19, 1), makeVid(44, 19, 2))], span);
    expect(lonely.map((i) => (i.kind === 'event' ? i.event.cite_id : 'g'))).toEqual(['pai', 'x']);
  });

  it('grupo fechado esconde os eventos; o do trecho começa aberto; o toque sobrepõe o padrão', () => {
    const items = contextItems(scopeEvents(events, 'book', 44), span);
    const rows = contextRows(items, span, {});
    // viagem-2 (contém o trecho) aberta; viagem-3 fechada.
    expect(rows.map((r) => r.key)).toEqual(['e:a', 'g:viagem-2', 'e:b', 'e:c', 'g:viagem-3']);
    const closed = contextRows(items, span, { 'viagem-2': false, 'viagem-3': true });
    expect(closed.map((r) => r.key)).toEqual(['e:a', 'g:viagem-2', 'g:viagem-3', 'e:d']);
  });

  it('marca o que cruza o trecho, inclusive dentro de grupo', () => {
    const rows = contextRows(contextItems(scopeEvents(events, 'book', 44), span), span, {});
    const inTrecho = rows.filter((r) => r.kind === 'event' && r.inTrecho).map((r) => r.key);
    expect(inTrecho).toEqual(['e:c']);
  });
});

describe('âncora da rolagem', () => {
  it('começa no evento do trecho, mesmo dentro de um grupo aberto', () => {
    const rows = contextRows(contextItems(scopeEvents(events, 'book', 44), span), span, {});
    expect(rows[anchorIndex(rows, span)]?.key).toBe('e:c');
  });

  it('sem evento no trecho, vai ao primeiro depois dele; sem nenhum, -1', () => {
    const after = { start: makeVid(44, 20, 1), end: makeVid(44, 20, 5) };
    const rows = contextRows(contextItems(scopeEvents(events, 'book', 44), after), after, {});
    expect(rows[anchorIndex(rows, after)]).toBeUndefined();
    const none = { start: makeVid(66, 1, 1), end: makeVid(66, 1, 2) };
    expect(anchorIndex(contextRows([], none, {}), none)).toBe(-1);
  });
});

describe('régua de anos', () => {
  it('passo que deixa até ~20 marcas', () => {
    expect(rulerStep(30, 60)).toBe(2);
    expect(rulerStep(-1000, 100)).toBe(100);
    expect(rulerStep(-4000, 100)).toBe(250);
  });

  it('marcas alinhadas ao passo, com a densidade de cada faixa', () => {
    const marks = rulerMarks([40, 50, 51, 60, 61]);
    expect(marks[0]?.year).toBe(40);
    expect(marks.reduce((n, m) => n + m.count, 0)).toBe(5);
    expect(marks.every((m) => m.year % rulerStep(40, 61) === 0)).toBe(true);
  });

  it('acha a primeira linha a partir de um ano', () => {
    const rows = contextRows(contextItems(scopeEvents(events, 'book', 44), span), span, {});
    expect(rows[rowAtYear(rows, 51)]?.key).toBe('e:c');
    expect(rowAtYear(rows, 9999)).toBe(-1);
  });
});

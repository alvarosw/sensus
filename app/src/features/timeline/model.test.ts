import { describe, expect, it } from 'vitest';
import {
  clampView,
  cursorTolerance,
  eraById,
  eventInEra,
  eventYear,
  filterEvents,
  filterLines,
  lineInEra,
  matchesEventText,
  nearestPerLane,
  participantNames,
  spanText,
  tickStep,
  xOfYear,
  yearAtX,
  yearText,
  zoomView,
} from './model';

describe('textos de ano', () => {
  it('ano a.C. e d.C. arredondados', () => {
    expect(yearText(-973.89)).toBe('974 a.C.');
    expect(yearText(30.4)).toBe('30 d.C.');
  });

  it('intervalo: mesmo lado do zero, lados diferentes e ano único', () => {
    expect(spanText(-974, -596)).toBe('974–596 a.C.');
    expect(spanText(31, 57)).toBe('31–57 d.C.');
    expect(spanText(-4003, 30)).toBe('4003 a.C. – 30 d.C.');
    expect(spanText(30, 30)).toBe('30 d.C.');
  });

  it('evento usa a data da fonte e cai no sortKey sem data reconhecida', () => {
    expect(eventYear({ startDate: '0047', sortKey: 47.4 })).toBe('47 d.C.');
    expect(eventYear({ startDate: '-4003', sortKey: -4002.99 })).toBe('4003 a.C.');
    expect(eventYear({ startDate: null, sortKey: -596.2 })).toBe('596 a.C.');
  });
});

describe('filtros', () => {
  const lines = [
    { id: 'p', kind: 'person' as const, from: 31, to: 57 },
    { id: 'j', kind: 'period' as const, from: -974, to: -596 },
    { id: 'l', kind: 'place' as const, from: -1054, to: 54 },
  ];

  it('tipo, era e favoritos combinam', () => {
    const favorites = new Set(['p', 'l']);
    expect(filterLines(lines, { kind: 'all', era: null, onlyFavorites: false, favorites }).map((l) => l.id)).toEqual(['p', 'j', 'l']);
    expect(filterLines(lines, { kind: 'place', era: null, onlyFavorites: false, favorites }).map((l) => l.id)).toEqual(['l']);
    expect(filterLines(lines, { kind: 'all', era: eraById('reino-dividido'), onlyFavorites: false, favorites }).map((l) => l.id)).toEqual([
      'j',
      'l',
    ]);
    expect(filterLines(lines, { kind: 'all', era: null, onlyFavorites: true, favorites }).map((l) => l.id)).toEqual(['p', 'l']);
  });

  it('linha que atravessa a era conta; a que termina antes do início não', () => {
    expect(lineInEra({ from: -1054, to: 54 }, eraById('igreja'))).toBe(true);
    expect(lineInEra({ from: -974, to: -596 }, eraById('igreja'))).toBe(false);
    expect(eventInEra(30, eraById('igreja'))).toBe(true);
    expect(eventInEra(30, eraById('vida-de-jesus'))).toBe(false);
  });

  it('eventos: era e favoritos, sem filtro de tipo', () => {
    const events = [
      { cite_id: 'a', sortKey: 35 },
      { cite_id: 'b', sortKey: 40 },
      { cite_id: 'c', sortKey: 5 },
    ];
    expect(filterEvents(events, eraById('igreja'), false, new Set()).map((e) => e.cite_id)).toEqual(['a', 'b']);
    expect(filterEvents(events, null, true, new Set(['c'])).map((e) => e.cite_id)).toEqual(['c']);
  });

  it('era desconhecida ou "all" não filtra', () => {
    expect(eraById('all')).toBeNull();
    expect(eraById(undefined)).toBeNull();
    expect(eraById('nao-existe')).toBeNull();
  });

  it('texto da linha: título ou participante, sem acento', () => {
    const e = { title: 'Paul and Silas imprisoned', participants: [{ name: 'Silas' }] };
    expect(matchesEventText(e, 'PRISON')).toBe(true);
    expect(matchesEventText(e, 'silas')).toBe(true);
    expect(matchesEventText(e, 'ceia')).toBe(false);
    expect(matchesEventText(e, '  ')).toBe(true);
    expect(participantNames([{ name: 'Paul' }, { name: 'Paul' }, { name: 'Silas' }])).toBe('Paul, Silas');
  });
});

describe('paralelo', () => {
  it('viewport fica dentro dos dados e com largura mínima', () => {
    expect(clampView(-9000, -8000)).toEqual({ lo: -4300, hi: -3300 });
    expect(clampView(100, 1000)).toEqual({ lo: -700, hi: 200 });
    expect(clampView(0, 2)).toEqual({ lo: 0, hi: 6 });
  });

  it('zoom mantém o ano sob o dedo no mesmo lugar do eixo', () => {
    const z = zoomView(-100, 100, 0.5, 50);
    expect(z.lo + (z.hi - z.lo) * ((50 - z.lo) / (z.hi - z.lo))).toBeCloseTo(50);
    expect(z.hi - z.lo).toBeCloseTo(100);
  });

  it('passo do eixo deixa rótulos de pelo menos 64 px', () => {
    expect(tickStep(4000, 300)).toBe(1000);
    expect(tickStep(200, 300)).toBe(50);
    expect(tickStep(10, 300)).toBe(5);
  });

  it('ano <-> x e tolerância do cursor', () => {
    expect(xOfYear(0, -100, 100, 10, 200)).toBeCloseTo(110);
    expect(yearAtX(110, -100, 100, 10, 200)).toBeCloseTo(0);
    expect(cursorTolerance(0, 100)).toBeCloseTo(2.5);
    expect(cursorTolerance(0, 10)).toBe(1.5);
  });

  it('evento mais próximo por faixa, dentro da tolerância', () => {
    const lanes = [
      { id: 'judah', events: [{ sortKey: -973 }, { sortKey: -760 }] },
      { id: 'paul', events: [{ sortKey: 40 }] },
      { id: 'empty', events: [] as Array<{ sortKey: number }> },
    ];
    const rows = nearestPerLane(lanes, -761, 2);
    expect(rows.map((r) => [r.id, r.event?.sortKey ?? null])).toEqual([
      ['judah', -760],
      ['paul', null],
      ['empty', null],
    ]);
  });
});

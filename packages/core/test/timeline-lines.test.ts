import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { densityBins, eraSummaries, normalizeSearch, Repo, searchTerms, TIMELINE_ERAS } from '../src/index';
import { createFixtureDb, driverFor } from './fixtures';

// Cronologia completa (linhas do tempo por pessoa, lugar e período). Mesmo padrão de timeline.test.ts.

let db: DatabaseSync;
let repo: Repo;

function insertRow(table: string, row: Record<string, string | number | null>): void {
  const cols = Object.keys(row);
  db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(
    ...cols.map((c) => row[c] ?? null),
  );
}

/**
 * Eventos (sortKey): a 30 (vv 50001010), b 40 (vv 50002005-50003001), c 50 (vv 50002006), d 60 (vv 50004001),
 * e 70 (vv 50004010, parte do período P). P (sortKey 20) é o próprio período: c e e são partOf P.
 */
function seed(): void {
  insertRow('source', {
    id: 'theographic',
    kind: 'entity',
    title: 'Theographic Bible Metadata',
    author: 'Robert Rouse',
    lang: 'en',
    license: 'CC-BY-SA-4.0',
    license_url: null,
    url: 'https://example.test/theographic',
    version: null,
    retrieved_at: '2026-01-01T00:00:00Z',
    attribution: 'Theographic, CC BY-SA 4.0',
    tradition: null,
    notes: null,
  });
  const ev = (id: string, sortKey: number, vids: number[], extra: Record<string, unknown> = {}) => {
    const data = { title: extra.title ?? id, startDate: '0047', sortKey, participants: [], ...extra };
    insertRow('entity', {
      cite_id: `ent:theographic:${id}`,
      source_id: 'theographic',
      type: 'event',
      name: id,
      description: null,
      lat: null,
      lon: null,
      data: JSON.stringify(data),
    });
    for (const vid of vids) insertRow('entity_ref', { entity_cite_id: `ent:theographic:${id}`, vid, token_pos: null });
  };
  const paulo = { cite_id: 'ent:theographic:paul', name: 'Paul' };
  const silas = { cite_id: 'ent:theographic:silas', name: 'Silas' };
  ev('a', 30, [50001010], { title: 'First trip', participants: [paulo] });
  ev('b', 40, [50002005, 50003001], { title: 'Paul and Silas go', participants: [paulo, silas] });
  ev('c', 50, [50002006], {
    title: 'Paul and Silas imprisoned',
    partOf: [{ cite_id: 'ent:theographic:P', name: 'Journey' }],
    participants: [paulo, silas],
  });
  ev('d', 60, [50004001], { title: 'Peter imprisoned', participants: [] });
  ev('e', 70, [50004010], { title: 'Last letter', partOf: [{ cite_id: 'ent:theographic:P', name: 'Journey' }], participants: [paulo] });
  ev('P', 20, [50001001], { title: 'Journey' });
  // Sem timeline ligado a eventos: a pessoa sem linha não entra na lista.
  insertRow('entity', {
    cite_id: 'ent:theographic:paul',
    source_id: 'theographic',
    type: 'person',
    name: 'Paul',
    description: null,
    lat: null,
    lon: null,
    data: JSON.stringify({ timeline: [{ cite_id: 'ent:theographic:b' }, { cite_id: 'ent:theographic:c' }, { cite_id: 'ent:theographic:e' }] }),
  });
  insertRow('entity', {
    cite_id: 'ent:theographic:silas',
    source_id: 'theographic',
    type: 'person',
    name: 'Silas',
    description: null,
    lat: null,
    lon: null,
    data: JSON.stringify({ timeline: [{ cite_id: 'ent:theographic:b' }, { cite_id: 'ent:theographic:c' }] }),
  });
  insertRow('entity', {
    cite_id: 'ent:theographic:nobody',
    source_id: 'theographic',
    type: 'person',
    name: 'Nobody',
    description: null,
    lat: null,
    lon: null,
    data: JSON.stringify({ timeline: [] }),
  });
  insertRow('entity', {
    cite_id: 'ent:theographic:jerusalem',
    source_id: 'theographic',
    type: 'place',
    name: 'Jerusalem',
    description: null,
    lat: null,
    lon: null,
    data: JSON.stringify({ eventsHere: [{ cite_id: 'ent:theographic:c' }, { cite_id: 'ent:theographic:d' }] }),
  });
}

beforeEach(() => {
  db = createFixtureDb();
  repo = new Repo(driverFor(db));
  seed();
});

afterEach(() => {
  db.close();
});

describe('Repo.timelineLines', () => {
  it('lista períodos, pessoas e lugares com id, nome, tipo, contagem e anos (pela ordem de contagem)', async () => {
    const lines = await repo.timelineLines();
    expect(lines).toEqual([
      { id: 'ent:theographic:paul', kind: 'person', name: 'Paul', count: 3, from: 40, to: 70 },
      { id: 'ent:theographic:jerusalem', kind: 'place', name: 'Jerusalem', count: 2, from: 50, to: 60 },
      { id: 'ent:theographic:P', kind: 'period', name: 'Journey', count: 2, from: 50, to: 70 },
      { id: 'ent:theographic:silas', kind: 'person', name: 'Silas', count: 2, from: 40, to: 50 },
    ]);
  });

  it('pessoa sem eventos ligados não aparece', async () => {
    expect((await repo.timelineLines()).some((l) => l.name === 'Nobody')).toBe(false);
  });

  it('banco sem entidades de linha do tempo devolve lista vazia', async () => {
    db.exec('DELETE FROM entity_ref; DELETE FROM entity;');
    expect(await repo.timelineLines()).toEqual([]);
  });
});

describe('Repo.timelineLineEvents', () => {
  it('devolve os eventos da linha em ordem de sortKey, com participantes e primeiro/último versículo', async () => {
    const events = await repo.timelineLineEvents('ent:theographic:paul');
    expect(events.map((e) => [e.cite_id, e.sortKey])).toEqual([
      ['ent:theographic:b', 40],
      ['ent:theographic:c', 50],
      ['ent:theographic:e', 70],
    ]);
    expect(events[0]).toEqual({
      cite_id: 'ent:theographic:b',
      source_id: 'theographic',
      title: 'Paul and Silas go',
      startDate: '0047',
      sortKey: 40,
      participants: [
        { cite_id: 'ent:theographic:paul', name: 'Paul' },
        { cite_id: 'ent:theographic:silas', name: 'Silas' },
      ],
      first_vid: 50002005,
      last_vid: 50003001,
    });
    expect('inRange' in events[0]!).toBe(false);
  });

  it('linha de lugar e de período', async () => {
    expect((await repo.timelineLineEvents('ent:theographic:jerusalem')).map((e) => e.title)).toEqual([
      'Paul and Silas imprisoned',
      'Peter imprisoned',
    ]);
    expect((await repo.timelineLineEvents('ent:theographic:P')).map((e) => e.cite_id)).toEqual(['ent:theographic:c', 'ent:theographic:e']);
  });

  it('evento pelo cite_id; id que não é evento devolve null', async () => {
    expect((await repo.timelineEvent('ent:theographic:d'))?.title).toBe('Peter imprisoned');
    expect(await repo.timelineEvent('ent:theographic:paul')).toBeNull();
  });

  it('linha inexistente devolve lista vazia', async () => {
    expect(await repo.timelineLineEvents('ent:theographic:nao-existe')).toEqual([]);
  });
});

describe('Repo.timelineMemberships', () => {
  it('lista as linhas em que cada evento aparece; evento sem linha não entra no mapa', async () => {
    const map = await repo.timelineMemberships(['ent:theographic:c', 'ent:theographic:d']);
    const ids = map.get('ent:theographic:c')?.map((r) => r.id) ?? [];
    expect(new Set(ids)).toEqual(new Set(['ent:theographic:P', 'ent:theographic:jerusalem', 'ent:theographic:paul', 'ent:theographic:silas']));
    expect(map.get('ent:theographic:d')).toEqual([{ id: 'ent:theographic:jerusalem', kind: 'place', name: 'Jerusalem' }]);
    expect((await repo.timelineMemberships(['ent:theographic:a'])).has('ent:theographic:a')).toBe(false);
  });
});

describe('Repo.timelineSearch', () => {
  it('busca em nomes de linhas (ex.: "paul") e em títulos de eventos, com as linhas de cada evento', async () => {
    const r = await repo.timelineSearch('paul');
    expect(r.lines.map((l) => l.name)).toEqual(['Paul']);
    expect(r.events.map((e) => e.title)).toEqual(['Paul and Silas go', 'Paul and Silas imprisoned']);
    const c = r.events.find((e) => e.cite_id === 'ent:theographic:c')!;
    expect(c.lines.map((l) => l.name)).toEqual(expect.arrayContaining(['Journey', 'Jerusalem', 'Paul', 'Silas']));
  });

  it('termo em português casa com o título em inglês (prisão → imprisoned) e acentos não contam', async () => {
    const r = await repo.timelineSearch('PRISÃO');
    expect(r.events.map((e) => e.title)).toEqual(['Paul and Silas imprisoned', 'Peter imprisoned']);
    expect((await repo.timelineSearch('jerusalem')).lines.map((l) => l.name)).toEqual(['Jerusalem']);
    expect((await repo.timelineSearch('Jerusalém')).lines.map((l) => l.name)).toEqual(['Jerusalem']);
  });

  it('busca vazia ou sem resultado devolve listas vazias', async () => {
    expect(await repo.timelineSearch('   ')).toEqual({ lines: [], events: [] });
    expect(await repo.timelineSearch('zzzz')).toEqual({ lines: [], events: [] });
  });
});

describe('Repo.timelineSummary', () => {
  it('conta os eventos por era; a lacuna intertestamentária aparece com zero', async () => {
    const s = await repo.timelineSummary();
    expect(s.total).toBe(6);
    const sum = s.eras.reduce((n, e) => n + e.count, 0);
    expect(sum).toBe(s.total);
    const gap = s.eras.find((e) => e.gap);
    expect(gap?.id).toBe('intertestamentario');
    expect(gap?.count).toBe(0);
    // a (30), b (40), c (50), d (60) e e (70) caem em "Igreja primitiva" [30, 100); P (20) em "Vida de Jesus" [-5, 30).
    expect(s.eras.find((e) => e.id === 'igreja')?.count).toBe(5);
    expect(s.eras.find((e) => e.id === 'vida-de-jesus')?.count).toBe(1);
    expect(s.eras.find((e) => e.id === 'igreja')?.density).toHaveLength(10);
  });
});

describe('funções puras de cronologia', () => {
  it('densityBins: faixas iguais, limite inferior incluído e superior excluído; fora do intervalo não conta', () => {
    expect(densityBins([0, 1, 2, 3, 4, 5, 10, -1], 0, 10, 2)).toEqual([5, 1]);
    expect(densityBins([0], 0, 0, 4)).toEqual([0, 0, 0, 0]);
    expect(densityBins([9.9], 0, 10, 0)).toEqual([]);
  });

  it('eraSummaries cobre todas as eras e a soma das contagens é o total', () => {
    const summaries = eraSummaries([-3000, -1700, 0, 35, 99]);
    expect(summaries).toHaveLength(TIMELINE_ERAS.length);
    expect(summaries.reduce((n, e) => n + e.count, 0)).toBe(5);
    expect(summaries.every((e) => e.density.length === 10)).toBe(true);
  });

  it('normalizeSearch tira acentos e caixa; searchTerms acrescenta os termos em inglês', () => {
    expect(normalizeSearch('  Jerusalém ')).toBe('jerusalem');
    expect(searchTerms('Paulo')).toEqual(['paulo', 'paul']);
    expect(searchTerms('')).toEqual([]);
    expect(searchTerms('ceia')).toContain('supper');
  });
});

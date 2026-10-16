import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { buildPanel, formatEventDate, Repo } from '../src/index';
import { createFixtureDb, driverFor } from './fixtures';

// Intervalo de teste: Filipenses 2:5-8 (ver fixtures.ts).
const RANGE = { start: 50002005, end: 50002008 };

let db: DatabaseSync;
let repo: Repo;

function event(id: string, sortKey: number, vids: number[], extra: { title?: string; data?: string; name?: string } = {}) {
  const data =
    extra.data ??
    JSON.stringify({
      title: extra.title ?? id,
      startDate: '0047',
      sortKey,
      participants: [{ cite_id: 'ent:isbe-ent:paulo', name: 'Paulo' }],
    });
  return { cite_id: `ent:theographic:${id}`, name: extra.name ?? id, data, vids };
}

/**
 * Eventos na cronologia (sortKey): e1 30, e2 40, e3 50 e e6 80 ... ver a ordem abaixo.
 * Para RANGE: dentro estão e3 (50) e e4 (60); contexto antes e2 (40), e1 (30); depois e5 (70), e6 (80).
 * e0 (5) e e7 (90) ficam de fora do contexto (só 2 para cada lado).
 */
const EVENTS = [
  event('e0', 5, [50001010]),
  event('e1', 30, [50001020]),
  event('e2', 40, [50001030]),
  event('e3', 50, [50002005, 50002008, 50003001], { title: 'Paul and Silas imprisoned' }),
  event('e4', 60, [50002006]),
  event('e5', 70, [50003005]),
  event('e6', 80, [50004001]),
  event('e7', 90, [50004010]),
];

function insertRow(table: string, row: Record<string, string | number | null>): void {
  const cols = Object.keys(row);
  db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(
    ...cols.map((c) => row[c] ?? null),
  );
}

function seedSource(): void {
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
}

function seedEvents(events: ReturnType<typeof event>[]): void {
  for (const e of events) {
    insertRow('entity', { cite_id: e.cite_id, source_id: 'theographic', type: 'event', name: e.name, description: null, lat: null, lon: null, data: e.data });
    for (const vid of e.vids) insertRow('entity_ref', { entity_cite_id: e.cite_id, vid, token_pos: null });
  }
}

beforeEach(() => {
  db = createFixtureDb();
  repo = new Repo(driverFor(db));
  seedSource();
  seedEvents(EVENTS);
});

afterEach(() => {
  db.close();
});

describe('formatEventDate', () => {
  it('anos antes de Cristo: "-4003" → "4003 a.C."', () => {
    expect(formatEventDate('-4003')).toBe('4003 a.C.');
    expect(formatEventDate('-974')).toBe('974 a.C.');
    expect(formatEventDate('-9')).toBe('9 a.C.');
  });

  it('anos depois de Cristo, com ou sem mês e dia', () => {
    expect(formatEventDate('0047')).toBe('47 d.C.');
    expect(formatEventDate('0047-05-01')).toBe('47 d.C.');
    expect(formatEventDate('0047-5-1')).toBe('47 d.C.');
    expect(formatEventDate('9')).toBe('9 d.C.');
    expect(formatEventDate('0057')).toBe('57 d.C.');
  });

  it('formato não reconhecido, ausente ou ano zero devolvem null', () => {
    expect(formatEventDate(null)).toBeNull();
    expect(formatEventDate(undefined)).toBeNull();
    expect(formatEventDate('')).toBeNull();
    expect(formatEventDate('ontem')).toBeNull();
    expect(formatEventDate('0000')).toBeNull();
  });
});

describe('Repo.timelineEvents', () => {
  it('devolve os eventos do intervalo em ordem cronológica, com campos já lidos', async () => {
    const events = await repo.timelineEvents(RANGE);
    const inRange = events.filter((e) => e.inRange);
    expect(inRange.map((e) => e.cite_id)).toEqual(['ent:theographic:e3', 'ent:theographic:e4']);

    const e3 = inRange[0]!;
    expect(e3).toEqual({
      cite_id: 'ent:theographic:e3',
      source_id: 'theographic',
      title: 'Paul and Silas imprisoned',
      startDate: '0047',
      sortKey: 50,
      participants: [{ cite_id: 'ent:isbe-ent:paulo', name: 'Paulo' }],
      // Primeiro e último versículo do evento inteiro, não só os do intervalo.
      first_vid: 50002005,
      last_vid: 50003001,
      inRange: true,
    });
  });

  it('inclui até 2 eventos de contexto antes e 2 depois, na ordem cronológica, marcados inRange=false', async () => {
    const events = await repo.timelineEvents(RANGE);
    expect(events.map((e) => [e.cite_id.split(':')[2], e.inRange])).toEqual([
      ['e1', false],
      ['e2', false],
      ['e3', true],
      ['e4', true],
      ['e5', false],
      ['e6', false],
    ]);
  });

  it('sem eventos no intervalo, devolve lista vazia (nem contexto)', async () => {
    // Filipenses 2:10-11 não tem eventos ligados, apesar de haver eventos perto na cronologia.
    expect(await repo.timelineEvents({ start: 50002010, end: 50002011 })).toEqual([]);
  });

  it('usa o nome do registro quando o JSON não traz título; ignora evento sem JSON válido', async () => {
    seedEvents([
      event('sem-titulo', 55, [50002007], { data: JSON.stringify({ sortKey: 55 }), name: 'Evento sem título' }),
      event('json-quebrado', 56, [50002007], { data: '{não é json' }),
    ]);
    const events = await repo.timelineEvents(RANGE);
    const inRange = events.filter((e) => e.inRange).map((e) => [e.cite_id, e.title]);
    expect(inRange).toEqual([
      ['ent:theographic:e3', 'Paul and Silas imprisoned'],
      ['ent:theographic:sem-titulo', 'Evento sem título'],
      ['ent:theographic:e4', 'e4'],
    ]);
  });

  it('banco sem eventos (ex.: o leitor, com entity vazia) devolve lista vazia sem erro', async () => {
    db.exec('DELETE FROM entity_ref; DELETE FROM entity;');
    expect(await repo.timelineEvents(RANGE)).toEqual([]);
  });
});

describe('buildPanel com linha do tempo', () => {
  it('expõe os eventos em layers.historical.events e inclui a fonte Theographic', async () => {
    const panel = await buildPanel(repo, RANGE);
    expect(panel.layers.historical.events).toEqual(await repo.timelineEvents(RANGE));
    expect(panel.sources.theographic?.license).toBe('CC-BY-SA-4.0');
  });

  it('sem eventos no intervalo, a linha do tempo fica vazia e a fonte não aparece pelo evento', async () => {
    const panel = await buildPanel(repo, { start: 50002010, end: 50002011 });
    expect(panel.layers.historical.events).toEqual([]);
    expect(panel.sources.theographic).toBeUndefined();
  });
});

// Nomes em português (entity_name): escolha do nome a mostrar (domínio), consultas do Repo com e sem a tabela,
// participantes da linha do tempo e nome pt do lugar agrupado. NT grego (Paulo, Filipos) e AT hebraico (Arão).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { groupPlaces, Repo, shownEntityName } from '../src/index';
import { createFixtureDb, driverFor, insert, source } from './fixtures';
import { seedOldTestament } from './fixtures-ot';

const VID_NT = 50002005; // Fp 2:5
const VID_AT = 2004014; // Êx 4:14
const ARAO = 'ent:isbe-ent:arao';

describe('shownEntityName (domínio)', () => {
  it('NT: Paulo com nome pt mostra o pt, sem marca de tradução', () => {
    expect(shownEntityName({ name: 'Paul', namePt: 'Paulo' }, true)).toEqual({ text: 'Paulo', pt: true });
  });

  it('AT: Aaron com nome pt mostra Arão; "Ver original" (preferPt falso) mostra o inglês', () => {
    expect(shownEntityName({ name: 'Aaron', namePt: 'Arão' }, true)).toEqual({ text: 'Arão', pt: true });
    expect(shownEntityName({ name: 'Aaron', namePt: 'Arão' }, false)).toEqual({ text: 'Aaron', pt: false });
  });

  it('sem nome pt (null, ausente ou só espaços) vale o nome da fonte', () => {
    expect(shownEntityName({ name: 'Jochebed', namePt: null }, true)).toEqual({ text: 'Jochebed', pt: false });
    expect(shownEntityName({ name: 'Jochebed' }, true)).toEqual({ text: 'Jochebed', pt: false });
    expect(shownEntityName({ name: 'Jochebed', namePt: '  ' }, true)).toEqual({ text: 'Jochebed', pt: false });
  });
});

describe('Repo com entity_name', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createFixtureDb();
    seedOldTestament(db);
    insert(db, 'entity', [
      { cite_id: ARAO, source_id: 'isbe-ent', type: 'person', name: 'Aaron', description: 'Irmão de Moisés.' },
    ]);
    insert(db, 'entity_ref', [{ entity_cite_id: ARAO, vid: VID_AT, token_pos: null }]);
    insert(db, 'source', [source('sensus-nomes-pt', 'entity', 'Nomes em português', { lang: 'pt' }), source('theographic', 'entity', 'Theographic', { lang: 'en' })]);
  });

  afterEach(() => {
    db.close();
  });

  it('banco sem a tabela: consultas funcionam e namePt vem null (comportamento de antes)', async () => {
    db.exec('DROP TABLE entity_name'); // o esquema de teste já traz a tabela; aqui simula um banco antigo
    const repo = new Repo(driverFor(db));
    const hits = await repo.entities({ start: VID_AT, end: VID_AT });
    expect(hits.map((h) => [h.name, h.namePt])).toEqual([['Aaron', null]]);
    const cited = await repo.resolveCite(ARAO);
    expect(cited?.table === 'entity' && cited.record.namePt).toBe(null);
  });

  it('com a tabela: a linha de língua pt vence; entidade sem linha mantém o nome da fonte', async () => {
    insert(db, 'entity_name', [
      { cite_id: ARAO, lang: 'pt', name: 'Arão', source_id: 'sensus-nomes-pt' },
      { cite_id: ARAO, lang: 'en', name: 'Aaron (en)', source_id: 'sensus-nomes-pt' },
    ]);
    const repo = new Repo(driverFor(db));
    const hits = await repo.entities({ start: VID_AT, end: VID_AT });
    expect(hits.map((h) => [h.name, h.namePt])).toEqual([['Aaron', 'Arão']]);

    const nt = await repo.entities({ start: VID_NT, end: VID_NT });
    expect(nt.every((h) => h.namePt === null)).toBe(true);
    const cited = await repo.resolveCite(ARAO);
    expect(cited?.table === 'entity' && cited.record.namePt).toBe('Arão');
  });

  it('participantes de evento da linha do tempo carregam o nome pt pelo cite_id', async () => {
    insert(db, 'entity_name', [{ cite_id: ARAO, lang: 'pt', name: 'Arão', source_id: 'sensus-nomes-pt' }]);
    const evento = 'ent:theographic:evento-exodo';
    insert(db, 'entity', [
      {
        cite_id: evento,
        source_id: 'theographic',
        type: 'event',
        name: 'Exodus',
        data: JSON.stringify({
          title: 'Exodus',
          startDate: '-1446',
          sortKey: 1446,
          participants: [{ cite_id: ARAO, name: 'Aaron' }, { cite_id: 'ent:theographic:sem-linha', name: 'Nobody' }],
        }),
      },
    ]);
    insert(db, 'entity_ref', [{ entity_cite_id: evento, vid: VID_AT, token_pos: null }]);
    const repo = new Repo(driverFor(db));
    const [ev] = await repo.timelineEvents({ start: VID_AT, end: VID_AT });
    expect(ev?.participants.map((p) => [p.name, p.namePt])).toEqual([
      ['Aaron', 'Arão'],
      ['Nobody', null],
    ]);
  });
});

describe('groupPlaces com nome pt', () => {
  const hit = (over: Partial<Parameters<typeof groupPlaces>[0][number]>) => ({
    cite_id: 'ent:openbible-geo:x',
    source_id: 'openbible-geo',
    type: 'place' as const,
    name: 'Philippi',
    description: null,
    lat: 40.8,
    lon: 24.0,
    data: null,
    vid: VID_NT,
    namePt: null,
    ...over,
  });

  it('o lugar leva o nome pt de qualquer uma das fontes que o agrupam', () => {
    const [site] = groupPlaces([
      hit({ cite_id: 'a', source_id: 'openbible-geo', namePt: null }),
      hit({ cite_id: 'b', source_id: 'theographic', name: 'Philippi', lat: 40.81, lon: 24.01, namePt: 'Filipos' }),
    ]);
    expect(site?.namePt).toBe('Filipos');
    expect(site?.name).toBe('Philippi');
  });

  it('sem nome pt em nenhuma fonte, o lugar fica com null', () => {
    const [site] = groupPlaces([hit({ namePt: null })]);
    expect(site?.namePt).toBeNull();
  });
});

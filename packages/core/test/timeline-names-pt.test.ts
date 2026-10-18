// Títulos e nomes pt na linha do tempo: escolha do título (domínio), regra de casamento da busca e consultas com e
// sem a tabela entity_name. NT grego (Crucificação, Mt 27) e AT hebraico (Morte de Saul, 1Sm 31; Arão, Êx 4).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { matchesSearchName, Repo, shownEventTitle } from '../src/index';
import { createFixtureDb, driverFor, insert, source } from './fixtures';

const VID_AT = 9031006; // 1Sm 31:6 (Saul)
const VID_NT = 40027038; // Mt 27:38 (crucificação)
const ARAO = 'ent:theographic:aaron';
const JOQUEBEDE = 'ent:theographic:jochebed';
const SAUL = 'ent:theographic:saul-death';
const CRUZ = 'ent:theographic:crucifixion';

describe('shownEventTitle (domínio)', () => {
  it('AT: "Death of Saul" com título pt mostra "Morte de Saul"; "Ver original" mostra o inglês', () => {
    expect(shownEventTitle({ title: 'Death of Saul', namePt: 'Morte de Saul' }, true)).toEqual({ text: 'Morte de Saul', pt: true });
    expect(shownEventTitle({ title: 'Death of Saul', namePt: 'Morte de Saul' }, false)).toEqual({ text: 'Death of Saul', pt: false });
  });

  it('NT: "Crucifixion" com título pt mostra "Crucificação"; sem título pt (null) vale o inglês', () => {
    expect(shownEventTitle({ title: 'Crucifixion', namePt: 'Crucificação' }, true)).toEqual({ text: 'Crucificação', pt: true });
    expect(shownEventTitle({ title: 'Crucifixion', namePt: null }, true)).toEqual({ text: 'Crucifixion', pt: false });
    expect(shownEventTitle({ title: 'Crucifixion' }, true)).toEqual({ text: 'Crucifixion', pt: false });
  });
});

describe('matchesSearchName (regra de casamento)', () => {
  it('ignora acento e caixa: "arao" acha "Arão", "joquebede" acha "Joquebede", "ESTEVAO" acha "Estêvão"', () => {
    expect(matchesSearchName('Arão', 'arao')).toBe(true);
    expect(matchesSearchName('Joquebede', 'joquebede')).toBe(true);
    expect(matchesSearchName('Estêvão', 'ESTEVAO')).toBe(true);
  });

  it('casa por trecho, com espaços: "morte de saul" acha "Morte de Saul"', () => {
    expect(matchesSearchName('Morte de Saul', 'morte de saul')).toBe(true);
    expect(matchesSearchName('Morte de Saul', 'saul')).toBe(true);
  });

  it('não casa o que não está no nome; busca vazia e nome ausente não casam', () => {
    expect(matchesSearchName('Arão', 'moises')).toBe(false);
    expect(matchesSearchName('Arão', '   ')).toBe(false);
    expect(matchesSearchName(null, 'arao')).toBe(false);
    expect(matchesSearchName(undefined, 'arao')).toBe(false);
  });
});

describe('Repo: busca com nomes pt', () => {
  let db: DatabaseSync;
  let repo: Repo;

  function seed(): void {
    insert(db, 'source', [
      source('theographic', 'entity', 'Theographic Bible Metadata', { lang: 'en' }),
      source('sensus-nomes-pt', 'entity', 'Nomes em português', { lang: 'pt' }),
    ]);
    const ev = (cite: string, title: string, sortKey: number, vid: number, participants: object[] = []) => {
      insert(db, 'entity', [
        {
          cite_id: cite,
          source_id: 'theographic',
          type: 'event',
          name: title,
          data: JSON.stringify({ title, startDate: String(sortKey), sortKey, participants }),
        },
      ]);
      insert(db, 'entity_ref', [{ entity_cite_id: cite, vid, token_pos: null }]);
    };
    const aaron = { cite_id: ARAO, name: 'Aaron' };
    ev(SAUL, 'Death of Saul', -1011, VID_AT, [aaron]);
    ev(CRUZ, 'Crucifixion', 30, VID_NT);
    insert(db, 'entity', [
      { cite_id: ARAO, source_id: 'theographic', type: 'person', name: 'Aaron', data: JSON.stringify({ timeline: [{ cite_id: SAUL }] }) },
      { cite_id: JOQUEBEDE, source_id: 'theographic', type: 'person', name: 'Jochebed', data: JSON.stringify({ timeline: [{ cite_id: SAUL }] }) },
    ]);
  }

  function namesPt(): void {
    insert(db, 'entity_name', [
      { cite_id: ARAO, lang: 'pt', name: 'Arão', source_id: 'sensus-nomes-pt' },
      { cite_id: JOQUEBEDE, lang: 'pt', name: 'Joquebede', source_id: 'sensus-nomes-pt' },
      { cite_id: SAUL, lang: 'pt', name: 'Morte de Saul', source_id: 'sensus-nomes-pt' },
      { cite_id: CRUZ, lang: 'pt', name: 'Crucificação', source_id: 'sensus-nomes-pt' },
    ]);
  }

  beforeEach(() => {
    db = createFixtureDb();
    seed();
    namesPt();
    repo = new Repo(driverFor(db));
  });

  afterEach(() => {
    db.close();
  });

  it('"Arão" acha a linha de Aaron (pelo nome pt), sem acento e com acento', async () => {
    for (const q of ['arao', 'Arão']) {
      const res = await repo.timelineSearch(q);
      expect(res.lines.map((l) => [l.name, l.namePt])).toEqual([['Aaron', 'Arão']]);
    }
  });

  it('"joquebede" (sem acento e minúscula) acha a linha de Jochebed', async () => {
    const res = await repo.timelineSearch('joquebede');
    expect(res.lines.map((l) => l.name)).toEqual(['Jochebed']);
  });

  it('"morte de saul" acha o evento pelo título pt, que vem com namePt e os participantes pt', async () => {
    const res = await repo.timelineSearch('morte de saul');
    expect(res.events.map((e) => [e.title, e.namePt])).toEqual([['Death of Saul', 'Morte de Saul']]);
    expect(res.events[0]!.participants.map((p) => [p.name, p.namePt])).toEqual([['Aaron', 'Arão']]);
  });

  it('o título pt também casa com a palavra solta, e o título em inglês continua casando', async () => {
    expect((await repo.timelineSearch('crucificacao')).events.map((e) => e.title)).toEqual(['Crucifixion']);
    expect((await repo.timelineSearch('saul')).events.map((e) => e.title)).toEqual(['Death of Saul']);
  });

  it('o seletor "+ Linha" também acha pelo nome pt', async () => {
    const lines = await repo.timelineSearchLines('arao');
    expect(lines.map((l) => [l.name, l.namePt])).toEqual([['Aaron', 'Arão']]);
  });

  it('a linha que casa pelo nome pt traz a contagem de eventos da linha', async () => {
    const [line] = await repo.timelineSearchLines('joquebede');
    expect(line?.count).toBe(1);
  });

  it('banco sem a tabela entity_name: busca como antes, sem erro (pt não casa, inglês casa)', async () => {
    db.exec('DROP TABLE entity_name');
    const repo2 = new Repo(driverFor(db));
    expect((await repo2.timelineSearch('arao')).lines).toEqual([]);
    expect((await repo2.timelineSearch('paul')).lines).toEqual([]);
    expect((await repo2.timelineSearch('aaron')).lines.map((l) => [l.name, l.namePt])).toEqual([['Aaron', null]]);
    expect((await repo2.timelineSearch('saul')).events.map((e) => e.namePt)).toEqual([null]);
    expect(await repo2.timelineSearchLines('arao')).toEqual([]);
  });
});

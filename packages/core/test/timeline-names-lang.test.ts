// Busca na linha do tempo com o nome na língua do app (Repo.nameLang): chinês (亚伦), árabe (هارون) e hindi (हारून),
// com busca parcial. NT (Crucificação, Mt 27) e AT (Morte de Saul, 1Sm 31; Aarão, Êx 4) como nas outras suítes.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { Repo } from '../src/index';
import { createFixtureDb, driverFor, insert, source } from './fixtures';

const ARAO = 'ent:theographic:aaron';
const SAUL = 'ent:theographic:saul-death';
const CRUZ = 'ent:theographic:crucifixion';
const VID_AT = 9031006; // 1Sm 31:6
const VID_NT = 40027038; // Mt 27:38

describe('Repo: busca na linha do tempo com nomes em outras línguas', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createFixtureDb();
    insert(db, 'source', [
      source('theographic', 'entity', 'Theographic Bible Metadata', { lang: 'en' }),
      source('sensus-nomes-zh', 'entity', '名字', { lang: 'zh' }),
      source('sensus-nomes-ar', 'entity', 'الأسماء', { lang: 'ar' }),
      source('sensus-nomes-hi', 'entity', 'नाम', { lang: 'hi' }),
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
    ev(SAUL, 'Death of Saul', -1011, VID_AT, [{ cite_id: ARAO, name: 'Aaron' }]);
    ev(CRUZ, 'Crucifixion', 30, VID_NT);
    insert(db, 'entity', [
      { cite_id: ARAO, source_id: 'theographic', type: 'person', name: 'Aaron', data: JSON.stringify({ timeline: [{ cite_id: SAUL }] }) },
    ]);
    insert(db, 'entity_name', [
      { cite_id: ARAO, lang: 'zh', name: '亚伦', source_id: 'sensus-nomes-zh' },
      { cite_id: ARAO, lang: 'ar', name: 'هارون', source_id: 'sensus-nomes-ar' },
      { cite_id: ARAO, lang: 'hi', name: 'हारून', source_id: 'sensus-nomes-hi' },
    ]);
  });

  afterEach(() => {
    db.close();
  });

  it('zh: "亚伦" e a busca parcial "亚" acham a linha de Aaron, com o nome zh', async () => {
    const repo = new Repo(driverFor(db), { nameLang: 'zh' });
    for (const q of ['亚伦', '亚']) {
      const res = await repo.timelineSearch(q);
      expect(res.lines.map((l) => [l.name, l.namePt])).toEqual([['Aaron', '亚伦']]);
    }
  });

  it('ar: "هارون" e a busca parcial "هار" acham a linha de Aaron', async () => {
    const repo = new Repo(driverFor(db), { nameLang: 'ar' });
    expect((await repo.timelineSearch('هارون')).lines.map((l) => l.namePt)).toEqual(['هارون']);
    expect((await repo.timelineSearch('هار')).lines.map((l) => l.name)).toEqual(['Aaron']);
  });

  it('hi: "हारून" e a busca parcial "हार" acham a linha de Aaron (sinais vocálicos não atrapalham)', async () => {
    const repo = new Repo(driverFor(db), { nameLang: 'hi' });
    expect((await repo.timelineSearch('हारून')).lines.map((l) => l.namePt)).toEqual(['हारून']);
    expect((await repo.timelineSearch('हार')).lines.map((l) => l.name)).toEqual(['Aaron']);
  });

  it('o nome de outra língua não casa: com nameLang zh, a busca em árabe ou hindi não acha Aaron', async () => {
    const repo = new Repo(driverFor(db), { nameLang: 'zh' });
    expect((await repo.timelineSearch('هارون')).lines).toEqual([]);
    expect((await repo.timelineSearch('हारून')).lines).toEqual([]);
  });

  it('com nameLang hi, o participante do AT sai com o nome hi; o NT sem linha na língua mostra o título da fonte', async () => {
    const repo = new Repo(driverFor(db), { nameLang: 'hi' });
    const res = await repo.timelineSearch('saul');
    expect(res.events.map((e) => [e.title, e.namePt])).toEqual([['Death of Saul', null]]);
    expect(res.events[0]!.participants.map((p) => [p.name, p.namePt])).toEqual([['Aaron', 'हारून']]);
    const cruz = await repo.timelineSearch('crucifixion');
    expect(cruz.events.map((e) => [e.title, e.namePt])).toEqual([['Crucifixion', null]]);
  });
});

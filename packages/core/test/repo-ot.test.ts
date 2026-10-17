// Consultas do Repo no AT: léxico TBESH, concordância de H0935 e resolução de cite_id hebraico.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { Repo } from '../src/index';
import { createFixtureDb, driverFor } from './fixtures';
import { CONCORDANCE_VIDS_H0935, VID_1KGS_15_15, VID_DAN_2_4, seedOldTestament } from './fixtures-ot';

const RANGE_1KGS = { start: VID_1KGS_15_15, end: VID_1KGS_15_15 };

let db: DatabaseSync;
let repo: Repo;

beforeEach(() => {
  db = createFixtureDb();
  seedOldTestament(db);
  repo = new Repo(driverFor(db));
});

afterEach(() => {
  db.close();
});

describe('Repo no AT', () => {
  it('lexicon(H0935) devolve todas as variantes de sufixo do TBESH, na ordem G..P', async () => {
    const entries = await repo.lexicon(['H0935']);
    expect(entries.map((e) => e.cite_id)).toEqual([
      'lex:stepbible-tbesh:H0935G',
      'lex:stepbible-tbesh:H0935H',
      'lex:stepbible-tbesh:H0935I',
      'lex:stepbible-tbesh:H0935J',
      'lex:stepbible-tbesh:H0935K',
      'lex:stepbible-tbesh:H0935L',
      'lex:stepbible-tbesh:H0935M',
      'lex:stepbible-tbesh:H0935N',
      'lex:stepbible-tbesh:H0935O',
      'lex:stepbible-tbesh:H0935P',
    ]);
    expect(entries.every((e) => e.strong_base === 'H0935' && e.lang === 'en')).toBe(true);
  });

  it('lexicon(H0935) inclui H0935G e H0935P com o verbete e a glosa do TBESH', async () => {
    const [g, p] = [
      (await repo.lexicon(['H0935'])).find((e) => e.key === 'H0935G'),
      (await repo.lexicon(['H0935'])).find((e) => e.key === 'H0935P'),
    ];
    expect(g?.gloss).toBe('to come (in): come');
    expect(p?.gloss).toBe('to come (in): bring');
    expect(p?.definition.startsWith(': bring/take_in')).toBe(true);
  });

  it('concordance(H0935) conta os versículos da fixture e traz exemplos ordenados por vid', async () => {
    const all = await repo.concordance('H0935', 'blivre', 3);
    expect(all.count).toBe(CONCORDANCE_VIDS_H0935.length + 1);
    expect(all.samples.map((s) => s.vid)).toEqual([1002019, 1004003, 1006004]);
    expect(all.samples.every((s) => s.source_id === 'blivre')).toBe(true);
  });

  it('concordance(H0935) exclui o intervalo dos exemplos sem mudar o total', async () => {
    const others = await repo.concordance('H0935', 'blivre', 10, RANGE_1KGS);
    expect(others.count).toBe(CONCORDANCE_VIDS_H0935.length + 1);
    expect(others.samples.map((s) => s.vid)).toEqual([...CONCORDANCE_VIDS_H0935]);
  });

  it('concordance de um Strong do AT sem ocorrências na fixture dá zero', async () => {
    expect(await repo.concordance('H9999', 'blivre', 3)).toEqual({ count: 0, samples: [] });
  });

  it('resolveCite acha as palavras hebraicas pelo cite_id tok:hot', async () => {
    const hit = await repo.resolveCite(`tok:hot:${VID_1KGS_15_15}:1`);
    expect(hit?.table).toBe('token');
    expect(hit && 'strong' in hit.record ? hit.record.strong : null).toBe('H0935P');
    expect(hit && 'translit' in hit.record ? hit.record.translit : null).toBe("vai.ya.Ve'");

    const obj = await repo.resolveCite(`tok:hot:${VID_1KGS_15_15}:2`);
    expect(obj && 'morph' in obj.record ? obj.record.morph : null).toBe('HTo');

    const aram = await repo.resolveCite(`tok:hot:${VID_DAN_2_4}:10`);
    expect(aram && 'editions' in aram.record ? aram.record.editions : null).toBe('Q');
  });

  it('resolveCite recusa tok:hot com posição inexistente ou vid errado', async () => {
    expect(await repo.resolveCite(`tok:hot:${VID_1KGS_15_15}:99`)).toBeNull();
    expect(await repo.resolveCite('tok:hot:1:1')).toBeNull();
  });

  it('resolveCite acha os textos e o verbete do AT', async () => {
    expect((await repo.resolveCite(`txt:hbo-wlc:${VID_1KGS_15_15}`))?.table).toBe('verse_text');
    expect((await repo.resolveCite(`txt:kjv:${VID_DAN_2_4}`))?.table).toBe('verse_text');
    expect((await repo.resolveCite('lex:stepbible-tbesh:H0935P'))?.table).toBe('lexicon_entry');
  });
});

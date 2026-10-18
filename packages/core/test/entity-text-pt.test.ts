// Descrições em português (entity_text): escolha da descrição a mostrar (domínio) e consultas do Repo com e sem a
// tabela. AT hebraico (Arão, Êx 4:14) e NT grego (Paulo, Fp 2:5).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { Repo, shownDescription } from '../src/index';
import { createFixtureDb, driverFor, insert, source } from './fixtures';

const VID_AT = 2004014; // Êx 4:14
const VID_NT = 50002005; // Fp 2:5
const ARAO = 'ent:isbe-ent:arao';
const PAULO = 'ent:isbe-ent:paulo';

describe('shownDescription (domínio)', () => {
  it('AT: Aaron com descrição pt mostra a pt; "Ver original" (preferPt falso) mostra o inglês', () => {
    const e = { description: 'Brother of Moses.', descriptionPt: 'Irmão de Moisés.' };
    expect(shownDescription(e, true)).toEqual({ text: 'Irmão de Moisés.', pt: true });
    expect(shownDescription(e, false)).toEqual({ text: 'Brother of Moses.', pt: false });
  });

  it('NT: Paulo sem descrição pt (null) mostra a da fonte; pt só de espaços conta como ausente', () => {
    expect(shownDescription({ description: 'Apóstolo, autor da carta.', descriptionPt: null }, true)).toEqual({
      text: 'Apóstolo, autor da carta.',
      pt: false,
    });
    expect(shownDescription({ description: 'Apóstolo, autor da carta.', descriptionPt: '  ' }, true)).toEqual({
      text: 'Apóstolo, autor da carta.',
      pt: false,
    });
  });

  it('sem nenhuma descrição (ou só pt, sem a inglesa), o que houver; nada vira null', () => {
    expect(shownDescription({ description: null }, true)).toBe(null);
    expect(shownDescription({ description: '', descriptionPt: null }, false)).toBe(null);
    expect(shownDescription({ description: null, descriptionPt: 'Apóstolo.' }, false)).toEqual({ text: 'Apóstolo.', pt: true });
  });
});

describe('Repo com entity_text', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createFixtureDb();
    insert(db, 'source', [source('sensus-descricoes-pt', 'entity', 'Descrições em português', { lang: 'pt' })]);
    insert(db, 'entity', [
      { cite_id: ARAO, source_id: 'isbe-ent', type: 'person', name: 'Aaron', description: 'Brother of Moses.' },
    ]);
    insert(db, 'entity_ref', [{ entity_cite_id: ARAO, vid: VID_AT, token_pos: null }]);
  });

  afterEach(() => {
    db.close();
  });

  it('banco sem a tabela: consultas funcionam e descriptionPt vem null (a descrição da fonte segue)', async () => {
    db.exec('DROP TABLE IF EXISTS entity_text'); // banco baixado antes da tabela existir
    const repo = new Repo(driverFor(db));
    const hits = await repo.entities({ start: VID_AT, end: VID_AT });
    expect(hits.map((h) => [h.name, h.description, h.descriptionPt])).toEqual([['Aaron', 'Brother of Moses.', null]]);
    const nt = await repo.entities({ start: VID_NT, end: VID_NT });
    expect(nt.map((h) => h.descriptionPt)).toEqual([null]);
    const cited = await repo.resolveCite(ARAO);
    expect(cited?.table === 'entity' && cited.record.descriptionPt).toBe(null);
  });

  it('com a tabela: a linha pt vence; entidade sem linha fica com null (e a descrição da fonte)', async () => {
    db.exec('CREATE TABLE IF NOT EXISTS entity_text (cite_id TEXT NOT NULL, lang TEXT NOT NULL, description TEXT NOT NULL, source_id TEXT NOT NULL, PRIMARY KEY (cite_id, lang))');
    insert(db, 'entity_text', [{ cite_id: ARAO, lang: 'pt', description: 'Irmão de Moisés.', source_id: 'sensus-descricoes-pt' }]);
    const repo = new Repo(driverFor(db));

    const at = await repo.entities({ start: VID_AT, end: VID_AT });
    expect(at.map((h) => [h.name, h.descriptionPt])).toEqual([['Aaron', 'Irmão de Moisés.']]);

    const nt = await repo.entities({ start: VID_NT, end: VID_NT });
    expect(nt.map((h) => [h.name, h.description, h.descriptionPt])).toEqual([['Paulo', 'Apóstolo, autor da carta.', null]]);

    const cited = await repo.resolveCite(ARAO);
    expect(cited?.table === 'entity' && cited.record.descriptionPt).toBe('Irmão de Moisés.');
    const paulo = await repo.resolveCite(PAULO);
    expect(paulo?.table === 'entity' && paulo.record.descriptionPt).toBe(null);
  });
});

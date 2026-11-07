// Idioma dos nomes e descrições do Repo (nameLang): com o idioma do app em português, o nome pt do banco vale; em
// outro idioma, sem linhas nele, a consulta devolve null e o nome da fonte (inglês) é o que aparece. NT grego (Paulo,
// Fp 2:5, Paulo já está no banco de teste) e AT hebraico (Arão, Êx 4:14).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { Repo } from '../src/index';
import { createFixtureDb, driverFor, insert, source } from './fixtures';

const VID_AT = 2004014; // Êx 4:14
const VID_NT = 50002005; // Fp 2:5
const ARAO = 'ent:isbe-ent:arao';
const PAULO = 'ent:isbe-ent:paulo'; // NT (Fp 2:5): do banco de teste, sem linha no entity_name

describe('Repo.nameLang (idioma dos nomes e descrições)', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createFixtureDb();
    insert(db, 'source', [
      source('sensus-nomes-pt', 'entity', 'Nomes em português', { lang: 'pt' }),
      source('sensus-descricoes-pt', 'entity', 'Descrições em português', { lang: 'pt' }),
    ]);
    insert(db, 'entity', [
      { cite_id: ARAO, source_id: 'isbe-ent', type: 'person', name: 'Aaron', description: 'Brother of Moses.' },
    ]);
    insert(db, 'entity_ref', [
      { entity_cite_id: ARAO, vid: VID_AT, token_pos: null },
    ]);
    insert(db, 'entity_name', [
      { cite_id: ARAO, lang: 'pt', name: 'Arão', source_id: 'sensus-nomes-pt' },
    ]);
    insert(db, 'entity_text', [
      { cite_id: ARAO, lang: 'pt', description: 'Irmão de Moisés.', source_id: 'sensus-descricoes-pt' },
    ]);
  });

  afterEach(() => {
    db.close();
  });

  it('padrão (pt): nome e descrição pt do banco', async () => {
    const repo = new Repo(driverFor(db));
    expect(repo.getNameLang()).toBe('pt');
    const [aaron] = await repo.entities({ start: VID_AT, end: VID_AT });
    expect([aaron?.namePt, aaron?.descriptionPt]).toEqual(['Arão', 'Irmão de Moisés.']);
    const cited = await repo.resolveCite(ARAO);
    expect(cited?.table === 'entity' && [cited.record.namePt, cited.record.descriptionPt]).toEqual(['Arão', 'Irmão de Moisés.']);
  });

  it('app em outro idioma sem linhas nele: nome e descrição pt viram null (vale o original)', async () => {
    const repo = new Repo(driverFor(db), { nameLang: 'en' });
    const [aaron] = await repo.entities({ start: VID_AT, end: VID_AT });
    expect([aaron?.name, aaron?.namePt, aaron?.descriptionPt]).toEqual(['Aaron', null, null]);
    const nt = await repo.entities({ start: VID_NT, end: VID_NT });
    expect(nt.every((h) => h.namePt === null && h.descriptionPt === null)).toBe(true);
    const cited = await repo.resolveCite(PAULO);
    expect(cited?.table === 'entity' && [cited.record.namePt, cited.record.descriptionPt]).toEqual([null, null]);
  });

  it('idioma sem linhas (es): nenhum nome pt aparece, em nenhuma consulta de pessoas', async () => {
    const es = new Repo(driverFor(db), { nameLang: 'es' });
    const hits = await es.entities({ start: VID_AT, end: VID_AT });
    expect(hits.map((h) => h.namePt)).toEqual([null]);
    expect((await es.placesInRange({ start: VID_AT, end: VID_AT })).every((h) => h.namePt === null)).toBe(true);
  });

  it('setNameLang troca o idioma das consultas seguintes (sem recriar o Repo)', async () => {
    const repo = new Repo(driverFor(db));
    expect((await repo.entities({ start: VID_AT, end: VID_AT }))[0]?.namePt).toBe('Arão');
    repo.setNameLang('fr');
    expect(repo.getNameLang()).toBe('fr');
    expect((await repo.entities({ start: VID_AT, end: VID_AT }))[0]?.namePt).toBeNull();
    repo.setNameLang('pt');
    expect((await repo.entities({ start: VID_AT, end: VID_AT }))[0]?.namePt).toBe('Arão');
  });

  it('linhas em outro idioma só valem quando esse idioma é o pedido', async () => {
    insert(db, 'entity_name', [{ cite_id: ARAO, lang: 'en', name: 'Aaron (en)', source_id: 'sensus-nomes-pt' }]);
    const en = new Repo(driverFor(db), { nameLang: 'en' });
    expect((await en.entities({ start: VID_AT, end: VID_AT }))[0]?.namePt).toBe('Aaron (en)');
    const pt = new Repo(driverFor(db));
    expect((await pt.entities({ start: VID_AT, end: VID_AT }))[0]?.namePt).toBe('Arão');
  });
});

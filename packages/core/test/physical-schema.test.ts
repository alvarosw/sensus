// Esquema físico (pipeline/schema_physical.sql) × esquema lógico (pipeline/schema.sql).
// O app lê o banco físico: token e verse_text são VIEWs sobre tabelas compactas, o cite_id é derivado,
// corpus vira 0/1 e source_id vira sid. Os demais testes do núcleo carregam só o lógico; este monta os
// dois bancos a partir dos mesmos dados (o mesmo caminho de pipeline/build_db.py: carga lógica, depois
// o layout físico) e confere que o Repo devolve o mesmo resultado nos dois.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { Repo } from '../src/repo';
import type { SqlDriver, SqlParam } from '../src/types';

const LOGICAL = new URL('../../../pipeline/schema.sql', import.meta.url);
const PHYSICAL = new URL('../../../pipeline/schema_physical.sql', import.meta.url);

type Row = Record<string, SqlParam>;

function insert(db: DatabaseSync, table: string, rows: Row[]): void {
  for (const row of rows) {
    const cols = Object.keys(row);
    const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
    db.prepare(sql).run(...cols.map((c) => row[c] ?? null));
  }
}

function source(id: string, kind: string, title: string, extra: Row = {}): Row {
  return {
    id,
    kind,
    title,
    author: null,
    lang: 'pt',
    license: 'Public Domain',
    license_url: null,
    url: 'https://example.test/source',
    version: '1',
    retrieved_at: '2026-01-01T00:00:00Z',
    attribution: null,
    tradition: null,
    notes: null,
    ...extra,
  };
}

/**
 * Dados comuns aos dois bancos: um versículo do NT (Filipenses 2:5, grego, corpus gnt = 0) e um do
 * AT (Gênesis 1:1, hebraico, corpus hot = 1), tokens de cada um, léxico e um xref.
 */
function loadData(db: DatabaseSync): void {
  insert(db, 'book', [
    { num: 1, osis: 'Gen', name_pt: 'Gênesis', name_en: 'Genesis', testament: 'OT', chapters: 50 },
    { num: 50, osis: 'Phil', name_pt: 'Filipenses', name_en: 'Philippians', testament: 'NT', chapters: 4 },
  ]);

  insert(db, 'source', [
    source('blivre', 'text', 'Bíblia Livre'),
    source('tagnt', 'tokens', 'TAGNT (STEPBible)', { lang: 'grc' }),
    source('tahot', 'tokens', 'TAHOT (STEPBible)', { lang: 'hbo' }),
    source('stepbible-tbesg', 'lexicon', 'TBESG', { lang: 'grc' }),
    source('stepbible-tbesh', 'lexicon', 'TBESH', { lang: 'hbo' }),
    source('openbible', 'xref', 'OpenBible'),
  ]);

  insert(db, 'verse_text', [
    { cite_id: 'txt:blivre:50001002', source_id: 'blivre', vid: 50001002, text: 'Graça a vós outros e paz.' },
    { cite_id: 'txt:blivre:50002005', source_id: 'blivre', vid: 50002005, text: 'Tende em vós o mesmo sentimento.' },
    { cite_id: 'txt:blivre:1001001', source_id: 'blivre', vid: 1001001, text: 'No princípio criou Deus os céus e a terra.' },
  ]);

  insert(db, 'token', [
    {
      cite_id: 'tok:gnt:50002005:1', source_id: 'tagnt', corpus: 'gnt', vid: 50002005, pos: 1,
      surface: 'Τοῦτο', translit: 'Touto', lemma: 'οὗτος', strong: 'G5124', strong_base: 'G5124',
      morph: 'CASN', morph_desc: null, gloss_en: 'this', editions: 'TR,BYZ,NA', variant_note: null, alt_ref: null,
    },
    {
      cite_id: 'tok:gnt:50002005:2', source_id: 'tagnt', corpus: 'gnt', vid: 50002005, pos: 2,
      surface: 'φρονεῖτε', translit: 'phroneite', lemma: 'φρονέω', strong: 'G5426', strong_base: 'G5426',
      morph: 'V-PAM-2P', morph_desc: 'Verb; Imperative; Plural', gloss_en: 'be minded',
      editions: 'TR,BYZ,NA', variant_note: 'NA omite', alt_ref: null,
    },
    {
      // Sufixo de desambiguação: strong ≠ strong_base (o léxico é indexado pela base).
      cite_id: 'tok:hot:1001001:1', source_id: 'tahot', corpus: 'hot', vid: 1001001, pos: 1,
      surface: 'בְּרֵאשִׁית', translit: 'bərēʾšît', lemma: 'רֵאשִׁית', strong: 'H7225', strong_base: 'H7225',
      morph: 'HNcfsa', morph_desc: null, gloss_en: 'beginning', editions: 'L', variant_note: null, alt_ref: null,
    },
    {
      cite_id: 'tok:hot:1001001:2', source_id: 'tahot', corpus: 'hot', vid: 1001001, pos: 2,
      surface: 'בָּרָא', translit: 'bārāʾ', lemma: 'בָּרָא', strong: 'H1254A', strong_base: 'H1254',
      morph: 'HVqp3ms', morph_desc: null, gloss_en: 'create', editions: 'L', variant_note: null, alt_ref: null,
    },
  ]);

  insert(db, 'lexicon_entry', [
    {
      cite_id: 'lex:stepbible-tbesg:G5124', source_id: 'stepbible-tbesg', key: 'G5124', strong_base: 'G5124',
      lemma: 'οὗτος', translit: 'houtos', gloss: 'este', definition: 'Pronome demonstrativo; este, esta, isto.', lang: 'pt',
    },
    {
      cite_id: 'lex:stepbible-tbesh:H7225', source_id: 'stepbible-tbesh', key: 'H7225', strong_base: 'H7225',
      lemma: 'רֵאשִׁית', translit: 'rē᾽šît', gloss: 'princípio', definition: 'Começo, primícias, o primeiro.', lang: 'pt',
    },
    {
      cite_id: 'lex:stepbible-tbesh:H1254', source_id: 'stepbible-tbesh', key: 'H1254', strong_base: 'H1254',
      lemma: 'בָּרָא', translit: 'bārāʾ', gloss: 'criar', definition: 'Criar, fazer algo novo.', lang: 'pt',
    },
  ]);

  insert(db, 'xref', [
    {
      cite_id: 'xr:openbible:50002005:50001002-50001002', source_id: 'openbible',
      from_vid: 50002005, to_start_vid: 50001002, to_end_vid: 50001002, weight: 9.5,
    },
  ]);
}

/** Banco com o esquema lógico (o que os testes do núcleo já usam). */
function logicalDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(LOGICAL, 'utf8'));
  loadData(db);
  return db;
}

/** Banco com o layout físico: carga lógica e depois schema_physical.sql, como em build_db.py. */
function physicalDb(): DatabaseSync {
  const db = logicalDb();
  db.exec(readFileSync(PHYSICAL, 'utf8'));
  return db;
}

function driverFor(db: DatabaseSync): SqlDriver {
  return {
    async all<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
      return db.prepare(sql).all(...params) as unknown as T[];
    },
  };
}

const NT = { start: 50002005, end: 50002005 };
const AT = { start: 1001001, end: 1001001 };
const ALL = { start: 1000000, end: 66999999 };

/** Consultas do Repo que o app usa, com o mesmo critério de chamada. */
const CALLS: Array<[string, (r: Repo) => Promise<unknown>]> = [
  ['books', (r) => r.books()],
  ['sources', (r) => r.sources()],
  ['source', (r) => r.source('tahot')],
  ['verseTexts NT', (r) => r.verseTexts('blivre', NT)],
  ['verseTexts AT', (r) => r.verseTexts('blivre', AT)],
  ['verseTexts intervalo', (r) => r.verseTexts('blivre', ALL)],
  ['tokens NT', (r) => r.tokens(NT)],
  ['tokens AT', (r) => r.tokens(AT)],
  ['tokens só gnt', (r) => r.tokens(ALL, 'gnt')],
  ['tokens só hot', (r) => r.tokens(ALL, 'hot')],
  ['lexicon', (r) => r.lexicon(['H1254', 'G5124', 'H7225', 'G9999'])],
  ['concordance gnt', (r) => r.concordance('G5124', 'blivre', 5)],
  ['concordance hot (sufixo)', (r) => r.concordance('H1254', 'blivre', 5)],
  ['xrefs', (r) => r.xrefs(NT, 5)],
  ['resolveCite tok gnt', (r) => r.resolveCite('tok:gnt:50002005:1')],
  ['resolveCite tok hot', (r) => r.resolveCite('tok:hot:1001001:2')],
  ['resolveCite tok com corpus errado', (r) => r.resolveCite('tok:hot:50002005:1')],
  ['resolveCite txt', (r) => r.resolveCite('txt:blivre:50002005')],
  ['resolveCite xr', (r) => r.resolveCite('xr:openbible:50002005:50001002-50001002')],
  ['resolveCite lex', (r) => r.resolveCite('lex:stepbible-tbesh:H7225')],
];

describe('esquema físico × lógico: mesmo resultado no Repo', () => {
  it.each(CALLS)('%s', async (_name, call) => {
    const logical = new Repo(driverFor(logicalDb()));
    const physical = new Repo(driverFor(physicalDb()));
    expect(await call(physical)).toEqual(await call(logical));
  });
});

describe('esquema físico: formato dos resultados', () => {
  it('versículos e tokens têm cite_id derivado e corpus textual', async () => {
    const repo = new Repo(driverFor(physicalDb()));
    const [nt] = await repo.verseTexts('blivre', NT);
    expect(nt).toMatchObject({ cite_id: 'txt:blivre:50002005', source_id: 'blivre', vid: 50002005 });

    const hot = await repo.tokens(AT);
    expect(hot.map((t) => [t.cite_id, t.corpus, t.strong, t.strong_base])).toEqual([
      ['tok:hot:1001001:1', 'hot', 'H7225', 'H7225'],
      ['tok:hot:1001001:2', 'hot', 'H1254A', 'H1254'],
    ]);

    const gnt = await repo.tokens(NT);
    expect(gnt.every((t) => t.corpus === 'gnt' && t.source_id === 'tagnt')).toBe(true);
    expect(gnt[0]).toMatchObject({ cite_id: 'tok:gnt:50002005:1', translit: 'Touto', morph: 'CASN' });
  });

  it('corpus 0 = gnt e 1 = hot na tabela física (os dois valores são cobertos)', () => {
    const db = physicalDb();
    const rows = db
      .prepare('SELECT corpus, COUNT(*) AS n FROM token_t GROUP BY corpus ORDER BY corpus')
      .all() as Array<{ corpus: number; n: number }>;
    expect(rows.map((r) => r.corpus)).toEqual([0, 1]);
    const viewRows = db
      .prepare('SELECT DISTINCT corpus FROM token ORDER BY corpus')
      .all() as Array<{ corpus: string }>;
    expect(viewRows.map((r) => r.corpus)).toEqual(['gnt', 'hot']);
    const strongRows = db
      .prepare('SELECT corpus FROM token_strong ORDER BY corpus')
      .all() as Array<{ corpus: string }>;
    expect(new Set(strongRows.map((r) => r.corpus))).toEqual(new Set(['gnt', 'hot']));
  });

  it('resolveCite confere o cite_id derivado (corpus errado não resolve)', async () => {
    const repo = new Repo(driverFor(physicalDb()));
    const hot = await repo.resolveCite('tok:hot:1001001:2');
    expect(hot?.table).toBe('token');
    expect(hot?.record).toMatchObject({ cite_id: 'tok:hot:1001001:2', corpus: 'hot', strong_base: 'H1254' });
    expect(await repo.resolveCite('tok:hot:50002005:1')).toBeNull();
    expect(await repo.resolveCite('tok:gnt:50002005:9')).toBeNull();
  });

  it('concordância por strong_base encontra o sufixo pela base e o versículo do AT', async () => {
    const repo = new Repo(driverFor(physicalDb()));
    const c = await repo.concordance('H1254', 'blivre', 5);
    expect(c.count).toBe(1);
    expect(c.samples.map((s) => s.cite_id)).toEqual(['txt:blivre:1001001']);
  });

  it('xref tem cite_id derivado e os textos do alvo', async () => {
    const repo = new Repo(driverFor(physicalDb()));
    const [x] = await repo.xrefs(NT, 5);
    expect(x).toMatchObject({
      cite_id: 'xr:openbible:50002005:50001002-50001002',
      from_vid: 50002005,
      to_start_vid: 50001002,
      weight: 9.5,
    });
    expect(x?.texts.map((t) => t.cite_id)).toEqual(['txt:blivre:50001002']);
  });
});

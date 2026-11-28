// As instruções do índice num SQLite de verdade (node:sqlite, com FTS5), no esquema do pacote de Bíblia:
// montagem em lotes, busca sem acento, palavra inteira e prefixo, NT e AT.
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { ftsMatch, indexChunks, indexStamp, searchTerms } from './search-model';
import { SEARCH_SQL, versesByVidsSql } from './search-sql';

const VERSES: Array<[number, string]> = [
  [11015015, 'E trouxe à Casa do SENHOR as coisas consagradas por seu pai, e as coisas que ele havia consagrado.'],
  [49002005, 'estando nós ainda mortos em nossas ofensas, nos deu vida juntamente com Cristo (pela graça sois salvos),'],
  [49002008, 'Porque pela graça sois salvos, por meio da fé; e isto não vem de vós; é dom de Deus;'],
  [50002007, 'Pelo contrário, ele esvaziou a si mesmo, tomando a forma de servo, e se tornou semelhante aos homens;'],
  [52005018, 'Em tudo dai graças, porque esta é a vontade de Deus em Cristo Jesus para convosco.'],
];

function bibleDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE verse_text (cite_id TEXT NOT NULL, source_id TEXT NOT NULL, vid INTEGER NOT NULL, text TEXT NOT NULL, PRIMARY KEY (source_id, vid));`);
  db.prepare("INSERT INTO meta VALUES ('version', '2026.11.06')").run();
  const ins = db.prepare("INSERT INTO verse_text VALUES (?, 'blivre', ?, ?)");
  for (const [vid, text] of VERSES) ins.run(`txt:blivre:${vid}`, vid, text);
  return db;
}

function build(db: DatabaseSync, chunk: number): void {
  db.exec(SEARCH_SQL.drop);
  db.exec(SEARCH_SQL.create);
  const { n } = db.prepare(SEARCH_SQL.maxRowid).get() as { n: number };
  for (const [a, b] of indexChunks(n, chunk)) db.prepare(SEARCH_SQL.insertChunk).run(a, b);
  db.exec(SEARCH_SQL.optimize);
  db.prepare(SEARCH_SQL.writeStamp).run(indexStamp('2026.11.06'));
}

const vids = (db: DatabaseSync, q: string, prefix = false) =>
  (db.prepare(SEARCH_SQL.search).all(ftsMatch(searchTerms(q), prefix)) as Array<{ vid: number }>).map((r) => r.vid);

describe('índice FTS5 no banco da Bíblia', () => {
  const db = bibleDb();
  build(db, 2);

  it('grava a marca do índice', () => {
    expect((db.prepare(SEARCH_SQL.readStamp).get() as { value: string }).value).toBe(indexStamp('2026.11.06'));
  });

  it('NT: palavra inteira sem diferenciar acento', () => {
    expect(vids(db, 'graca')).toEqual([49002005, 49002008]);
    expect(vids(db, 'GRAÇA')).toEqual([49002005, 49002008]);
    expect(vids(db, 'graça fé')).toEqual([49002008]);
  });

  it('prefixo inclui as palavras que começam com o termo', () => {
    expect(vids(db, 'graça', true)).toEqual([49002005, 49002008, 52005018]);
  });

  it('AT: 1Rs 15:15', () => {
    expect(vids(db, 'senhor')).toEqual([11015015]);
    expect(vids(db, 'consagr', true)).toEqual([11015015]);
  });

  it('operadores digitados não quebram a consulta', () => {
    expect(vids(db, 'graça" OR NEAR(')).toEqual([]);
    expect(vids(db, 'esvaziou*')).toEqual([50002007]);
  });

  it('refazer o índice não duplica', () => {
    build(db, 3);
    expect(vids(db, 'graca')).toEqual([49002005, 49002008]);
  });

  it('texto dos versículos pedidos', () => {
    const rows = db.prepare(versesByVidsSql(2)).all(49002008, 11015015) as Array<{ vid: number }>;
    expect(rows.map((r) => r.vid)).toEqual([11015015, 49002008]);
  });
});

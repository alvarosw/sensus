// SQL do índice de busca, guardado no próprio banco da Bíblia (bible-<id>.db). Sem IO aqui: search-index.ts executa,
// e search-sql.test.ts roda as mesmas instruções num SQLite de verdade.
// A tabela FTS5 é de conteúdo externo (content='verse_text'): guarda só o índice, não uma segunda cópia do texto.
// O pacote baixado não traz o índice; a troca de versão substitui o arquivo inteiro e o índice vai junto.

export const FTS_TABLE = 'verse_fts';
/** Chave em `meta` com a marca do índice pronto (indexStamp). */
export const INDEX_META_KEY = 'search_index';

export const SEARCH_SQL = {
  drop: `DROP TABLE IF EXISTS ${FTS_TABLE}`,
  create: `CREATE VIRTUAL TABLE ${FTS_TABLE} USING fts5(text, content='verse_text', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2')`,
  maxRowid: 'SELECT MAX(rowid) AS n FROM verse_text',
  /** Um lote de versículos, por rowid. */
  insertChunk: `INSERT INTO ${FTS_TABLE} (rowid, text) SELECT rowid, text FROM verse_text WHERE rowid BETWEEN ? AND ?`,
  optimize: `INSERT INTO ${FTS_TABLE} (${FTS_TABLE}) VALUES ('optimize')`,
  readStamp: `SELECT value FROM meta WHERE key = '${INDEX_META_KEY}'`,
  writeStamp: `INSERT OR REPLACE INTO meta (key, value) VALUES ('${INDEX_META_KEY}', ?)`,
  clearStamp: `DELETE FROM meta WHERE key = '${INDEX_META_KEY}'`,
  version: "SELECT value FROM meta WHERE key = 'version'",
  /** vids que casam com a expressão (ftsMatch), em ordem canônica. */
  search: `SELECT v.vid AS vid FROM ${FTS_TABLE} f JOIN verse_text v ON v.rowid = f.rowid WHERE ${FTS_TABLE} MATCH ? ORDER BY v.vid`,
  /** Todos os versículos (busca sem índice, quando o SQLite não tem FTS5). */
  scan: 'SELECT vid, text FROM verse_text ORDER BY vid',
} as const;

/** Texto dos versículos pedidos (no máximo algumas dezenas por vez: os que a lista mostra). */
export function versesByVidsSql(count: number): string {
  return `SELECT vid, text FROM verse_text WHERE vid IN (${Array.from({ length: count }, () => '?').join(',')}) ORDER BY vid`;
}

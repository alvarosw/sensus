// Palavras do texto original, léxico (Strong) e concordância (ver repo/index.ts).
import type { LexiconEntry, SqlParam, Token, VerseRange, VerseText } from '../types';
import { all, type CountRow, type Db, first, LEXICON_COLS, placeholders, TOKEN_COLS } from './sql';

export interface Concordance {
  /** Total de versículos distintos com o strong_base no corpus original. */
  count: number;
  samples: VerseText[];
}

/** Palavras do texto original no intervalo (corpus 'gnt' ou 'hot' opcional). */
export function tokens(db: Db, range: VerseRange, corpus?: Token['corpus']): Promise<Token[]> {
  const params: SqlParam[] = [range.start, range.end];
  let sql = `SELECT ${TOKEN_COLS} FROM token WHERE vid BETWEEN ? AND ?`;
  if (corpus) {
    sql += ' AND corpus = ?';
    params.push(corpus);
  }
  sql += ' ORDER BY vid, pos';
  return all<Token>(db, sql, params);
}

/** Verbetes de léxico para os strong_base dados; mantém a ordem da entrada. */
export async function lexicon(db: Db, strongBases: readonly string[]): Promise<LexiconEntry[]> {
  const bases = [...new Set(strongBases.filter(Boolean))];
  const out: LexiconEntry[] = [];
  for (let i = 0; i < bases.length; i += 200) {
    const chunk = bases.slice(i, i + 200);
    const rows = await all<LexiconEntry>(
      db,
      `SELECT ${LEXICON_COLS} FROM lexicon_entry WHERE strong_base IN (${placeholders(chunk.length)})
       ORDER BY strong_base, source_id, cite_id`,
      chunk,
    );
    out.push(...rows);
  }
  const rank = new Map(bases.map((b, i) => [b, i] as const));
  return out.sort((a, b) => (rank.get(a.strong_base ?? '') ?? 0) - (rank.get(b.strong_base ?? '') ?? 0));
}

/**
 * Concordância de um strong_base: total de versículos com a palavra e até `limit` exemplos
 * do texto `textSourceId`. `exclude` (ex.: o próprio intervalo) não entra nos exemplos, mas não altera o total.
 */
export async function concordance(
  db: Db,
  strongBase: string,
  textSourceId: string,
  limit: number,
  exclude?: VerseRange,
): Promise<Concordance> {
  const countRow = await first<CountRow>(db, 'SELECT COUNT(DISTINCT vid) AS n FROM token_strong WHERE strong_base = ?', [strongBase]);
  const count = countRow?.n ?? 0;
  if (limit <= 0 || count === 0) return { count, samples: [] };

  const params: SqlParam[] = [textSourceId, strongBase];
  let excl = '';
  if (exclude) {
    excl = ' AND NOT (vid BETWEEN ? AND ?)';
    params.push(exclude.start, exclude.end);
  }
  params.push(limit);
  const samples = await all<VerseText>(
    db,
    `SELECT v.cite_id, v.source_id, v.vid, v.text FROM verse_text v
     WHERE v.source_id = ? AND v.vid IN (SELECT DISTINCT vid FROM token_strong WHERE strong_base = ?${excl})
     ORDER BY v.vid LIMIT ?`,
    params,
  );
  return { count, samples };
}

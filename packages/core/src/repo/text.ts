// Texto da Bíblia, divisões, unidade literária e referências cruzadas (ver repo/index.ts).
import type { Book, SqlParam, Source, TextDivision, VerseRange, VerseText, XRef } from '../types';
import { LAST_VERSE, makeVid, splitVid } from '../refs';
import { all, type Db, first, VERSE_COLS, XREF_COLS } from './sql';

/** Fonte de texto usada por padrão para contexto literário e alvos de referências cruzadas. */
export const DEFAULT_TEXT_SOURCE = 'blivre';

const MAX_XREF_TARGET_VERSES = 12;
/** Primeiro livro do NT na ordem protestante (1-39 são do AT). */
const FIRST_NT_BOOK = 40;

export type XRefWithTexts = XRef & { texts: VerseText[] };

export function books(db: Db): Promise<Book[]> {
  return all<Book>(db, 'SELECT num, osis, name_pt, name_en, testament, chapters FROM book ORDER BY num');
}

export function sources(db: Db): Promise<Source[]> {
  return all<Source>(db, 'SELECT * FROM source ORDER BY kind, id');
}

export function source(db: Db, id: string): Promise<Source | null> {
  return first<Source>(db, 'SELECT * FROM source WHERE id = ?', [id]);
}

/** Versículos de uma fonte de texto dentro do intervalo, em ordem. */
export function verseTexts(db: Db, sourceId: string, range: VerseRange, limit?: number): Promise<VerseText[]> {
  const params: SqlParam[] = [sourceId, range.start, range.end];
  let sql = `SELECT ${VERSE_COLS} FROM verse_text WHERE source_id = ? AND vid BETWEEN ? AND ? ORDER BY vid`;
  if (limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(limit);
  }
  return all<VerseText>(db, sql, params);
}

export function chapter(db: Db, sourceId: string, book: number, chapter: number): Promise<VerseText[]> {
  return verseTexts(db, sourceId, { start: makeVid(book, chapter, 0), end: makeVid(book, chapter, LAST_VERSE) });
}

/**
 * Versículos antes e depois do intervalo, sem sair do livro: `count` versículos em cada lado.
 * Se `unit` for dado, também inclui os versículos da unidade literária (até 40 por lado),
 * para que a divisão que contém o trecho apareça inteira.
 */
export async function neighbors(
  db: Db,
  sourceId: string,
  range: VerseRange,
  count: number,
  unit?: VerseRange,
): Promise<{ before: VerseText[]; after: VerseText[] }> {
  const UNIT_CAP = 40;
  const book = splitVid(range.start).book;
  const bookStart = book * 1_000_000;
  const bookEnd = (book + 1) * 1_000_000;
  const unitStart = unit ? Math.max(unit.start, bookStart) : range.start;
  const unitEnd = unit ? Math.min(unit.end, bookEnd - 1) : range.end;
  const [beforeDesc, afterAsc, unitBefore, unitAfter] = await Promise.all([
    count > 0
      ? all<VerseText>(
          db,
          `SELECT ${VERSE_COLS} FROM verse_text WHERE source_id = ? AND vid < ? AND vid >= ? ORDER BY vid DESC LIMIT ?`,
          [sourceId, range.start, bookStart, count],
        )
      : Promise.resolve([]),
    count > 0
      ? all<VerseText>(
          db,
          `SELECT ${VERSE_COLS} FROM verse_text WHERE source_id = ? AND vid > ? AND vid < ? ORDER BY vid LIMIT ?`,
          [sourceId, range.end, bookEnd, count],
        )
      : Promise.resolve([]),
    unit && unitStart < range.start
      ? all<VerseText>(
          db,
          `SELECT ${VERSE_COLS} FROM verse_text WHERE source_id = ? AND vid >= ? AND vid < ? ORDER BY vid DESC LIMIT ?`,
          [sourceId, unitStart, range.start, UNIT_CAP],
        )
      : Promise.resolve([]),
    unit && unitEnd > range.end
      ? all<VerseText>(
          db,
          `SELECT ${VERSE_COLS} FROM verse_text WHERE source_id = ? AND vid > ? AND vid <= ? ORDER BY vid LIMIT ?`,
          [sourceId, range.end, unitEnd, UNIT_CAP],
        )
      : Promise.resolve([]),
  ]);
  const before = new Map<number, VerseText>();
  for (const v of [...beforeDesc, ...unitBefore]) before.set(v.vid, v);
  const after = new Map<number, VerseText>();
  for (const v of [...afterAsc, ...unitAfter]) after.set(v.vid, v);
  return {
    before: [...before.values()].sort((a, b) => a.vid - b.vid),
    after: [...after.values()].sort((a, b) => a.vid - b.vid),
  };
}

/**
 * Divisões relevantes para o intervalo: a última que começa antes dele (lead), as que começam
 * dentro dele e a primeira depois do fim (next). Assim a unidade literária fica delimitada.
 */
export async function divisions(db: Db, sourceId: string, range: VerseRange): Promise<TextDivision[]> {
  const bookStart = splitVid(range.start).book * 1_000_000;
  const bookEnd = (splitVid(range.start).book + 1) * 1_000_000;
  const [lead, inside, next] = await Promise.all([
    all<TextDivision>(
      db,
      `SELECT source_id, vid, kind, title FROM text_division
       WHERE source_id = ? AND vid >= ? AND vid < ? ORDER BY vid DESC, kind LIMIT 1`,
      [sourceId, bookStart, range.start],
    ),
    all<TextDivision>(
      db,
      'SELECT source_id, vid, kind, title FROM text_division WHERE source_id = ? AND vid BETWEEN ? AND ? ORDER BY vid, kind',
      [sourceId, range.start, range.end],
    ),
    all<TextDivision>(
      db,
      `SELECT source_id, vid, kind, title FROM text_division
       WHERE source_id = ? AND vid > ? AND vid < ? ORDER BY vid, kind LIMIT 1`,
      [sourceId, range.end, bookEnd],
    ),
  ]);
  return [...lead, ...inside, ...next];
}

/**
 * Fonte das divisões que delimitam a unidade literária do livro: os parágrafos do original
 * ('tagnt' no NT, 'tahot' no AT), se houver parágrafos para o livro; senão a fonte de texto dada.
 * As divisões de tradução costumam ter um só parágrafo por capítulo, por isso o original tem prioridade.
 */
async function unitDivisionSource(db: Db, book: number, textSourceId: string): Promise<{ id: string; paragraphsOnly: boolean }> {
  const preferred = book >= FIRST_NT_BOOK ? 'tagnt' : 'tahot';
  const hit = await first<{ vid: number }>(
    db,
    `SELECT vid FROM text_division WHERE source_id = ? AND kind = 'paragraph' AND vid >= ? AND vid < ? LIMIT 1`,
    [preferred, book * 1_000_000, (book + 1) * 1_000_000],
  );
  return hit ? { id: preferred, paragraphsOnly: true } : { id: textSourceId, paragraphsOnly: false };
}

/**
 * Unidade literária que contém o intervalo (ver PanelData.layers.literary.unit).
 * Divisões: parágrafos do original (ver unitDivisionSource), ou da fonte de texto na falta deles.
 * Início: última divisão em/antes de range.start (ou início do livro). Fim: o versículo antes da
 * primeira divisão depois de range.end (ou último versículo do livro), e nunca antes de range.end.
 * Assim, uma seleção que cruza parágrafos gera uma unidade que os abrange todos.
 */
export async function literaryUnit(db: Db, sourceId: string, range: VerseRange): Promise<VerseRange> {
  const book = splitVid(range.start).book;
  const bookStart = book * 1_000_000;
  const bookEnd = (book + 1) * 1_000_000;
  const div = await unitDivisionSource(db, book, sourceId);
  const kindClause = div.paragraphsOnly ? " AND kind = 'paragraph'" : '';
  const lead = await first<{ vid: number }>(
    db,
    `SELECT vid FROM text_division WHERE source_id = ?${kindClause} AND vid <= ? AND vid >= ? ORDER BY vid DESC LIMIT 1`,
    [div.id, range.start, bookStart],
  );
  const next = await first<{ vid: number }>(
    db,
    `SELECT vid FROM text_division WHERE source_id = ?${kindClause} AND vid > ? AND vid < ? ORDER BY vid LIMIT 1`,
    [div.id, range.end, bookEnd],
  );
  const limit = next ? next.vid : bookEnd;
  const last = await first<{ vid: number | null }>(
    db,
    `SELECT MAX(vid) AS vid FROM verse_text WHERE source_id = ? AND vid >= ? AND vid < ?`,
    [sourceId, range.end, limit],
  );
  return {
    start: lead ? lead.vid : bookStart,
    end: Math.max(range.end, last?.vid ?? range.end),
  };
}

/** Referências cruzadas com origem no intervalo, por peso decrescente, com o texto dos alvos. */
export async function xrefs(
  db: Db,
  range: VerseRange,
  limit: number,
  textSourceId: string = DEFAULT_TEXT_SOURCE,
): Promise<XRefWithTexts[]> {
  if (limit <= 0) return [];
  const rows = await all<XRef>(
    db,
    `SELECT ${XREF_COLS} FROM xref WHERE from_vid BETWEEN ? AND ?
     ORDER BY (weight IS NULL), weight DESC, cite_id LIMIT ?`,
    [range.start, range.end, limit],
  );
  return Promise.all(
    rows.map(async (x) => ({
      ...x,
      texts: await verseTexts(
        db,
        textSourceId,
        { start: x.to_start_vid, end: x.to_end_vid },
        MAX_XREF_TARGET_VERSES,
      ),
    })),
  );
}

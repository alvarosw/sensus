// Comentários bíblicos e os cabeçalhos de introdução de capítulo e livro (ver repo/index.ts).
import type { Commentary, VerseRange } from '../types';
import { LAST_VERSE, makeVid, splitVid } from '../refs';
import { all, COMMENTARY_COLS, type Db, placeholders } from './sql';

const MAX_INTRO_VIDS = 200;

/** Capítulos de introdução (vid(b,c,0)) e de livro (vid(b,0,0)) tocados pelo intervalo. */
function introVids(range: VerseRange): number[] {
  const s = splitVid(range.start);
  const e = splitVid(range.end);
  const out: number[] = [];
  for (let book = s.book; book <= e.book && out.length < MAX_INTRO_VIDS; book++) {
    out.push(makeVid(book, 0, 0));
    const first = book === s.book ? s.chapter : 1;
    const last = book === e.book ? e.chapter : LAST_VERSE;
    for (let ch = Math.max(first, 1); ch <= last && out.length < MAX_INTRO_VIDS; ch++) {
      out.push(makeVid(book, ch, 0));
    }
  }
  return out;
}

/** Comentários que se sobrepõem ao intervalo, mais os de introdução do(s) capítulo(s) e livro(s). */
export async function commentaries(db: Db, range: VerseRange): Promise<Commentary[]> {
  const intros = introVids(range);
  // Duas consultas separadas para que o índice idx_com_range seja usado em ambas.
  const [overlap, introRows] = await Promise.all([
    all<Commentary>(
      db,
      `SELECT ${COMMENTARY_COLS} FROM commentary WHERE start_vid <= ? AND end_vid >= ?`,
      [range.end, range.start],
    ),
    all<Commentary>(db, `SELECT ${COMMENTARY_COLS} FROM commentary WHERE start_vid IN (${placeholders(intros.length)})`, intros),
  ]);
  const byId = new Map<string, Commentary>();
  for (const row of [...overlap, ...introRows]) byId.set(row.cite_id, row);
  const cmp = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);
  return [...byId.values()].sort(
    (a, b) => a.start_vid - b.start_vid || cmp(a.source_id, b.source_id) || cmp(a.cite_id, b.cite_id),
  );
}

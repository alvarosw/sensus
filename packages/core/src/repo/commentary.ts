// Comentários bíblicos e os cabeçalhos de introdução de capítulo e livro (ver repo/index.ts).
// A preferência de comentários (domain/source-prefs.ts) filtra aqui, na consulta: lentes, painel e contexto da IA
// leem só o que sobra. A regra de tradição mora no domínio; este módulo só junta a tradição da tabela `source`.
import type { Commentary, VerseRange } from '../types';
import { isCommentaryAllowed, type CommentaryPreference } from '../domain/source-prefs';
import { LAST_VERSE, makeVid, splitVid } from '../refs';
import { all, COMMENTARY_COLS, type Db, first, placeholders } from './sql';

const MAX_INTRO_VIDS = 200;

/** Capítulos de introdução (vid(b,c,0)) e de livro (vid(b,0,0)) tocados pelo intervalo. */
function introVids(range: VerseRange): number[] {
  const s = splitVid(range.start);
  const e = splitVid(range.end);
  const out: number[] = [];
  for (let book = s.book; book <= e.book && out.length < MAX_INTRO_VIDS; book++) {
    out.push(makeVid(book, 0, 0));
    const from = book === s.book ? s.chapter : 1;
    const last = book === e.book ? e.chapter : LAST_VERSE;
    for (let ch = Math.max(from, 1); ch <= last && out.length < MAX_INTRO_VIDS; ch++) {
      out.push(makeVid(book, ch, 0));
    }
  }
  return out;
}

/** Tradição de uma fonte (null se a fonte não existe ou não tem tradição). */
export async function traditionOf(db: Db, sourceId: string): Promise<string | null> {
  const row = await first<{ tradition: string | null }>(db, 'SELECT tradition FROM source WHERE id = ?', [sourceId]);
  return row?.tradition ?? null;
}

/** Tradições de todas as fontes do banco, por id (uma consulta; a tabela `source` é pequena). */
async function traditionMap(db: Db): Promise<Map<string, string | null>> {
  const rows = await all<{ id: string; tradition: string | null }>(db, 'SELECT id, tradition FROM source');
  return new Map(rows.map((r) => [r.id, r.tradition] as const));
}

/** Comentário passa pela preferência? Usado para o registro lido por cite_id. */
export async function isCommentaryVisible(db: Db, c: Commentary, pref: CommentaryPreference): Promise<boolean> {
  return isCommentaryAllowed(c.source_id, await traditionOf(db, c.source_id), pref);
}

export interface CommentarySplit {
  /** Comentários que a preferência deixa ver, em ordem. */
  visible: Commentary[];
  /** Quantos comentários do mesmo trecho a preferência escondeu. */
  hidden: number;
}

/**
 * Comentários que se sobrepõem ao intervalo, mais os de introdução do(s) capítulo(s) e livro(s), separados pela
 * preferência. Sem preferência (ALL_COMMENTARIES), `hidden` é zero.
 */
export async function commentarySplit(db: Db, range: VerseRange, pref: CommentaryPreference): Promise<CommentarySplit> {
  const intros = introVids(range);
  // Duas consultas separadas para que o índice idx_com_range seja usado em ambas.
  const [overlap, introRows, traditions] = await Promise.all([
    all<Commentary>(
      db,
      `SELECT ${COMMENTARY_COLS} FROM commentary WHERE start_vid <= ? AND end_vid >= ?`,
      [range.end, range.start],
    ),
    all<Commentary>(db, `SELECT ${COMMENTARY_COLS} FROM commentary WHERE start_vid IN (${placeholders(intros.length)})`, intros),
    traditionMap(db),
  ]);
  const byId = new Map<string, Commentary>();
  for (const row of [...overlap, ...introRows]) byId.set(row.cite_id, row);
  const cmp = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);
  const sorted = [...byId.values()].sort(
    (a, b) => a.start_vid - b.start_vid || cmp(a.source_id, b.source_id) || cmp(a.cite_id, b.cite_id),
  );
  const visible = sorted.filter((c) => isCommentaryAllowed(c.source_id, traditions.get(c.source_id) ?? null, pref));
  return { visible, hidden: sorted.length - visible.length };
}

/** Comentários visíveis pela preferência que se sobrepõem ao intervalo (ver commentarySplit). */
export async function commentaries(db: Db, range: VerseRange, pref: CommentaryPreference): Promise<Commentary[]> {
  return (await commentarySplit(db, range, pref)).visible;
}

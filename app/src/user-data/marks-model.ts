// Regras puras das marcas (grifos e notas): recortar grifos, filtrar e ordenar a lista, achar a cor de um versículo.
// Sem banco, sem React. Uma marca é um intervalo de vids com cor (grifo) ou texto (nota), nunca os dois: um trecho
// grifado e anotado tem duas marcas. Intervalos são numéricos: vids sem versículo real (introdução, 0) não atrapalham.
import { splitVid, type Vid } from '@sensus/core';

/** Cores do grifo, pelo id guardado no banco. Os tons ficam em design/tokens.ts (highlight.*). */
export const MARK_COLORS = ['amarelo', 'verde', 'azul', 'rosa', 'lilas'] as const;
export type MarkColor = (typeof MARK_COLORS)[number];

export interface Mark {
  id: number;
  startVid: Vid;
  endVid: Vid;
  /** Cor do grifo. Null quando a marca é nota. */
  color: MarkColor | null;
  /** Texto da nota. Null quando a marca é grifo. */
  note: string | null;
  createdAt: number;
  updatedAt: number;
}

/** Marca ainda sem id (vai para o banco, que lhe dá um). */
export type NewMark = Omit<Mark, 'id'>;

/** O que um comando mudou: as marcas tiradas e as postas. Desfazer = tirar as postas e repor as tiradas. */
export interface MarkChange {
  removed: Mark[];
  added: Mark[];
}

/** Plano de uma mudança antes de ir ao banco: marcas a tirar e marcas novas. */
export interface MarkPlan {
  remove: Mark[];
  add: NewMark[];
}

export type MarkKind = 'all' | 'highlights' | 'notes';
export type MarkOrder = 'recent' | 'biblical';

export interface MarkFilter {
  kind: MarkKind;
  /** Cores aceitas (vazio = todas). Com cores escolhidas, as notas somem: não têm cor. */
  colors: readonly MarkColor[];
  /** Livro (número bíblico) ou null para todos. */
  book: number | null;
}

export const isHighlight = (m: Mark): boolean => m.color !== null;
export const isNote = (m: Mark): boolean => m.note !== null;

/** Os dois intervalos se tocam (basta um versículo em comum). */
export function overlaps(m: { startVid: Vid; endVid: Vid }, start: Vid, end: Vid): boolean {
  return m.startVid <= end && start <= m.endVid;
}

/** Partes de um grifo que sobram depois de tirar [start, end] dele: uma antes, uma depois, ou nenhuma. */
export function carve(m: Mark, start: Vid, end: Vid): NewMark[] {
  const rest = { color: m.color, note: m.note, createdAt: m.createdAt, updatedAt: m.updatedAt };
  const out: NewMark[] = [];
  if (m.startVid < start) out.push({ ...rest, startVid: m.startVid, endVid: start - 1 });
  if (m.endVid > end) out.push({ ...rest, startVid: end + 1, endVid: m.endVid });
  return out;
}

/**
 * Plano para pintar [start, end] com uma cor (ou apagar o grifo, com `color` null). O grifo novo vence: os grifos
 * antigos que tocam o intervalo saem e voltam aparados (só as partes de fora). Notas não são tocadas.
 */
export function paintPlan(highlights: readonly Mark[], start: Vid, end: Vid, color: MarkColor | null, now: number): MarkPlan {
  const hit = highlights.filter((m) => isHighlight(m) && overlaps(m, start, end));
  const add = hit.flatMap((m) => carve(m, start, end));
  if (color !== null) add.push({ startVid: start, endVid: end, color, note: null, createdAt: now, updatedAt: now });
  return { remove: hit, add };
}

/** Cor do grifo que cobre um versículo, ou null. Grifos não se sobrepõem (ver paintPlan). */
export function colorAt(highlights: readonly Mark[], vid: Vid): MarkColor | null {
  for (const m of highlights) {
    if (m.color !== null && m.startVid <= vid && vid <= m.endVid) return m.color;
  }
  return null;
}

/** Notas que terminam no versículo (é onde o marcador aparece). */
export function notesEndingAt(notes: readonly Mark[], vid: Vid): Mark[] {
  return notes.filter((m) => isNote(m) && m.endVid === vid);
}

/**
 * Cor que cobre o intervalo inteiro, se um único grifo (ou grifos da mesma cor, encadeados) o cobre sem falhas.
 * Serve ao ponto de cor na barra de seleção. Null se faltar versículo ou se as cores diferirem.
 */
export function uniformColor(highlights: readonly Mark[], start: Vid, end: Vid): MarkColor | null {
  const hit = highlights.filter((m) => isHighlight(m) && overlaps(m, start, end)).sort((a, b) => a.startVid - b.startVid);
  if (hit.length === 0) return null;
  const color = hit[0]!.color;
  let cursor = start;
  for (const m of hit) {
    if (m.color !== color || m.startVid > cursor) return null;
    cursor = Math.max(cursor, m.endVid + 1);
    if (cursor > end) return color;
  }
  return cursor > end ? color : null;
}

/** Nota exatamente neste intervalo (a barra mostra o ícone cheio e toca para editar). */
export function noteOn(notes: readonly Mark[], start: Vid, end: Vid): Mark | null {
  return notes.find((m) => isNote(m) && m.startVid === start && m.endVid === end) ?? null;
}

/** Livro (número bíblico) de uma marca, pelo versículo inicial. */
export function bookOfMark(m: Mark): number {
  return splitVid(m.startVid).book;
}

/** Marcas que passam pelo filtro (tipo, cores e livro). */
export function filterMarks(marks: readonly Mark[], f: MarkFilter): Mark[] {
  return marks.filter((m) => {
    if (f.kind === 'highlights' && !isHighlight(m)) return false;
    if (f.kind === 'notes' && !isNote(m)) return false;
    if (f.colors.length > 0 && (m.color === null || !f.colors.includes(m.color))) return false;
    if (f.book !== null && bookOfMark(m) !== f.book) return false;
    return true;
  });
}

/**
 * Ordem da lista. Recentes: alteradas por último primeiro (empate: mais nova primeiro). Ordem bíblica: início, depois
 * fim, depois a mais recente.
 */
export function sortMarks(marks: readonly Mark[], order: MarkOrder): Mark[] {
  const byRecent = (a: Mark, b: Mark) => b.updatedAt - a.updatedAt || b.id - a.id;
  const byBible = (a: Mark, b: Mark) => a.startVid - b.startVid || a.endVid - b.endVid || byRecent(a, b);
  return [...marks].sort(order === 'biblical' ? byBible : byRecent);
}

/** Quantas marcas há em cada livro (para a folha de livros da lista). */
export function countByBook(marks: readonly Mark[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const m of marks) {
    const b = bookOfMark(m);
    out.set(b, (out.get(b) ?? 0) + 1);
  }
  return out;
}

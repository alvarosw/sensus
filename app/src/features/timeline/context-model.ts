// Cronologia do contexto (tela cheia a partir da lente Histórico): regras puras. Eventos do livro do trecho (ou da
// Bíblia inteira), agrupados pelos períodos da fonte (partOf, ex.: viagens missionárias), a lista achatada com o que
// está aberto e a régua de anos. Sem React nem banco; as consultas ficam em useTimeline.ts.
import { splitVid, type TimelineLineEvent, type TimelineLineRef, type Vid } from '@sensus/core';

export type ContextScope = 'book' | 'bible';

/** Versículos do trecho (primeiro e último). */
export interface VerseSpan {
  start: Vid;
  end: Vid;
}

export type ContextEvent = TimelineLineEvent & { lines: TimelineLineRef[] };

/** Período da fonte com os eventos que ele contém (partOf), em ordem cronológica. */
export interface ContextGroup {
  id: string;
  name: string;
  events: ContextEvent[];
  /** Algum evento do grupo cruza o trecho: o grupo começa aberto. */
  inTrecho: boolean;
}

export type ContextItem = { kind: 'event'; event: ContextEvent; inTrecho: boolean } | { kind: 'group'; group: ContextGroup };

/** Linha da lista achatada: cabeçalho de grupo ou evento (o de grupo fechado não aparece). sk: posição para a régua. */
export type ContextRow =
  | { key: string; kind: 'group'; sk: number; group: ContextGroup; open: boolean }
  | { key: string; kind: 'event'; sk: number; event: ContextEvent; inTrecho: boolean; inGroup: boolean };

/** Lê ?de=&ate= da rota; null se faltar ou não for um intervalo válido. */
export function spanFromParams(de?: string, ate?: string): VerseSpan | null {
  const start = Number(de);
  const end = Number(ate);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end < start) return null;
  return { start, end };
}

/** O evento cruza o trecho (algum versículo em comum). */
export function overlapsSpan(e: Pick<TimelineLineEvent, 'first_vid' | 'last_vid'>, span: VerseSpan): boolean {
  return e.first_vid <= span.end && e.last_vid >= span.start;
}

/** Livro do versículo (ex.: 44 para Atos). */
export function bookOf(vid: Vid): number {
  return splitVid(vid).book;
}

/**
 * O evento é do livro quando começa nele (pelo primeiro versículo). Eventos longos que só cruzam o livro (ex.: a
 * Criação, que termina em Atos) ficam na lista do livro em que começam.
 */
export function eventInBook(e: Pick<TimelineLineEvent, 'first_vid'>, book: number): boolean {
  return bookOf(e.first_vid) === book;
}

/** Eventos do escopo: o livro do trecho, ou a cronologia inteira (a mesma lista, Bíblia toda). */
export function scopeEvents<E extends Pick<TimelineLineEvent, 'first_vid' | 'last_vid'>>(events: readonly E[], scope: ContextScope, book: number): E[] {
  return scope === 'bible' ? [...events] : events.filter((e) => eventInBook(e, book));
}

/**
 * Itens da lista em ordem cronológica. Um período da fonte (partOf) vira grupo: o evento-pai é o cabeçalho, na
 * posição dele, e os eventos que o citam entram embaixo. Um pai sem filhos no escopo continua como evento comum.
 */
export function contextItems(events: readonly ContextEvent[], span: VerseSpan): ContextItem[] {
  const parents = new Set(events.flatMap((e) => e.lines.filter((l) => l.kind === 'period').map((l) => l.id)));
  const items: ContextItem[] = [];
  const groups = new Map<string, ContextGroup>();
  const heads = new Map<string, ContextEvent>();
  for (const event of events) {
    const inTrecho = overlapsSpan(event, span);
    const period = event.lines.find((l) => l.kind === 'period');
    const id = period?.id ?? (parents.has(event.cite_id) ? event.cite_id : null);
    if (id === null) {
      items.push({ kind: 'event', event, inTrecho });
      continue;
    }
    let group = groups.get(id);
    if (!group) {
      group = { id, name: period?.name ?? event.title, events: [], inTrecho: false };
      groups.set(id, group);
      items.push({ kind: 'group', group });
    }
    if (event.cite_id === id) heads.set(id, event);
    else group.events.push(event);
    group.inTrecho = group.inTrecho || inTrecho;
  }
  // Pai sem filhos no escopo: volta a ser um evento comum, na mesma posição.
  return items.map((item) => {
    if (item.kind === 'event' || item.group.events.length > 0) return item;
    const head = heads.get(item.group.id);
    return head ? { kind: 'event' as const, event: head, inTrecho: overlapsSpan(head, span) } : item;
  });
}

/** Grupo aberto? Por padrão só o que contém o trecho; o toque do leitor (overrides) vale por cima. */
export function groupOpen(group: ContextGroup, overrides: Readonly<Record<string, boolean>>): boolean {
  return overrides[group.id] ?? group.inTrecho;
}

/** Lista achatada: cada grupo aberto traz os seus eventos logo depois do cabeçalho. */
export function contextRows(items: readonly ContextItem[], span: VerseSpan, overrides: Readonly<Record<string, boolean>>): ContextRow[] {
  const rows: ContextRow[] = [];
  for (const item of items) {
    if (item.kind === 'event') {
      rows.push({ key: `e:${item.event.cite_id}`, kind: 'event', sk: item.event.sortKey, event: item.event, inTrecho: item.inTrecho, inGroup: false });
      continue;
    }
    const { group } = item;
    const open = groupOpen(group, overrides);
    rows.push({ key: `g:${group.id}`, kind: 'group', sk: group.events[0]!.sortKey, group, open });
    if (!open) continue;
    for (const event of group.events) {
      rows.push({ key: `e:${event.cite_id}`, kind: 'event', sk: event.sortKey, event, inTrecho: overlapsSpan(event, span), inGroup: true });
    }
  }
  return rows;
}

/**
 * Linha em que a lista começa: o primeiro evento do trecho (já aberto no grupo, se for o caso); sem ele, o primeiro
 * evento depois do trecho. -1 se não há evento para ancorar.
 */
export function anchorIndex(rows: readonly ContextRow[], span: VerseSpan): number {
  const inTrecho = rows.findIndex((r) => r.kind === 'event' && r.inTrecho);
  if (inTrecho >= 0) return inTrecho;
  return rows.findIndex((r) => r.kind === 'event' && r.event.first_vid >= span.start);
}

/** Primeira linha que começa em ou depois do ano (para situar uma marca da régua); -1 se não há. */
export function rowAtYear(rows: readonly ContextRow[], year: number): number {
  return rows.findIndex((r) => r.sk >= year);
}

const RULER_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

/** Passo da régua em anos: o menor que deixa no máximo ~20 marcas no intervalo. */
export function rulerStep(lo: number, hi: number): number {
  const span = Math.max(1, hi - lo);
  return RULER_STEPS.find((s) => span / s <= 20) ?? 1000;
}

export interface RulerMark {
  /** Ano da marca (múltiplo do passo). */
  year: number;
  /** Eventos entre esta marca e a próxima: a densidade da faixa. */
  count: number;
}

/** Marcas da régua sobre as posições (sortKey) da lista. */
export function rulerMarks(sortKeys: readonly number[]): RulerMark[] {
  if (sortKeys.length === 0) return [];
  const lo = Math.min(...sortKeys);
  const hi = Math.max(...sortKeys);
  const step = rulerStep(lo, hi);
  const marks: RulerMark[] = [];
  for (let year = Math.floor(lo / step) * step; year <= hi; year += step) {
    marks.push({ year, count: sortKeys.filter((k) => k >= year && k < year + step).length });
  }
  return marks;
}

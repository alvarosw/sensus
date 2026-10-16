// Linha do tempo: regras puras da tela (filtros, textos de ano, geometria do paralelo). Sem React nem banco,
// para ser testável. As consultas ficam em Repo (núcleo) e os hooks em useTimeline.ts.
import { formatEventDate, normalizeSearch, TIMELINE_ERAS, type TimelineEra, type TimelineLine } from '@sensus/core';

export type KindFilter = 'all' | TimelineLine['kind'];

/** Ano como texto: -974 → "974 a.C.", 47 → "47 d.C.". Arredonda a posição cronológica (sortKey). */
export function yearText(year: number): string {
  const y = Math.round(year);
  return y < 0 ? `${-y} a.C.` : `${y} d.C.`;
}

/** Intervalo de anos de uma linha: "974–596 a.C.", "31–57 d.C.", "4003 a.C. – 57 d.C.". */
export function spanText(from: number, to: number): string {
  const a = Math.round(from);
  const b = Math.round(to);
  if (a === b) return yearText(a);
  if (a < 0 && b < 0) return `${-a}–${-b} a.C.`;
  if (a > 0) return `${a}–${b} d.C.`;
  return `${yearText(a)} – ${yearText(b)}`;
}

/** Ano de um evento: a data da fonte formatada; se faltar ou não for reconhecida, o ano da posição cronológica. */
export function eventYear(e: { startDate: string | null; sortKey: number }): string {
  return formatEventDate(e.startDate) ?? yearText(e.sortKey);
}

/** Era pelo id ("all" ou ausente = sem filtro). */
export function eraById(id: string | undefined): TimelineEra | null {
  if (!id || id === 'all') return null;
  return TIMELINE_ERAS.find((e) => e.id === id) ?? null;
}

/** A linha tem algum evento dentro da era (ou não há era). */
export function lineInEra(line: Pick<TimelineLine, 'from' | 'to'>, era: TimelineEra | null): boolean {
  return era === null || (line.to >= era.from && line.from < era.to);
}

export function eventInEra(sortKey: number, era: TimelineEra | null): boolean {
  return era === null || (sortKey >= era.from && sortKey < era.to);
}

export interface LineFilter {
  kind: KindFilter;
  era: TimelineEra | null;
  onlyFavorites: boolean;
  favorites: ReadonlySet<string>;
}

/** Linhas que passam pelos filtros da tela inicial (tipo, era, favoritos). A ordem da entrada se mantém. */
export function filterLines<L extends Pick<TimelineLine, 'id' | 'kind' | 'from' | 'to'>>(lines: readonly L[], f: LineFilter): L[] {
  return lines.filter(
    (l) => (f.kind === 'all' || l.kind === f.kind) && lineInEra(l, f.era) && (!f.onlyFavorites || f.favorites.has(l.id)),
  );
}

/** Eventos que passam pela era e pelos favoritos (a busca de eventos não usa o filtro de tipo). */
export function filterEvents<E extends { cite_id: string; sortKey: number }>(
  events: readonly E[],
  era: TimelineEra | null,
  onlyFavorites: boolean,
  favorites: ReadonlySet<string>,
): E[] {
  return events.filter((e) => eventInEra(e.sortKey, era) && (!onlyFavorites || favorites.has(e.cite_id)));
}

/**
 * Filtro de texto dentro de uma linha: título do evento ou nome de um participante (sem acento, sem caixa).
 * Busca vazia não filtra.
 */
export function matchesEventText(e: { title: string; participants: ReadonlyArray<{ name: string }> }, query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  return normalizeSearch(e.title).includes(q) || e.participants.some((p) => normalizeSearch(p.name).includes(q));
}

/** Participantes com nome, sem repetir: "Paul, Silas, Barnabas". */
export function participantNames(participants: ReadonlyArray<{ name: string }>): string {
  return [...new Set(participants.map((p) => p.name).filter(Boolean))].join(', ');
}

// ---- paralelo: viewport, eixo e cursor ----------------------------------------------------------------------------

/** Limites do zoom em anos (sortKey). Fora disso não há dados. */
export const VIEW_LIMITS = { lo: -4300, hi: 200, minSpan: 6 } as const;

export interface Preset {
  id: 'bible' | 'patriarchs' | 'kings' | 'nt';
  from: number;
  to: number;
}

/** Atalhos do paralelo: a Bíblia inteira e três recortes. */
export const PARALLEL_PRESETS: readonly Preset[] = [
  { id: 'bible', from: -4150, to: 120 },
  { id: 'patriarchs', from: -2050, to: -1380 },
  { id: 'kings', from: -1150, to: -560 },
  { id: 'nt', from: -8, to: 62 },
];

/** Mantém o intervalo dentro dos limites de dados e com a largura mínima. */
export function clampView(lo: number, hi: number): { lo: number; hi: number } {
  const span = Math.min(VIEW_LIMITS.hi - VIEW_LIMITS.lo, Math.max(VIEW_LIMITS.minSpan, hi - lo));
  const start = Math.max(VIEW_LIMITS.lo, Math.min(lo, VIEW_LIMITS.hi - span));
  return { lo: start, hi: start + span };
}

/** Zoom em torno de um ano: factor < 1 aproxima, > 1 afasta. O ano `at` fica no mesmo lugar do eixo. */
export function zoomView(lo: number, hi: number, factor: number, at: number): { lo: number; hi: number } {
  return clampView(at - (at - lo) * factor, at + (hi - at) * factor);
}

/** Passo do eixo (anos) que deixa rótulos com pelo menos 64 px. */
export function tickStep(span: number, plotWidth: number): number {
  const steps = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];
  return steps.find((s) => plotWidth / (span / s) >= 64) ?? 1000;
}

export function xOfYear(year: number, lo: number, hi: number, left: number, width: number): number {
  return left + ((year - lo) / (hi - lo)) * width;
}

export function yearAtX(x: number, lo: number, hi: number, left: number, width: number): number {
  return lo + ((x - left) / width) * (hi - lo);
}

/** Tolerância para "evento perto do cursor": 2,5% do intervalo visível, no mínimo 1,5 ano. */
export function cursorTolerance(lo: number, hi: number): number {
  return Math.max(1.5, (hi - lo) * 0.025);
}

/** Para cada faixa: o evento mais próximo do ano, se estiver dentro da tolerância. Ordem das faixas preservada. */
export function nearestPerLane<E extends { sortKey: number }>(
  lanes: ReadonlyArray<{ id: string; events: readonly E[] }>,
  year: number,
  tolerance: number,
): Array<{ id: string; event: E | null }> {
  return lanes.map((lane) => {
    let best: E | null = null;
    let bestD = Infinity;
    for (const e of lane.events) {
      const d = Math.abs(e.sortKey - year);
      if (d <= tolerance && d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return { id: lane.id, event: best };
  });
}

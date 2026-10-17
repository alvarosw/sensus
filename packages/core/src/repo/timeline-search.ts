// Busca na linha do tempo: linhas e eventos por nome/título, para a tela e o seletor "+ Linha" (ver repo/index.ts).
import type { TimelineLine, TimelineLineEvent, TimelineSearchResult } from '../types';
import { normalizeSearch, searchTerms } from '../timeline';
import { all, type Db } from './sql';
import { bySortKey, EVENT_SELECT, type EventRow, lineOf, TIMELINE_TITLE, timelineEventOf } from './timeline-sql';
import { timelineLinesWhere, timelineMemberships } from './timeline';

/**
 * Busca na cronologia completa. Linhas: nome da linha casa com um termo (ver searchTerms). Eventos: título casa
 * com um termo. Termos em português viram os termos em inglês da fonte. Busca vazia devolve nada.
 */
export async function timelineSearch(db: Db, query: string): Promise<TimelineSearchResult> {
  const terms = searchTerms(query);
  if (terms.length === 0) return { lines: [], events: [] };
  const lines = (await timelineLinesWhere(db, terms)).map(lineOf);
  const match = terms.map(() => `instr(lower(${TIMELINE_TITLE}), ?) > 0`).join(' OR ');
  const rows = await all<EventRow>(db, `${EVENT_SELECT} WHERE e.type = 'event' AND (${match})`, terms);
  const events = rows.map((row) => timelineEventOf(row)).filter((e): e is TimelineLineEvent => e !== null).sort(bySortKey);
  const memberships = await timelineMemberships(db, events.map((e) => e.cite_id));
  return {
    lines,
    events: events.map((e) => ({ ...e, lines: memberships.get(e.cite_id) ?? [] })),
  };
}

/**
 * Linhas do tempo para o seletor "+ Linha": nome da linha casa com um termo (ver searchTerms), no máximo `limit`.
 * Ordem: nome que começa com a busca primeiro, depois mais eventos. O filtro roda no banco (a cronologia tem
 * milhares de linhas); só o recorte volta. Busca vazia devolve lista vazia.
 */
export async function timelineSearchLines(db: Db, query: string, limit = 30): Promise<TimelineLine[]> {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];
  // Relevância pelo melhor termo (o texto digitado ou o equivalente em inglês): igual, começa com, palavra começa com.
  const rankOf = (name: string, q: string): number => {
    const n = normalizeSearch(name);
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    if (n.split(/[\s(,-]+/).some((w) => w.startsWith(q))) return 2;
    return 3;
  };
  const rows = await timelineLinesWhere(db, terms);
  return rows
    .map((row) => ({ line: lineOf(row), rank: Math.min(...terms.map((t) => rankOf(row.name, t))) }))
    .sort((a, b) => a.rank - b.rank || b.line.count - a.line.count || (a.line.name < b.line.name ? -1 : a.line.name > b.line.name ? 1 : 0))
    .slice(0, Math.max(0, limit))
    .map((r) => r.line);
}

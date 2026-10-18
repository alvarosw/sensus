// Busca na linha do tempo: linhas e eventos por nome/título, para a tela e o seletor "+ Linha" (ver repo/index.ts).
import type { TimelineLine, TimelineLineEvent, TimelineSearchResult } from '../types';
import { normalizeSearch, searchTerms } from '../timeline';
import { all, type Db } from './sql';
import { attachEventNames, attachNames, ptNameIds } from './names';
import { bySortKey, EVENT_SELECT, type EventRow, lineOf, TIMELINE_TITLE, timelineEventOf } from './timeline-sql';
import { timelineLinesWhere, timelineMemberships } from './timeline';

/**
 * Busca na cronologia completa. Linhas: nome da linha casa com um termo (ver searchTerms) ou o nome pt da pessoa/lugar
 * casa com a busca (ver ptNameIds). Eventos: título em inglês casa com um termo, ou o título pt casa com a busca.
 * Termos em português viram os termos em inglês da fonte. Busca vazia devolve nada.
 */
export async function timelineSearch(db: Db, query: string): Promise<TimelineSearchResult> {
  const terms = searchTerms(query);
  if (terms.length === 0) return { lines: [], events: [] };
  const pt = await ptNameIds(db, query);
  const lines = await attachNames(db, (await timelineLinesWhere(db, terms, pt)).map(lineOf), (l) => l.id);
  const match = terms.map(() => `instr(lower(${TIMELINE_TITLE}), ?) > 0`).join(' OR ');
  const ptMatch = pt.length > 0 ? ' OR e.cite_id IN (SELECT value FROM json_each(?))' : '';
  const params = pt.length > 0 ? [...terms, JSON.stringify(pt)] : terms;
  const rows = await all<EventRow>(db, `${EVENT_SELECT} WHERE e.type = 'event' AND (${match}${ptMatch})`, params);
  const events = await attachEventNames(
    db,
    rows.map((row) => timelineEventOf(row)).filter((e): e is TimelineLineEvent => e !== null).sort(bySortKey),
  );
  const memberships = await timelineMemberships(db, events.map((e) => e.cite_id));
  return {
    lines,
    events: events.map((e) => ({ ...e, lines: memberships.get(e.cite_id) ?? [] })),
  };
}

/**
 * Linhas do tempo para o seletor "+ Linha": nome da linha (inglês ou pt) casa com a busca, no máximo `limit`.
 * Ordem: nome que começa com a busca primeiro, depois mais eventos. O filtro roda no banco (a cronologia tem
 * milhares de linhas); só o recorte volta. Busca vazia devolve lista vazia.
 */
export async function timelineSearchLines(db: Db, query: string, limit = 30): Promise<TimelineLine[]> {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];
  const q = normalizeSearch(query);
  // Relevância pelo melhor nome: o inglês (pelo texto digitado ou o equivalente) e o nome pt. Igual, começa com,
  // palavra começa com.
  const rankOf = (name: string, term: string): number => {
    const n = normalizeSearch(name);
    if (n === term) return 0;
    if (n.startsWith(term)) return 1;
    if (n.split(/[\s(,-]+/).some((w) => w.startsWith(term))) return 2;
    return 3;
  };
  const pt = await ptNameIds(db, query);
  const lines = await attachNames(db, (await timelineLinesWhere(db, terms, pt)).map(lineOf), (l) => l.id);
  const ranked = lines
    .map((line) => ({
      line,
      rank: Math.min(...terms.map((t) => rankOf(line.name, t)), line.namePt ? rankOf(line.namePt, q) : 3),
    }))
    .sort((a, b) => a.rank - b.rank || b.line.count - a.line.count || (a.line.name < b.line.name ? -1 : a.line.name > b.line.name ? 1 : 0))
    .slice(0, Math.max(0, limit))
    .map((r) => r.line);
  return ranked;
}

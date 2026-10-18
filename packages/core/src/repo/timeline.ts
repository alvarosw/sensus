// Linha do tempo: eventos no trecho, linhas (pessoas, lugares, períodos), vínculos e resumo por era (ver repo/index.ts).
import type { TimelineEvent, TimelineLine, TimelineLineEvent, TimelineLineRef, TimelineSummary, VerseRange } from '../types';
import { eraSummaries } from '../timeline';
import { all, chunks, type Db, first } from './sql';
import { attachEventNames, attachNames, ptNames } from './names';
import {
  bySortKey,
  EVENT_SELECT,
  type EventRow,
  lineOf,
  type MemberRow,
  TIMELINE_KEY,
  timelineEventOf,
  timelineMembers,
} from './timeline-sql';

/** Quantos eventos de contexto entram antes e depois do trecho na linha do tempo. */
const TIMELINE_CONTEXT = 2;

/**
 * Linha do tempo: eventos (entity.type='event') com algum versículo no intervalo, em ordem cronológica (sortKey),
 * mais até 2 eventos de contexto antes e 2 depois na cronologia global (inRange=false), para situar o trecho.
 * Sem eventos no intervalo, devolve lista vazia (sem contexto). Banco sem eventos (ex.: o leitor) também dá vazia.
 */
export async function timelineEvents(db: Db, range: VerseRange): Promise<TimelineEvent[]> {
  const inRange = await all<EventRow>(
    db,
    `${EVENT_SELECT} WHERE e.type = 'event'
       AND e.cite_id IN (SELECT entity_cite_id FROM entity_ref WHERE vid BETWEEN ? AND ?)`,
    [range.start, range.end],
  );
  const events = inRange
    .map((row) => timelineEventOf(row))
    .filter((e): e is TimelineLineEvent => e !== null)
    .map((e) => ({ ...e, inRange: true }));
  if (events.length === 0) return [];

  const lo = Math.min(...events.map((e) => e.sortKey));
  const hi = Math.max(...events.map((e) => e.sortKey));
  // CASE (e não AND) porque json_extract falha em JSON inválido: a guarda precisa ser avaliada antes.
  const key = TIMELINE_KEY;
  const [before, after] = await Promise.all([
    all<EventRow>(
      db,
      `${EVENT_SELECT} WHERE e.type = 'event' AND ${key} < ? ORDER BY ${key} DESC, e.cite_id DESC LIMIT ?`,
      [lo, TIMELINE_CONTEXT],
    ),
    all<EventRow>(
      db,
      `${EVENT_SELECT} WHERE e.type = 'event' AND ${key} > ? ORDER BY ${key}, e.cite_id LIMIT ?`,
      [hi, TIMELINE_CONTEXT],
    ),
  ]);
  const context = [...before, ...after]
    .map((row) => timelineEventOf(row))
    .filter((e): e is TimelineLineEvent => e !== null)
    .map((e) => ({ ...e, inRange: false }));
  return attachEventNames(db, [...events, ...context].sort(bySortKey));
}

/** Agregado das linhas (ver timelineLines), com filtro opcional pelo nome: a base da lista e da busca. */
export function timelineLinesWhere(db: Db, nameTerms: readonly string[], ptIds: readonly string[] = []): Promise<MemberRow[]> {
  const m = timelineMembers(nameTerms, ptIds);
  return all<MemberRow>(
    db,
    `${m.sql},
     ev AS (SELECT e.cite_id, ${TIMELINE_KEY} AS sk FROM entity e WHERE e.type = 'event')
     SELECT m.kind, m.line_id AS id, MAX(m.line_name) AS name, COUNT(DISTINCT m.event_id) AS n, MIN(ev.sk) AS lo, MAX(ev.sk) AS hi, GROUP_CONCAT(ev.sk) AS sks
       FROM memb m JOIN ev ON ev.cite_id = m.event_id AND ev.sk IS NOT NULL
      GROUP BY m.kind, m.line_id
      ORDER BY n DESC, name, m.line_id`,
    m.params,
  );
}

/** Linhas do tempo da cronologia completa: períodos, pessoas e lugares com ao menos um evento, mais frequentes primeiro. */
export async function timelineLines(db: Db): Promise<TimelineLine[]> {
  const lines = (await timelineLinesWhere(db, [])).map(lineOf);
  return attachNames(db, lines, (l) => l.id);
}

/**
 * Eventos de uma linha do tempo (id = TimelineLine.id), em ordem de sortKey, com participantes e o primeiro e o
 * último versículo do evento. Linha inexistente devolve lista vazia.
 */
export async function timelineLineEvents(db: Db, lineId: string): Promise<TimelineLineEvent[]> {
  const m = timelineMembers();
  const rows = await all<EventRow>(
    db,
    `${m.sql} ${EVENT_SELECT}
      WHERE e.type = 'event' AND e.cite_id IN (SELECT event_id FROM memb WHERE line_id = ?)`,
    [...m.params, lineId],
  );
  return attachEventNames(
    db,
    rows
      .map((row) => timelineEventOf(row))
      .filter((e): e is TimelineLineEvent => e !== null)
      .sort(bySortKey),
  );
}

/** Um evento pelo cite_id (ex.: o evento do trecho, para abrir a cronologia nele). Null se não for evento válido. */
export async function timelineEvent(db: Db, citeId: string): Promise<TimelineLineEvent | null> {
  const row = await first<EventRow>(db, `${EVENT_SELECT} WHERE e.type = 'event' AND e.cite_id = ?`, [citeId]);
  const event = row ? timelineEventOf(row) : null;
  if (!event) return null;
  const [named] = await attachEventNames(db, [event]);
  return named!;
}

/**
 * Todos os eventos da cronologia, em ordem (são poucas centenas). Base da busca que casa a tradução já em cache:
 * a busca no banco só enxerga o original.
 */
export async function timelineAllEvents(db: Db): Promise<TimelineLineEvent[]> {
  const rows = await all<EventRow>(db, `${EVENT_SELECT} WHERE e.type = 'event'`);
  return attachEventNames(
    db,
    rows
      .map((row) => timelineEventOf(row))
      .filter((e): e is TimelineLineEvent => e !== null)
      .sort(bySortKey),
  );
}

/**
 * Linhas do tempo em que cada evento aparece (chave: cite_id do evento). Eventos sem linha não entram no mapa.
 * Usado na prévia ("Também em") e na busca.
 */
export async function timelineMemberships(db: Db, eventIds: readonly string[]): Promise<Map<string, TimelineLineRef[]>> {
  const out = new Map<string, TimelineLineRef[]>();
  for (const part of chunks([...new Set(eventIds)], 400)) {
    const m = timelineMembers();
    const rows = await all<{ event_id: string; kind: TimelineLine['kind']; id: string; name: string }>(
      db,
      `${m.sql}
       SELECT DISTINCT m.event_id, m.kind, m.line_id AS id, m.line_name AS name
         FROM memb m WHERE m.event_id IN (${part.map(() => '?').join(', ')})
        ORDER BY m.kind, m.line_name`,
      [...m.params, ...part],
    );
    for (const r of rows) {
      const list = out.get(r.event_id) ?? [];
      list.push({ id: r.id, kind: r.kind, name: r.name });
      out.set(r.event_id, list);
    }
  }
  // Nome pt de cada linha (pessoa ou lugar); a chave do mapa segue o cite_id do evento.
  const names = await ptNames(db, [...out.values()].flat().map((r) => r.id));
  for (const list of out.values()) for (const r of list) r.namePt = names.get(r.id) ?? null;
  return out;
}

/** Posições cronológicas (sortKey) de todos os eventos; base da densidade do paralelo. */
export async function timelineSortKeys(db: Db): Promise<number[]> {
  const rows = await all<{ sk: number | null }>(db, `SELECT ${TIMELINE_KEY} AS sk FROM entity e WHERE e.type = 'event'`);
  return rows.map((r) => r.sk).filter((k): k is number => typeof k === 'number');
}

/** Resumo da Bíblia inteira por era: contagem de eventos e histograma de densidade (ver TIMELINE_ERAS). */
export async function timelineSummary(db: Db): Promise<TimelineSummary> {
  const keys = await timelineSortKeys(db);
  return { total: keys.length, eras: eraSummaries(keys) };
}

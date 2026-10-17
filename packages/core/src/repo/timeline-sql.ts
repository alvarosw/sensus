// Base SQL e conversões da linha do tempo (ver repo/timeline.ts e repo/timeline-search.ts).
import type { TimelineLine, TimelineLineEvent, Vid } from '../types';
import { timelineCore } from '../timeline';

/** Evento com o primeiro e o último versículo do evento inteiro (todos os entity_ref dele). */
export const EVENT_SELECT = `SELECT e.cite_id, e.source_id, e.name, e.data,
  (SELECT MIN(x.vid) FROM entity_ref x WHERE x.entity_cite_id = e.cite_id) AS first_vid,
  (SELECT MAX(x.vid) FROM entity_ref x WHERE x.entity_cite_id = e.cite_id) AS last_vid
  FROM entity e`;

export interface EventRow {
  cite_id: string;
  source_id: string;
  name: string;
  data: string | null;
  first_vid: Vid | null;
  last_vid: Vid | null;
}

/** Converte a linha de um evento; null se faltar a posição cronológica ou os versículos (dado incompleto). */
export function timelineEventOf(row: EventRow): TimelineLineEvent | null {
  if (row.first_vid == null || row.last_vid == null) return null;
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(row.data ?? '{}') as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof j.sortKey !== 'number') return null;
  const participants = Array.isArray(j.participants) ? j.participants : [];
  return {
    cite_id: row.cite_id,
    source_id: row.source_id,
    title: typeof j.title === 'string' && j.title ? j.title : row.name,
    startDate: typeof j.startDate === 'string' ? j.startDate : null,
    sortKey: j.sortKey,
    participants: participants
      .filter((p): p is { cite_id: string; name: string } => typeof p?.cite_id === 'string')
      .map((p) => ({ cite_id: p.cite_id, name: String(p.name ?? '') })),
    first_vid: row.first_vid,
    last_vid: row.last_vid,
  };
}

/**
 * Pares linha → evento, para as três origens de linha do tempo (ver TimelineLine). Cada uma é um CTE `memb`.
 * Com termos, o filtro pelo nome da linha entra em cada origem antes do json_each: a busca não lê a cronologia
 * inteira. Os parâmetros vêm na ordem do SQL (um conjunto por origem).
 */
export function timelineMembers(nameTerms: readonly string[] = []): { sql: string; params: string[] } {
  const named = (col: string) =>
    nameTerms.length > 0 ? ` AND (${nameTerms.map(() => `instr(lower(${col}), ?) > 0`).join(' OR ')})` : '';
  const sql = `WITH memb(kind, line_id, line_name, event_id) AS (
  SELECT 'person', p.cite_id, p.name, json_extract(j.value, '$.cite_id')
    FROM entity p, json_each(json_extract(p.data, '$.timeline')) j
   WHERE p.type = 'person' AND p.source_id = 'theographic' AND json_valid(p.data)${named('p.name')}
  UNION ALL
  SELECT 'place', p.cite_id, p.name, json_extract(j.value, '$.cite_id')
    FROM entity p, json_each(json_extract(p.data, '$.eventsHere')) j
   WHERE p.type = 'place' AND p.source_id = 'theographic' AND json_valid(p.data)${named('p.name')}
  UNION ALL
  SELECT 'period', json_extract(j.value, '$.cite_id'), json_extract(j.value, '$.name'), e.cite_id
    FROM entity e, json_each(json_extract(e.data, '$.partOf')) j
   WHERE e.type = 'event' AND json_valid(e.data)${named("json_extract(j.value, '$.name')")}
)`;
  return { sql, params: [...nameTerms, ...nameTerms, ...nameTerms] };
}
/** Posição cronológica do evento (guardada antes do json_extract, que falha em JSON inválido). */
export const TIMELINE_KEY = `CASE WHEN json_valid(e.data) THEN json_extract(e.data, '$.sortKey') END`;
/** Título do evento: o do JSON, ou o nome do registro. */
export const TIMELINE_TITLE = `COALESCE(CASE WHEN json_valid(e.data) THEN json_extract(e.data, '$.title') END, e.name)`;

export interface MemberRow {
  kind: TimelineLine['kind'];
  id: string;
  name: string;
  n: number;
  lo: number;
  hi: number;
  /** sortKeys dos eventos da linha, separados por vírgula (GROUP_CONCAT). */
  sks: string | null;
}

/**
 * Linha do tempo de uma pessoa, lugar ou período, com a contagem de eventos e a faixa de anos (ver TimelineLine).
 * A faixa é o núcleo da linha (timelineCore): pontas isoladas, como Jesus "participando" da criação, não a esticam,
 * senão a linha apareceria no filtro de eras em que não está de fato.
 */
export function lineOf(row: MemberRow): TimelineLine {
  const keys = (row.sks ?? '').split(',').map(Number).filter((k) => Number.isFinite(k));
  const core = keys.length > 0 ? timelineCore(keys) : { lo: row.lo, hi: row.hi };
  return { id: row.id, kind: row.kind, name: row.name, count: row.n, from: Math.round(core.lo), to: Math.round(core.hi) };
}

/** Ordem cronológica (sortKey) e, em empate, pelo cite_id. */
export function bySortKey<T extends TimelineLineEvent>(a: T, b: T): number {
  return a.sortKey - b.sortKey || (a.cite_id < b.cite_id ? -1 : a.cite_id > b.cite_id ? 1 : 0);
}

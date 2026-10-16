// Dados da linha do tempo para as telas: consultas ao núcleo (Repo) com cache por banco. Cada consulta é
// feita uma vez e reaproveitada entre telas; falha não fica em cache (tenta de novo na próxima montagem).
import { useEffect, useState } from 'react';
import type { Repo, TimelineLine, TimelineLineEvent, TimelineLineRef, TimelineSearchResult, TimelineSummary } from '@sensus/core';
import { useRepo } from '@/data/db-context';

interface RepoCache {
  lines?: Promise<TimelineLine[]>;
  sortKeys?: Promise<number[]>;
  summary?: Promise<TimelineSummary>;
  events: Map<string, Promise<TimelineLineEvent[]>>;
}

const caches = new WeakMap<Repo, RepoCache>();

function cacheOf(repo: Repo): RepoCache {
  let c = caches.get(repo);
  if (!c) {
    c = { events: new Map() };
    caches.set(repo, c);
  }
  return c;
}

/** Guarda a promessa no cache e a descarta se falhar (a próxima chamada tenta de novo). */
function remember<T>(get: () => Promise<T> | undefined, set: (p: Promise<T> | undefined) => void, make: () => Promise<T>): Promise<T> {
  const cached = get();
  if (cached) return cached;
  const p = make();
  set(p);
  p.catch(() => set(undefined));
  return p;
}

export function linesOf(repo: Repo): Promise<TimelineLine[]> {
  const c = cacheOf(repo);
  return remember(() => c.lines, (p) => (c.lines = p), () => repo.timelineLines());
}

export function lineEventsOf(repo: Repo, lineId: string): Promise<TimelineLineEvent[]> {
  const c = cacheOf(repo);
  const cached = c.events.get(lineId);
  if (cached) return cached;
  const p = repo.timelineLineEvents(lineId);
  c.events.set(lineId, p);
  p.catch(() => c.events.delete(lineId));
  return p;
}

export function sortKeysOf(repo: Repo): Promise<number[]> {
  const c = cacheOf(repo);
  return remember(() => c.sortKeys, (p) => (c.sortKeys = p), () => repo.timelineSortKeys());
}

export function summaryOf(repo: Repo): Promise<TimelineSummary> {
  const c = cacheOf(repo);
  return remember(() => c.summary, (p) => (c.summary = p), () => repo.timelineSummary());
}

/** Carrega uma consulta ao banco quando a chave muda. null enquanto carrega (ou se falhar). */
function useLoaded<T>(key: string, load: (repo: Repo) => Promise<T>): T | null {
  const repo = useRepo();
  const [state, setState] = useState<{ key: string; value: T } | null>(null);
  useEffect(() => {
    let alive = true;
    load(repo).then(
      (value) => {
        if (alive) setState({ key, value });
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
    // A chave identifica a consulta; load muda de identidade a cada render sem mudar o resultado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, key]);
  return state?.key === key ? state.value : null;
}

/** Todas as linhas do tempo (períodos, pessoas, lugares). */
export function useTimelineLines(): TimelineLine[] | null {
  return useLoaded('lines', linesOf);
}

/** Eventos de uma linha, em ordem cronológica. */
export function useLineEvents(lineId: string | null): TimelineLineEvent[] | null {
  return useLoaded(`line:${lineId ?? ''}`, (repo) => (lineId ? lineEventsOf(repo, lineId) : Promise.resolve([])));
}

/** Resumo da Bíblia inteira por era. */
export function useTimelineSummary(): TimelineSummary | null {
  return useLoaded('summary', summaryOf);
}

/** Posições de todos os eventos (densidade do paralelo). */
export function useSortKeys(): number[] | null {
  return useLoaded('sortKeys', sortKeysOf);
}

/** Um evento e as linhas em que ele aparece ("Também em"). null enquanto carrega (ou se o id não for evento). */
export interface EventDetail {
  event: TimelineLineEvent;
  lines: TimelineLineRef[];
}

export function useEventDetail(citeId: string | null): EventDetail | null {
  const detail = useLoaded(`event:${citeId ?? ''}`, async (repo): Promise<EventDetail | null> => {
    if (!citeId) return null;
    const event = await repo.timelineEvent(citeId);
    if (!event) return null;
    const lines = (await repo.timelineMemberships([citeId])).get(citeId) ?? [];
    return { event, lines };
  });
  return detail;
}

/** Busca na cronologia, com atraso de 180 ms para não consultar a cada tecla. Vazia enquanto a busca não roda. */
export function useTimelineSearch(query: string): TimelineSearchResult | null {
  const debounced = useDebounced(query.trim(), 180);
  return useLoaded(`search:${debounced}`, (repo) =>
    debounced ? repo.timelineSearch(debounced) : Promise.resolve<TimelineSearchResult>({ lines: [], events: [] }),
  );
}

function useDebounced(value: string, ms: number): string {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setOut(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return out;
}

/** Eventos pelos cite_ids (favoritos). Ignora ids que não são mais eventos. */
export function useEventsByIds(ids: readonly string[]): TimelineLineEvent[] | null {
  const key = `events:${ids.join('|')}`;
  return useLoaded(key, async (repo) => {
    const found = await Promise.all(ids.map((id) => repo.timelineEvent(id)));
    return found.filter((e): e is TimelineLineEvent => e !== null);
  });
}

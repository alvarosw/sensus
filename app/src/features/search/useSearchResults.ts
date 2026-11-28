// Dados da tela de busca: garante o índice da Bíblia, busca os versículos (palavra inteira e, para a sugestão, o
// prefixo) e carrega o texto dos que a lista mostra.
import { useEffect, useMemo, useState } from 'react';
import type { Vid } from '@sensus/core';
import { searchTerms } from '@/data/bibles/search-model';
import { searchAvailable, searchVids, useSearchIndex, versesByVids } from '@/data/bibles/search-index';

export type SearchView =
  | { kind: 'idle' }
  | { kind: 'unavailable' }
  | { kind: 'preparing'; progress: number }
  | { kind: 'failed' }
  | { kind: 'loading' }
  /** `extra` = quantos a mais o prefixo traria (0 quando o prefixo já está ligado). */
  | { kind: 'results'; hits: Vid[]; extra: number };

export function useSearchResults(source: string, query: string, prefix: boolean): { view: SearchView; terms: string[]; retry: () => void } {
  const terms = useMemo(() => searchTerms(query), [query]);
  const status = useSearchIndex((s) => s.byId[source]);
  const available = searchAvailable(source);
  const key = `${source}|${terms.join(' ')}|${prefix}`;
  const [found, setFound] = useState<{ key: string; hits: Vid[]; extra: number } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (available) void useSearchIndex.getState().ensure(source);
  }, [available, source, attempt]);

  const phase = status?.phase;
  useEffect(() => {
    if (terms.length === 0 || (phase !== 'ready' && phase !== 'scan')) return;
    let alive = true;
    (async () => {
      const hits = (await searchVids(source, terms, prefix)) ?? [];
      const extra = prefix ? 0 : Math.max(0, ((await searchVids(source, terms, true)) ?? []).length - hits.length);
      if (alive) setFound({ key, hits, extra });
    })().catch(() => alive && setFound({ key, hits: [], extra: 0 }));
    return () => {
      alive = false;
    };
    // `terms` acompanha a chave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, phase]);

  const retry = () => {
    useSearchIndex.getState().forget(source);
    setAttempt((n) => n + 1);
  };

  let view: SearchView;
  if (terms.length === 0) view = { kind: 'idle' };
  else if (!available) view = { kind: 'unavailable' };
  else if (phase === 'error') view = { kind: 'failed' };
  else if (phase !== 'ready' && phase !== 'scan') view = { kind: 'preparing', progress: status?.progress ?? 0 };
  else if (found?.key !== key) view = { kind: 'loading' };
  else view = { kind: 'results', hits: found.hits, extra: found.extra };
  return { view, terms, retry };
}

/** Texto dos versículos mostrados; guarda o que já chegou (a lista cresce com "Mais N"). */
export function useHitTexts(source: string, vids: readonly Vid[]): ReadonlyMap<Vid, string> {
  const [texts, setTexts] = useState<{ source: string; map: Map<Vid, string> }>({ source, map: new Map() });
  const current = texts.source === source ? texts.map : null;
  const missing = vids.filter((v) => !current?.has(v));
  const missingKey = missing.join(',');
  useEffect(() => {
    if (missing.length === 0) return;
    let alive = true;
    versesByVids(source, missing).then(
      (got) => {
        if (!alive) return;
        setTexts((prev) => {
          const map = new Map(prev.source === source ? prev.map : undefined);
          for (const [v, t] of got) map.set(v, t);
          return { source, map };
        });
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, missingKey]);
  return current ?? new Map();
}

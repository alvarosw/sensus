// Painel determinístico + contexto serializado para a IA, por intervalo (com cache em memória).
// Usado pela folha de estudo e pelo chat: o mesmo intervalo reaproveita a mesma consulta.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildPanel,
  buildRichTextContext,
  serializePanel,
  type Book,
  type PanelData,
  type Repo,
  type RichTextContext,
  type SerializedContext,
  type Vid,
} from '@sensus/core';
import { useRepo } from '@/data/db-context';
import { loadBooks } from '../common/cites';

export interface PassagePanel {
  panel: PanelData | null;
  /** Contexto serializado enviado à IA (texto + cite_ids). */
  context: SerializedContext | null;
  /** Para interpretar respostas (rótulos de citação, tokens). */
  richCtx: RichTextContext | null;
  /** Unidade literária (perícope) que contém o intervalo. */
  unit: { start: Vid; end: Vid } | null;
  /** Livros (nomes e abreviações), úteis para formatar referências. */
  books: Book[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

interface Loaded {
  panel: PanelData;
  context: SerializedContext;
  richCtx: RichTextContext;
  unit: { start: Vid; end: Vid } | null;
  books: Book[];
}

// ---- cache em memória -------------------------------------------------------------------------

const MAX_ENTRIES = 12;
const cache = new Map<string, Promise<Loaded>>();
const repoIds = new WeakMap<Repo, number>();
let nextRepoId = 1;

function keyOf(repo: Repo, start: Vid, end: Vid): string {
  let id = repoIds.get(repo);
  if (id === undefined) {
    id = nextRepoId++;
    repoIds.set(repo, id);
  }
  return `${id}:${start}-${end}`;
}

function load(repo: Repo, start: Vid, end: Vid): Promise<Loaded> {
  const key = keyOf(repo, start, end);
  const hit = cache.get(key);
  if (hit) {
    // LRU: reinsere como o mais recente.
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const p = (async (): Promise<Loaded> => {
    const [books, panel] = await Promise.all([loadBooks(repo), buildPanel(repo, { start, end })]);
    const context = serializePanel(panel);
    const richCtx = buildRichTextContext(context, panel, books);
    return { panel, context, richCtx, unit: panel.layers.literary.unit ?? null, books };
  })();
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  return p;
}

/**
 * Painel do intervalo (null = nada a carregar). Mantém o resultado anterior em `loading` apenas
 * dentro do mesmo intervalo; ao trocar de intervalo os campos voltam a null até o novo chegar.
 */
export function usePassagePanel(range: { start: Vid; end: Vid } | null): PassagePanel {
  const repo = useRepo();
  const start = range?.start ?? null;
  const end = range?.end ?? null;
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{ key: string; loaded?: Loaded; error?: string } | null>(null);
  const key = start !== null && end !== null ? `${keyOf(repo, start, end)}#${nonce}` : null;

  useEffect(() => {
    if (key === null || start === null || end === null) return;
    let alive = true;
    if (nonce > 0) cache.delete(keyOf(repo, start, end));
    load(repo, start, end).then(
      (loaded) => alive && setState({ key, loaded }),
      (e: unknown) => alive && setState({ key, error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      alive = false;
    };
  }, [repo, key, start, end, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return useMemo<PassagePanel>(() => {
    const current = key !== null && state?.key === key ? state : null;
    const loaded = current?.loaded;
    return {
      panel: loaded?.panel ?? null,
      context: loaded?.context ?? null,
      richCtx: loaded?.richCtx ?? null,
      unit: loaded?.unit ?? null,
      books: loaded?.books ?? [],
      loading: key !== null && !current,
      error: current?.error ?? null,
      reload,
    };
  }, [key, state, reload]);
}

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { Book } from '@sensus/core';
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import { loadBooks, loadCite, type CiteDetail } from './cites';

/** Livros (cache por banco). Vazio até carregar. */
export function useBooks(): Book[] {
  const repo = useRepo();
  const [books, setBooks] = useState<Book[]>([]);
  useEffect(() => {
    let alive = true;
    loadBooks(repo).then(
      (b) => alive && setBooks(b),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [repo]);
  return books;
}

export interface CiteState {
  loading: boolean;
  /** null = id inexistente (citação inválida). */
  detail: CiteDetail | null;
  error: string | undefined;
}

/** Carrega um cite_id; citeId null não carrega nada. */
export function useCite(citeId: string | null): CiteState {
  const repo = useRepo();
  const state = useAsync<CiteDetail | null>(() => (citeId ? loadCite(repo, citeId) : Promise.resolve(null)), [repo, citeId]);
  if (!citeId) return { loading: false, detail: null, error: undefined };
  // Ao trocar de id, evita mostrar o registro anterior.
  const stale = state.data && state.data.citeId !== citeId;
  return { loading: state.loading || !!stale, detail: stale ? null : (state.data ?? null), error: state.error };
}

/** Preferência do sistema por menos movimento (animações curtas). */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduce(v), () => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

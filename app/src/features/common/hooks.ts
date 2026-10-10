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
    let timer: ReturnType<typeof setTimeout> | null = null;
    const attempt = (n: number) =>
      loadBooks(repo).then(
        (b) => alive && setBooks(b),
        () => {
          // Falha de leitura não fica em cache: tenta de novo algumas vezes.
          if (alive && n < 4) timer = setTimeout(() => attempt(n + 1), 400 * (n + 1));
        },
      );
    attempt(0);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [repo]);
  return books;
}

export interface CiteState {
  loading: boolean;
  /** null = id inexistente (citação inválida). */
  detail: CiteDetail | null;
  error: string | undefined;
  reload: () => void;
}

/** Carrega um cite_id; citeId null não carrega nada. */
export function useCite(citeId: string | null): CiteState {
  const repo = useRepo();
  const state = useAsync<CiteDetail | null>(() => (citeId ? loadCite(repo, citeId) : Promise.resolve(null)), [repo, citeId]);
  if (!citeId) return { loading: false, detail: null, error: undefined, reload: state.reload };
  // Ao trocar de id, evita mostrar o registro anterior.
  const stale = state.data && state.data.citeId !== citeId;
  return { loading: state.loading || !!stale, detail: stale ? null : (state.data ?? null), error: state.error, reload: state.reload };
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

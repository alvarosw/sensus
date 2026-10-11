import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Repo } from '@sensus/core';
import { openActiveDatabase, subscribeActive } from './active-db';
import type { Edition } from './edition';

type DbState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; repo: Repo; edition: Edition };

const DbContext = createContext<DbState>({ status: 'loading' });

/** Abre o banco ativo e acompanha as trocas (instalação ou remoção dos dados completos). */
export function DbProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DbState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    const unsubscribe = subscribeActive((a) => {
      if (alive) setState({ status: 'ready', repo: a.repo, edition: a.edition });
    });
    openActiveDatabase().catch((e: unknown) => {
      if (alive) setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return <DbContext.Provider value={state}>{children}</DbContext.Provider>;
}

/** Estado do banco (loading/error/ready), para o portão de inicialização. */
export function useDbState(): DbState {
  return useContext(DbContext);
}

/** Repositório do banco. Só deve ser usado dentro do portão (quando pronto). */
export function useRepo(): Repo {
  const state = useContext(DbContext);
  if (state.status !== 'ready') {
    throw new Error('useRepo chamado antes do banco estar pronto');
  }
  return state.repo;
}

/** Edição do banco ativo ('reader' ou 'full'); null antes de abrir. */
export function useEdition(): Edition | null {
  const state = useContext(DbContext);
  return state.status === 'ready' ? state.edition : null;
}

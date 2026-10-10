import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Repo } from '@sensus/core';
import { createExpoSqlDriver, openSensusDatabase } from './driver';

type DbState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; repo: Repo };

const DbContext = createContext<DbState>({ status: 'loading' });

export function DbProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DbState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    openSensusDatabase().then(
      (db) => {
        if (alive) setState({ status: 'ready', repo: new Repo(createExpoSqlDriver(db)) });
      },
      (e: unknown) => {
        if (alive) setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      },
    );
    return () => {
      alive = false;
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

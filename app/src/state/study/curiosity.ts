// Curiosidade do trecho na folha: estado por unidade literária (chave curiosityCacheKey), só em memória. Nada aqui é
// persistido (regra do projeto: conteúdo de IA não é salvo). A transição é uma função pura (curiosityTransition); o
// fluxo que dispara as chamadas à IA está em features/study/useCuriosity.ts.
import type { StateCreator } from 'zustand';
import type { CuriosityCandidate } from '@sensus/core';
import type { StudyState } from './index';

export type CuriosityStatus = 'idle' | 'running' | 'shown' | 'hidden' | 'error';

export interface CuriosityEntry {
  status: CuriosityStatus;
  /** Candidata que passou no portão em código; existe a partir do evento 'candidate' até o fim. */
  candidate: CuriosityCandidate | null;
  /** Motivo em uma frase (para teste e depuração); não aparece na tela. */
  reason: string;
}

export type CuriosityEvent =
  | { type: 'start' }
  | { type: 'candidate'; candidate: CuriosityCandidate }
  | { type: 'show'; reason: string }
  | { type: 'hide'; reason: string }
  | { type: 'fail'; reason: string }
  | { type: 'cancel' }
  | { type: 'retry' };

export const EMPTY_CURIOSITY: CuriosityEntry = { status: 'idle', candidate: null, reason: '' };

/**
 * Transição pura da curiosidade de uma unidade. Só 'running' avança; 'shown' e 'hidden' são finais na sessão (não
 * roda de novo); 'error' fica quieto até 'retry' (folha fechada), que volta a 'idle' para tentar de novo.
 * 'cancel' (folha fechada, desmontagem) volta a 'idle' para recomeçar.
 */
export function curiosityTransition(cur: CuriosityEntry | undefined, ev: CuriosityEvent): CuriosityEntry {
  const e = cur ?? EMPTY_CURIOSITY;
  switch (ev.type) {
    case 'start':
      return e.status === 'idle' ? { status: 'running', candidate: null, reason: '' } : e;
    case 'candidate':
      return e.status === 'running' ? { ...e, candidate: ev.candidate } : e;
    case 'show':
      return e.status === 'running' && e.candidate ? { status: 'shown', candidate: e.candidate, reason: ev.reason } : e;
    case 'hide':
      return e.status === 'running' ? { status: 'hidden', candidate: null, reason: ev.reason } : e;
    case 'fail':
      return e.status === 'running' ? { status: 'error', candidate: null, reason: ev.reason } : e;
    case 'cancel':
      return e.status === 'running' ? { ...EMPTY_CURIOSITY } : e;
    case 'retry':
      return e.status === 'error' ? { ...EMPTY_CURIOSITY } : e;
  }
}

/** Pode começar agora? Só com a folha aberta, provedor, contexto da unidade pronto e nada decidido ainda. */
export function canStartCuriosity(
  status: CuriosityStatus | undefined,
  s: { open: boolean; hasProvider: boolean; ready: boolean },
): boolean {
  return s.open && s.hasProvider && s.ready && (status === undefined || status === 'idle');
}

export interface CuriositySlice {
  /** Estado por unidade (chave `curiosityCacheKey`). */
  curiosities: Record<string, CuriosityEntry>;
  dispatchCuriosity(key: string, ev: CuriosityEvent): void;
}

export const createCuriositySlice: StateCreator<StudyState, [], [], CuriositySlice> = (set) => ({
  curiosities: {},

  dispatchCuriosity: (key, ev) =>
    set((s) => {
      const cur = s.curiosities[key];
      const next = curiosityTransition(cur, ev);
      // Evento sem efeito (ex.: cancelar o que nem começou) não mexe no store.
      if (next === (cur ?? EMPTY_CURIOSITY)) return {};
      return { curiosities: { ...s.curiosities, [key]: next } };
    }),
});

// Verificação do modelo antes de salvar a conexão com um provedor de chave (Assistente de IA).
// Módulo puro (sem React): a tela envia `start`, `tick` (a cada ~250 ms), `passed`/`failed` (resultado de
// checkProviderModel) e `saved` (depois de gravar). Um id por tentativa: resultado de tentativa antiga
// (cancelada ou trocada) é ignorado. Testado em verify-save.test.ts.
import { LLMError } from '@sensus/core';
import { SETTINGS_COPY } from './strings';

/** Sem resposta por este tempo, a verificação mostra o aviso de lentidão (salvar continua possível). */
export const SLOW_AFTER_MS = 8_000;
/** Sem resposta por este tempo, a verificação falha por tempo esgotado (nada é salvo). */
export const VERIFY_TIMEOUT_MS = 30_000;
/** Um sucesso com a mesma chave, modelo e corpo extra vale por este tempo: Salvar não verifica de novo. */
export const KEY_REUSE_MS = 5 * 60_000;

/** `save`: verifica e, se der certo, salva. `check`: só verifica ("Verificar modelo"). */
export type VerifyPurpose = 'save' | 'check';

export type FailureReason =
  | 'auth'
  | 'model_unavailable'
  | 'timeout'
  | 'network'
  | 'rate_limit'
  | 'server'
  | 'config'
  | 'protocol'
  | 'save'
  | 'other';

/**
 * Resultado de listar os modelos com a mesma chave (GET /models), quando a verificação do modelo falha com
 * 401/403/404: 'valid' = a chave é aceita (o problema é o modelo); 'invalid' = a chave é recusada;
 * 'unknown' = a listagem não deu resposta conclusiva.
 */
export type KeyProbe = 'valid' | 'invalid' | 'unknown';

export interface VerifyFailure {
  reason: FailureReason;
  /** Frase para o usuário (pt-BR), sem o id do modelo repetido nas sugestões. */
  message: string;
}

export type VerifyState =
  | { phase: 'idle' }
  | { phase: 'verifying'; id: number; purpose: VerifyPurpose; startedAt: number; slow: boolean }
  | { phase: 'passed'; id: number; purpose: VerifyPurpose; startedAt: number; elapsedMs: number; slow: boolean }
  | { phase: 'failed'; id: number; purpose: VerifyPurpose; failure: VerifyFailure; elapsedMs: number }
  | { phase: 'saved'; id: number; elapsedMs: number; slow: boolean };

export type VerifyEvent =
  | { type: 'start'; id: number; purpose: VerifyPurpose; at: number }
  | { type: 'tick'; at: number }
  | { type: 'passed'; id: number; at: number }
  | { type: 'failed'; id: number; at: number; failure: VerifyFailure }
  | { type: 'saved'; id: number }
  | { type: 'cancel' }
  | { type: 'reset' };

export const VERIFY_IDLE: VerifyState = { phase: 'idle' };

/** Milissegundos em segundos inteiros (mínimo 1), para as frases da verificação. */
export const seconds = (ms: number) => Math.max(1, Math.round(ms / 1000));

function failedState(state: { id: number; purpose: VerifyPurpose; startedAt: number }, failure: VerifyFailure, at: number): VerifyState {
  return { phase: 'failed', id: state.id, purpose: state.purpose, failure, elapsedMs: at - state.startedAt };
}

export function verifyReducer(state: VerifyState, event: VerifyEvent): VerifyState {
  switch (event.type) {
    case 'start':
      return { phase: 'verifying', id: event.id, purpose: event.purpose, startedAt: event.at, slow: false };

    case 'cancel':
      return state.phase === 'verifying' ? VERIFY_IDLE : state;

    case 'reset':
      return VERIFY_IDLE;

    case 'tick': {
      if (state.phase !== 'verifying') return state;
      const elapsed = event.at - state.startedAt;
      if (elapsed >= VERIFY_TIMEOUT_MS) {
        return failedState(state, timeoutFailure(VERIFY_TIMEOUT_MS), event.at);
      }
      if (!state.slow && elapsed >= SLOW_AFTER_MS) return { ...state, slow: true };
      return state;
    }

    case 'passed': {
      if (state.phase !== 'verifying' || state.id !== event.id) return state;
      const elapsed = event.at - state.startedAt;
      // A chamada do núcleo só volta ao fim, então o primeiro byte não é medido à parte: responder depois
      // do aviso (SLOW_AFTER_MS) conta como lento.
      return {
        phase: 'passed',
        id: state.id,
        purpose: state.purpose,
        startedAt: state.startedAt,
        elapsedMs: elapsed,
        slow: state.slow || elapsed >= SLOW_AFTER_MS,
      };
    }

    case 'failed': {
      if (state.phase !== 'verifying' && state.phase !== 'passed') return state;
      if (state.id !== event.id) return state;
      return failedState(state, event.failure, event.at);
    }

    case 'saved': {
      if (state.phase !== 'passed' || state.id !== event.id || state.purpose !== 'save') return state;
      return { phase: 'saved', id: state.id, elapsedMs: state.elapsedMs, slow: state.slow };
    }
  }
}

/** Há uma verificação em curso (o botão Salvar fica desabilitado). */
export function isVerifying(state: VerifyState): boolean {
  return state.phase === 'verifying';
}

/** Salvar desabilitado: verificando, ou a verificação passou e a gravação está em curso. */
export function isSaveBusy(state: VerifyState): boolean {
  return state.phase === 'verifying' || (state.phase === 'passed' && state.purpose === 'save');
}

/** Mostrar as opções rápidas (modelos recomendados): lento, sem resposta ou modelo indisponível. */
export function offersQuickPicks(state: VerifyState): boolean {
  if (state.phase === 'verifying') return state.slow;
  if (state.phase === 'passed' || state.phase === 'saved') return state.slow;
  if (state.phase === 'failed') return state.failure.reason === 'model_unavailable' || state.failure.reason === 'timeout';
  return false;
}

export function timeoutFailure(ms: number): VerifyFailure {
  return {
    reason: 'timeout',
    message: SETTINGS_COPY.verifyModel.timeout(seconds(ms)),
  };
}

/**
 * Classifica a falha de checkProviderModel (ou de gravação) em motivo e frase para o usuário. Em 401/403/404 o
 * `probe` diz se a chave é aceita: com chave aceita, a falha é do modelo (sem acesso ou inexistente) e a frase
 * diz isso; com chave recusada (ou sem resposta conclusiva), a frase fala da chave.
 */
export function failureOf(error: unknown, model: string, probe: KeyProbe = 'unknown'): VerifyFailure {
  if (error instanceof LLMError) {
    const status = error.status;
    switch (error.code) {
      case 'auth':
      case 'not_found': {
        const fallbackStatus = error.code === 'auth' ? 401 : 404;
        if (probe === 'valid') return modelDenied(status ?? fallbackStatus);
        if (probe === 'invalid') return invalidKey(status ?? fallbackStatus);
        if (error.code === 'auth') {
          return { reason: 'auth', message: SETTINGS_COPY.verifyModel.keyRejected(status ?? 401) };
        }
        return {
          reason: 'model_unavailable',
          message: SETTINGS_COPY.verifyModel.modelMissing(model, status ?? 404),
        };
      }
      case 'timeout':
        return { reason: 'timeout', message: SETTINGS_COPY.verifyModel.midway };
      case 'network':
        return { reason: 'network', message: SETTINGS_COPY.verifyModel.noConnection };
      case 'rate_limit':
        return { reason: 'rate_limit', message: SETTINGS_COPY.verifyModel.rateLimit };
      case 'server':
        return { reason: 'server', message: SETTINGS_COPY.verifyModel.serverDown(status ?? 500) };
      case 'config':
        return { reason: 'config', message: error.message };
      case 'protocol':
        return { reason: 'protocol', message: SETTINGS_COPY.verifyModel.badFormat };
      default:
        return { reason: 'other', message: error.message };
    }
  }
  const text = error instanceof Error ? error.message : String(error);
  return { reason: 'other', message: text || SETTINGS_COPY.verifyModel.unknownFailure };
}

/** O provedor aceita a chave (listagem funciona), mas não este modelo: sem acesso ou inexistente. */
function modelDenied(status: number): VerifyFailure {
  return {
    reason: 'model_unavailable',
    message: SETTINGS_COPY.verifyModel.modelDenied(status),
  };
}

function invalidKey(status: number): VerifyFailure {
  return { reason: 'auth', message: SETTINGS_COPY.verifyModel.keyInvalid(status) };
}

/** Pelo resultado da listagem de modelos (com a mesma chave): aceita, recusada ou inconclusiva. */
export function keyProbeOf(listing: { ok: true } | { ok: false; error: unknown }): KeyProbe {
  if (listing.ok) return 'valid';
  return listing.error instanceof LLMError && listing.error.code === 'auth' ? 'invalid' : 'unknown';
}

/**
 * Assinatura da verificação: presetId, URL base, modelo, corpo extra e uma impressão da chave (FNV-1a, sem a
 * chave em texto). Duas tentativas com a mesma assinatura testam a mesma coisa.
 */
export function verifySignature(
  input: { presetId: string; baseUrl: string; model: string; extraBody?: Record<string, unknown> },
  key: string,
): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return JSON.stringify([input.presetId, input.baseUrl, input.model, input.extraBody ?? null, hash.toString(16), key.length]);
}

/** Um sucesso anterior (assinatura e horário) ainda vale para esta assinatura? */
export function canReusePass(pass: { signature: string; at: number } | null, signature: string, now: number): boolean {
  if (!pass || pass.signature !== signature) return false;
  const age = now - pass.at;
  return age >= 0 && age <= KEY_REUSE_MS;
}

/** Sugestões por motivo (o que o usuário pode fazer a seguir), no idioma do app. */
export function suggestionsFor(reason: FailureReason): string[] {
  return [...SETTINGS_COPY.verifyModel.suggest[reason]];
}

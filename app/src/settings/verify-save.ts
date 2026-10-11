// Verificação do modelo antes de salvar a conexão com um provedor de chave (Assistente de IA).
// Módulo puro (sem React): a tela envia `start`, `tick` (a cada ~250 ms), `passed`/`failed` (resultado de
// checkProviderModel) e `saved` (depois de gravar). Um id por tentativa: resultado de tentativa antiga
// (cancelada ou trocada) é ignorado. Testado em verify-save.test.ts.
import { LLMError } from '@sensus/core';

/** Sem resposta por este tempo, a verificação mostra o aviso de lentidão (salvar continua possível). */
export const SLOW_AFTER_MS = 8_000;
/** Sem resposta por este tempo, a verificação falha por tempo esgotado (nada é salvo). */
export const VERIFY_TIMEOUT_MS = 30_000;

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

const seconds = (ms: number) => Math.max(1, Math.round(ms / 1000));

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

function timeoutFailure(ms: number): VerifyFailure {
  return {
    reason: 'timeout',
    message: `O provedor não respondeu em ${seconds(ms)} s. A conexão não foi salva.`,
  };
}

/** Classifica a falha de checkProviderModel (ou de gravação) em motivo e frase para o usuário. */
export function failureOf(error: unknown, model: string): VerifyFailure {
  if (error instanceof LLMError) {
    const status = error.status;
    switch (error.code) {
      case 'auth':
        return { reason: 'auth', message: `Chave de API rejeitada pelo provedor (HTTP ${status ?? 401}).` };
      case 'not_found':
        return {
          reason: 'model_unavailable',
          message: `O modelo ${model} não está disponível para esta conta (HTTP ${status ?? 404}).`,
        };
      case 'timeout':
        return { reason: 'timeout', message: 'O provedor parou de responder no meio do caminho.' };
      case 'network':
        return { reason: 'network', message: 'Não foi possível conectar ao provedor.' };
      case 'rate_limit':
        return { reason: 'rate_limit', message: 'O provedor recusou por limite de requisições (HTTP 429).' };
      case 'server':
        return { reason: 'server', message: `O provedor está indisponível agora (HTTP ${status ?? 500}).` };
      case 'config':
        return { reason: 'config', message: error.message };
      case 'protocol':
        return { reason: 'protocol', message: 'O provedor respondeu em um formato inesperado.' };
      default:
        return { reason: 'other', message: error.message };
    }
  }
  const text = error instanceof Error ? error.message : String(error);
  return { reason: 'other', message: text || 'Falha desconhecida.' };
}

/** Sugestões por motivo (o que o usuário pode fazer a seguir). */
export function suggestionsFor(reason: FailureReason): string[] {
  switch (reason) {
    case 'auth':
      return ['Confira a chave de API; cole de novo se preciso.', 'Veja se a chave está ativa no site do provedor.'];
    case 'model_unavailable':
      return ['Escolha outro modelo (os recomendados aparecem logo abaixo, quando houver).', 'Confira o nome do modelo.'];
    case 'timeout':
      return ['Tente de novo.', 'Um modelo mais rápido costuma responder em segundos.'];
    case 'network':
      return ['Verifique a conexão com a internet.', 'Confira a URL base.'];
    case 'rate_limit':
      return ['Aguarde alguns minutos e tente de novo.'];
    case 'server':
      return ['Tente de novo em instantes.', 'Ou escolha outro modelo.'];
    case 'config':
      return ['Preencha a URL base e o modelo.'];
    case 'protocol':
      return ['Confira a URL base: ela deve ser uma API compatível com a da OpenAI.'];
    case 'save':
      return ['A conexão foi verificada, mas não pôde ser gravada. Tente de novo.'];
    case 'other':
      return ['Tente de novo.', 'Confira a URL base, a chave e o modelo.'];
  }
}

/** Títulos de estado (pt-BR), usados pela tela. */
export const VERIFY_COPY = {
  verifying: 'Verificando modelo…',
  slowPending: `Demorando mais de ${seconds(SLOW_AFTER_MS)} s. Um modelo mais rápido costuma responder em segundos.`,
  slowDone: (ms: number) => `Funciona, mas está lento (respondeu em ${seconds(ms)} s). Um modelo mais rápido costuma responder em segundos.`,
  okCheck: '✓ Disponível para respostas.',
  saved: 'Configurações salvas.',
  savedSlow: 'Salvo. Funciona, mas está lento. Um modelo mais rápido costuma responder em segundos.',
  failedSave: 'Não salvo: o modelo não passou na verificação.',
  failedCheck: 'Modelo não verificado.',
  cancel: 'Cancelar',
} as const;

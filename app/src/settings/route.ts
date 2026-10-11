// Escolha do provedor e reação às falhas do plano ChatGPT. Módulo puro (sem React Native), testado em
// route.test.ts. Regras em docs/AI_PROVIDERS.md ("Política de escolha e reserva").
import { chatGPTFailureOf, type ChatGPTFailure } from '@sensus/core';

/** Modo escolhido em Configurações. */
export type ProviderMode = 'auto' | 'chatgpt' | 'key';

export const PROVIDER_MODES: readonly ProviderMode[] = ['auto', 'chatgpt', 'key'];
export const DEFAULT_PROVIDER_MODE: ProviderMode = 'auto';

/**
 * Quando o horário de volta do limite não é informado, o ChatGPT volta a ser tentado na próxima pergunta
 * real depois deste tempo (sem chamadas de teste).
 */
export const CHATGPT_LIMIT_RETRY_MS = 10 * 60 * 1000;

export function isProviderMode(v: unknown): v is ProviderMode {
  return typeof v === 'string' && (PROVIDER_MODES as readonly string[]).includes(v);
}

/** Pausa do ChatGPT depois de um limite. `known`: o horário veio do erro ou dos cabeçalhos. */
export interface ChatGPTPause {
  until: number;
  known: boolean;
}

/** Fim da pausa: o horário informado pelo limite, ou agora + CHATGPT_LIMIT_RETRY_MS. */
export function pauseFor(now: number, resetAt?: number): ChatGPTPause {
  if (resetAt !== undefined && resetAt > now) return { until: resetAt, known: true };
  return { until: now + CHATGPT_LIMIT_RETRY_MS, known: false };
}

export function isPaused(pause: ChatGPTPause | null, now: number): boolean {
  return !!pause && pause.until > now;
}

/** O que fazer quando o ChatGPT falha no pedido. */
export type FailureAction =
  /** Conta precisa de atenção: não usa a chave; mostra o aviso e o erro. */
  | { kind: 'attention'; reason: 'reauth' | 'not_eligible' }
  /** Repete o mesmo pedido com a chave de API. */
  | { kind: 'fallback'; pause?: ChatGPTPause }
  /** Sem reserva (Só ChatGPT, ou sem chave): mostra o erro. `pause` só existe no modo Automático. */
  | { kind: 'error'; pause?: ChatGPTPause };

/**
 * `pause`: limite do plano no modo Automático pausa o ChatGPT (com ou sem chave, para não insistir no
 * limite). No modo Só ChatGPT não há pausa. Falha transitória não pausa.
 */
export function decideChatGPTFailure(
  failure: ChatGPTFailure,
  input: { mode: ProviderMode; hasFallback: boolean; now: number; resetAt?: number },
): FailureAction {
  if (failure === 'reauth' || failure === 'not_eligible') return { kind: 'attention', reason: failure };
  const limit = failure === 'plan_limit' || failure === 'rate_limit';
  const pause = limit && input.mode === 'auto' ? pauseFor(input.now, input.resetAt) : undefined;
  if (!input.hasFallback) return pause ? { kind: 'error', pause } : { kind: 'error' };
  return pause ? { kind: 'fallback', pause } : { kind: 'fallback' };
}

/** Atalho: classifica um erro (LLMError ou não) e decide. */
export function decideError(
  err: unknown,
  input: { mode: ProviderMode; hasFallback: boolean; now: number },
): FailureAction {
  const resetAt = (err as { resetAt?: number } | null)?.resetAt;
  return decideChatGPTFailure(chatGPTFailureOf(err), { ...input, resetAt });
}

/** Estado da conta ChatGPT para a escolha (derivado de auth/chatgpt/service.ts, sem tokens). */
export interface ChatGPTRouteState {
  /** Conta salva e não encerrada pelo usuário. */
  connected: boolean;
  /** Pronta para uso: sessão, permissão do plano, sem recusa, e modelo escolhido. */
  ready: boolean;
  /** Precisa de atenção (sessão recusada ou conta sem plano). Nunca troca para a chave. */
  attention: boolean;
}

export type RouteChoice =
  /** Só o ChatGPT (sem reserva). Usado no modo Só ChatGPT e nas contas com atenção. */
  | 'chatgpt'
  /** ChatGPT primeiro, com a chave como reserva. */
  | 'chatgpt-with-key'
  /** Só a chave de API. */
  | 'key'
  /** Nenhum método disponível agora (Só ChatGPT sem plano). */
  | 'none';

/**
 * Escolha por modo, conta e pausa:
 * - Só chave: sempre a chave (o ChatGPT é ignorado).
 * - Só ChatGPT: o ChatGPT, sem reserva; nunca a chave.
 * - Automático: conta com atenção nunca usa a chave; com o plano pronto e sem pausa, ChatGPT com reserva.
 */
export function chooseRoute(
  mode: ProviderMode,
  chatgpt: ChatGPTRouteState | null,
  pause: ChatGPTPause | null,
  now: number,
): RouteChoice {
  if (mode === 'key') return 'key';
  const account = chatgpt ?? { connected: false, ready: false, attention: false };
  if (mode === 'chatgpt') return account.ready || account.attention ? 'chatgpt' : 'none';
  if (account.attention) return 'chatgpt';
  if (account.ready && !isPaused(pause, now)) return 'chatgpt-with-key';
  return 'key';
}

// Erro comum dos provedores de IA (código estável para a UI decidir o que fazer).
export type LLMErrorCode =
  | 'config'
  | 'auth'
  | 'not_found'
  | 'rate_limit'
  | 'server'
  | 'http'
  | 'network'
  | 'timeout'
  | 'protocol'
  /** Plano ChatGPT: conta não elegível (403). Não repetir nem refazer OAuth; cair para outro provedor. */
  | 'plan_not_eligible'
  /** Plano ChatGPT: limite de uso atingido (429). Pausar pedidos pelo plano. */
  | 'plan_limit'
  /** Plano ChatGPT: uso indisponível agora (503). Manter credenciais e tentar depois. */
  | 'plan_unavailable'
  /** Plano ChatGPT: parâmetro ou rota não suportados (400/403). Corrigir o pedido; não repetir igual. */
  | 'plan_unsupported'
  /** Plano ChatGPT: a sessão precisa ser refeita (401 após renovação, token revogado, permissão do plano recusada). */
  | 'reauth';

export class LLMError extends Error {
  readonly code: LLMErrorCode;
  readonly status: number | undefined;
  /** Horário (epoch em ms) em que um limite de uso volta, quando o erro ou os cabeçalhos informam. */
  readonly resetAt: number | undefined;

  constructor(message: string, code: LLMErrorCode, status?: number, resetAt?: number) {
    super(message);
    this.name = 'LLMError';
    this.code = code;
    this.status = status;
    this.resetAt = resetAt;
  }
}

/**
 * O que a escolha de provedor faz com uma falha do plano ChatGPT (política do Sensus, docs/AI_PROVIDERS.md):
 * - plan_limit: limite do plano (429 de cota). Pausa o ChatGPT e repete com a chave de API.
 * - rate_limit: 429 sem código de plano. Mesmo tratamento do limite.
 * - reauth: sessão ou permissão recusada. Não usa a chave; pede atenção nas Configurações.
 * - not_eligible: conta sem o plano (403). Não usa a chave; pede atenção.
 * - transient: qualquer outra falha (5xx, rede, parada, protocolo, pedido recusado). Repete com a chave, sem pausa.
 */
export type ChatGPTFailure = 'plan_limit' | 'rate_limit' | 'reauth' | 'not_eligible' | 'transient';

export function chatGPTFailureOf(err: unknown): ChatGPTFailure {
  if (!(err instanceof LLMError)) return 'transient';
  switch (err.code) {
    case 'plan_limit':
      return 'plan_limit';
    case 'rate_limit':
      return 'rate_limit';
    case 'reauth':
      return 'reauth';
    case 'plan_not_eligible':
      return 'not_eligible';
    default:
      return 'transient';
  }
}

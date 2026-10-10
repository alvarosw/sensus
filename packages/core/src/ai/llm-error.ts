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
  /** Plano ChatGPT: a sessão precisa ser refeita (401 após renovação, ou token revogado). */
  | 'reauth';

export class LLMError extends Error {
  readonly code: LLMErrorCode;
  readonly status: number | undefined;

  constructor(message: string, code: LLMErrorCode, status?: number) {
    super(message);
    this.name = 'LLMError';
    this.code = code;
    this.status = status;
  }
}

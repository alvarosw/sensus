// Provedor do plano ChatGPT (Sign in with ChatGPT): Responses API (POST /v1/responses) com SSE.
// Limites da prévia (developers.openai.com/siwc/token-sharing-open-source/preview-limitations):
// store=false e stream=true obrigatórios; mensagens de sistema vão em `instructions` (role system
// é recusado no input); temperature, max_output_tokens e previous_response_id não são aceitos,
// por isso maxTokens/temperature do pedido são ignorados e o histórico é reenviado a cada pergunta.
import type { ChatMessage, ChatRequest, FetchLike, LLMProvider, ProviderConfig } from '../types';
import { LLMError } from './llm-error';
import { resetAtOf } from './reset';
import { readSSEData, StallWatch, STALL_TIMEOUT_MS } from './sse';

export interface ChatGPTModel {
  /** Id a enviar em `model`. */
  slug: string;
  displayName: string;
}

export type AccessTokenGetter = (opts?: { forceRefresh?: boolean }) => Promise<string>;

interface ErrorBody {
  error?: { code?: unknown; message?: unknown; param?: unknown };
  detail?: unknown;
  message?: unknown;
}

/** Erro de plano (códigos subscription_sharing_* e chatpass_v2_*), ou null se o código não for de plano. */
export function planCodeError(code: string, status: number, param?: string, resetAt?: number): LLMError | null {
  const at = param ? ` (parâmetro: ${param})` : '';
  switch (code) {
    case 'subscription_sharing_user_not_eligible':
      return new LLMError(
        'Esta conta não pode usar o plano do ChatGPT (requer Go, Plus ou Pro). Use uma chave de API ou outra conta.',
        'plan_not_eligible',
        status,
      );
    case 'subscription_sharing_usage_limit_exceeded':
      return new LLMError(
        'Limite de uso do plano ChatGPT atingido. Veja o uso em ChatGPT > Configurações > Uso.',
        'plan_limit',
        status,
        resetAt,
      );
    case 'subscription_sharing_usage_unavailable':
    case 'subscription_sharing_user_unavailable':
      return new LLMError('O uso do plano ChatGPT está indisponível agora. Tente de novo em instantes.', 'plan_unavailable', status);
    case 'subscription_sharing_unsupported_capability':
      return new LLMError(`Pedido não suportado pelo plano ChatGPT${at}.`, 'plan_unsupported', status);
    case 'subscription_sharing_route_not_supported':
      return new LLMError('Rota não suportada pelo plano ChatGPT. Verifique a versão do Sensus.', 'plan_unsupported', status);
    case 'subscription_sharing_invalid_user':
      return new LLMError('A sessão do ChatGPT não é mais válida. Entre de novo nas configurações.', 'reauth', status);
    case 'chatpass_v2_scope_not_authorized':
    case 'chatpass_v2_invalid_authorization_context':
      // Permissão do plano recusada ou contexto inválido: precisa de novo login e consentimento (não usa a chave).
      return new LLMError(
        'A permissão do plano ChatGPT não foi concedida para este login. Entre de novo e aceite o uso do plano.',
        'reauth',
        status,
      );
    default:
      return null;
  }
}

function stringField(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

/**
 * Converte uma resposta HTTP de erro (antes do stream) em LLMError. Não inclui tokens.
 * `headers` (da resposta) e o corpo informam `resetAt` quando trazem o horário de volta do limite.
 */
export function chatGPTHttpError(status: number, body: unknown, headers?: Headers, nowMs = Date.now()): LLMError {
  const b = (body && typeof body === 'object' ? body : {}) as ErrorBody;
  const code = stringField(b.error?.code);
  const param = stringField(b.error?.param);
  const detail = stringField(b.error?.message) ?? stringField(b.detail) ?? stringField(b.message);
  const resetAt = resetAtOf({ headers, body }, nowMs);
  if (code) {
    const mapped = planCodeError(code, status, param, resetAt);
    if (mapped) return mapped;
  }
  // Admissão antes do stream: corpo {"detail": "..."} é diagnóstico, não código estável.
  if (status === 401) return new LLMError('A sessão do ChatGPT foi recusada. Entre de novo nas configurações.', 'reauth', status);
  if (status === 403) {
    return new LLMError(`Acesso negado pelo ChatGPT (política ou permissão)${detail ? `: ${detail}` : '.'}`, 'plan_unsupported', status);
  }
  if (status === 429) {
    return new LLMError('Limite de requisições atingido no ChatGPT. Aguarde um pouco.', 'rate_limit', status, resetAt);
  }
  if (status === 503) return new LLMError('O plano ChatGPT está indisponível agora. Tente de novo em instantes.', 'plan_unavailable', status);
  if (status >= 500) return new LLMError(`O ChatGPT está indisponível no momento (HTTP ${status}).`, 'server', status);
  return new LLMError(`Erro do ChatGPT (HTTP ${status})${detail ? `: ${detail}` : '.'}`, 'http', status);
}

/** Separa mensagens de sistema (instructions) das de conversa (input). */
export function toResponsesInput(messages: readonly ChatMessage[]): {
  instructions: string | undefined;
  input: Array<{ role: 'user' | 'assistant'; content: string }>;
} {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content.trim()).filter(Boolean);
  const input = messages
    .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));
  return { instructions: system.length > 0 ? system.join('\n\n') : undefined, input };
}

function eventError(ev: Record<string, unknown>, nowMs = Date.now()): LLMError {
  const nested = ev.response && typeof ev.response === 'object' ? (ev.response as { error?: unknown }).error : undefined;
  const candidates = [nested, ev.error, ev].filter((c): c is Record<string, unknown> => !!c && typeof c === 'object');
  const code = candidates.map((c) => stringField(c.code)).find(Boolean);
  const param = candidates.map((c) => stringField(c.param)).find(Boolean);
  const resetAt = candidates.map((c) => resetAtOf({ body: { error: c } }, nowMs)).find((v) => v !== undefined) ?? resetAtOf({ body: ev }, nowMs);
  if (code) {
    const mapped = planCodeError(code, 200, param, resetAt);
    if (mapped) return mapped;
  }
  const message = candidates.map((c) => stringField(c.message)).find(Boolean);
  return new LLMError(`O ChatGPT retornou erro${message ? `: ${message.slice(0, 300)}` : '.'}`, 'http');
}

export class OpenAIResponsesProvider implements LLMProvider {
  readonly config: ProviderConfig;
  private readonly fetchImpl: FetchLike;
  private readonly getAccessToken: AccessTokenGetter;

  constructor(config: ProviderConfig, fetchImpl: FetchLike, getAccessToken: AccessTokenGetter) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.getAccessToken = getAccessToken;
  }

  /** Emite o texto conforme chega. Sucesso só após response.completed (regra do docs). */
  async *stream(req: ChatRequest): AsyncGenerator<string> {
    if (!this.config.baseUrl) throw new LLMError('Base URL não definida para o ChatGPT.', 'config');
    if (!this.config.model) {
      throw new LLMError('Escolha um modelo do ChatGPT nas configurações (a lista vem da sua conta).', 'config');
    }
    const { instructions, input } = toResponsesInput(req.messages);
    if (input.length === 0) throw new LLMError('Nenhuma mensagem para enviar ao ChatGPT.', 'config');
    const body = JSON.stringify({
      model: this.config.model,
      input,
      ...(instructions ? { instructions } : {}),
      store: false,
      stream: true,
    });

    const controller = new AbortController();
    const abortFromCaller = () => controller.abort();
    if (req.signal?.aborted) controller.abort();
    req.signal?.addEventListener('abort', abortFromCaller);
    const watch = new StallWatch(req.stallMs ?? STALL_TIMEOUT_MS, this.config.label, () => controller.abort());
    let produced = false;
    let completed = false;

    try {
      const res = await Promise.race([
        this.send('/responses', 'POST', body, 'text/event-stream', controller.signal),
        watch.failed,
      ]);
      watch.touch();
      if (!res.body) throw new LLMError('O ChatGPT devolveu uma resposta sem stream.', 'protocol');

      const contentType = res.headers.get('content-type') ?? '';
      if (contentType && !contentType.includes('text/event-stream')) {
        throw new LLMError('Resposta do ChatGPT em formato inesperado (esperado stream de eventos).', 'protocol');
      }

      const lines: string[] = [];
      stream: for await (const data of readSSEData(res.body, lines, watch)) {
        if (data === '' || data === '[DONE]') continue;
        let ev: Record<string, unknown>;
        try {
          ev = JSON.parse(data) as Record<string, unknown>;
        } catch {
          throw new LLMError('Evento do ChatGPT em formato inesperado.', 'protocol');
        }
        const type = typeof ev.type === 'string' ? ev.type : '';
        switch (type) {
          case 'response.output_text.delta': {
            const delta = typeof ev.delta === 'string' ? ev.delta : '';
            if (delta) {
              produced = true;
              yield delta;
            }
            break;
          }
          case 'response.failed':
          case 'error':
            throw eventError(ev);
          case 'response.incomplete':
            throw new LLMError('A resposta do ChatGPT ficou incompleta (limite de saída ou interrupção).', 'protocol');
          case 'response.completed':
            completed = true;
            break stream;
          default:
            // Raciocínio: os nomes exatos dos eventos não estão no docs; aceita qualquer response.reasoning*.delta.
            if (/^response\.reasoning.*\.delta$/.test(type)) req.onReasoning?.();
        }
      }

      if (!completed) throw new LLMError('A conexão com o ChatGPT terminou antes de a resposta ser concluída.', 'protocol');
      if (!produced) throw new LLMError('O ChatGPT não devolveu texto. Tente de novo.', 'protocol');
    } finally {
      watch.stop();
      req.signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  /** Modelos da conta (GET /v1/models), só os visíveis (visibility = "list"), na ordem do servidor. */
  async listModelInfo(): Promise<ChatGPTModel[]> {
    const res = await this.send('/models', 'GET', undefined, 'application/json');
    let payload: { models?: unknown };
    try {
      payload = (await res.json()) as { models?: unknown };
    } catch {
      throw new LLMError('Lista de modelos do ChatGPT não é JSON válido.', 'protocol');
    }
    if (!Array.isArray(payload.models)) throw new LLMError('Lista de modelos do ChatGPT fora do formato esperado.', 'protocol');
    return payload.models
      .filter((m): m is { slug: string; visibility?: unknown; display_name?: unknown } => {
        const r = m as Record<string, unknown> | null;
        return !!r && typeof r.slug === 'string' && r.visibility === 'list';
      })
      .map((m) => ({ slug: m.slug, displayName: stringField(m.display_name) ?? m.slug }));
  }

  async listModels(): Promise<string[]> {
    return (await this.listModelInfo()).map((m) => m.slug);
  }

  /**
   * Chamada autenticada. Renova o token e tenta de novo uma vez após 401; sem fallback para outro
   * caminho de cobrança: erros de plano interrompem a inferência.
   */
  private async send(
    path: string,
    method: 'GET' | 'POST',
    body: string | undefined,
    accept: string,
    signal?: AbortSignal,
    forceRefresh = false,
  ): Promise<Response> {
    let token: string;
    try {
      token = await this.getAccessToken({ forceRefresh });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      if (err instanceof LLMError) throw err;
      throw new LLMError('Sessão do ChatGPT indisponível. Entre de novo nas configurações.', 'reauth');
    }

    const url = `${this.config.baseUrl.replace(/\/+$/, '')}${path}`;
    const headers: Record<string, string> = { Accept: accept, Authorization: `Bearer ${token}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let res: Response;
    try {
      res = await this.fetchImpl(url, { method, headers, body, signal });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      throw new LLMError('Falha de rede ao contatar o ChatGPT. Verifique a conexão.', 'network');
    }
    if (res.ok) return res;

    if (res.status === 401 && !forceRefresh) {
      await res.text().catch(() => '');
      return this.send(path, method, body, accept, signal, true);
    }
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(await res.text());
    } catch {
      parsed = null;
    }
    throw chatGPTHttpError(res.status, parsed, res.headers);
  }
}

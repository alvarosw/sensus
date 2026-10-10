// Provedores de LLM. O primeiro adaptador fala o protocolo OpenAI (/chat/completions com SSE).
// Para outro provedor, basta um novo arquivo que implemente LLMProvider e um ramo em createProvider.
import type { ChatRequest, FetchLike, LLMProvider, ProviderConfig } from '../types';
import { LLMError, type LLMErrorCode } from './llm-error';
import { readSSEData, StallWatch, STALL_TIMEOUT_MS } from './sse';
import { OpenAIResponsesProvider } from './openai-responses';
export { LLMError, type LLMErrorCode } from './llm-error';
export { STALL_TIMEOUT_MS } from './sse';

interface ChatCompletionPayload {
  choices?: Array<{
    // Modelos de raciocínio (ex.: nemotron) streamam `reasoning_content` antes de `content`.
    delta?: { content?: string | null; reasoning_content?: string | null; reasoning?: string | null };
    message?: { content?: string | null };
    text?: string;
  }>;
  error?: { message?: string } | string;
  data?: Array<{ id?: string }>;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

/** Texto de uma resposta (chunk de streaming ou resposta completa). */
function extractText(payload: ChatCompletionPayload): string {
  const choice = payload.choices?.[0];
  const piece = choice?.delta?.content ?? choice?.message?.content ?? choice?.text;
  return typeof piece === 'string' ? piece : '';
}

function errorMessageOf(payload: ChatCompletionPayload): string | null {
  const err = payload.error;
  if (!err) return null;
  if (typeof err === 'string') return err;
  return err.message ?? 'erro desconhecido';
}

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return '';
    try {
      const parsed = JSON.parse(text) as ChatCompletionPayload & { message?: string };
      const message = errorMessageOf(parsed) ?? parsed.message;
      if (typeof message === 'string') return message.slice(0, 300);
    } catch {
      // corpo não é JSON: usa o texto cru abaixo
    }
    return text.slice(0, 300);
  } catch {
    return '';
  }
}
export class OpenAICompatibleProvider implements LLMProvider {
  readonly config: ProviderConfig;
  private readonly fetchImpl: FetchLike;

  constructor(config: ProviderConfig, fetchImpl: FetchLike) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  /** Emite o texto da resposta conforme chega. Lança LLMError em falhas conhecidas. */
  async *stream(req: ChatRequest): AsyncGenerator<string> {
    this.assertConfigured();
    const body = JSON.stringify({
      ...this.config.extraBody,
      model: this.config.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxTokens,
      stream: true,
    });

    // Uma requisição só: o sinal do chamador e o vigia de inatividade a abortam juntos.
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort();
    if (req.signal?.aborted) controller.abort();
    req.signal?.addEventListener('abort', abortFromCaller);
    const watch = new StallWatch(req.stallMs ?? STALL_TIMEOUT_MS, this.config.label, () => controller.abort());
    const empty = () =>
      new LLMError(
        `${this.config.label} não devolveu texto. Se o modelo raciocina, pode ter gasto o limite de tokens antes da resposta.`,
        'protocol',
      );
    let produced = false;

    try {
      const res = await Promise.race([
        this.send('/chat/completions', 'POST', body, 'text/event-stream', controller.signal),
        watch.failed,
      ]);
      watch.touch();

      if (!res.body) {
        const payload = await Promise.race([this.parsePayload(res), watch.failed]);
        const text = extractText(payload);
        if (!text) throw empty();
        yield text;
        return;
      }

      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const payload = await Promise.race([this.parsePayload(res), watch.failed]);
        const text = extractText(payload);
        if (!text) throw empty();
        yield text;
        return;
      }

      const lines: string[] = [];
      let events = 0;
      for await (const data of readSSEData(res.body, lines, watch)) {
        if (data === '') continue;
        if (data === '[DONE]') break;
        events++;
        let payload: ChatCompletionPayload;
        try {
          payload = JSON.parse(data) as ChatCompletionPayload;
        } catch {
          throw new LLMError(`Resposta do ${this.config.label} em formato inesperado.`, 'protocol');
        }
        const failure = errorMessageOf(payload);
        if (failure) throw new LLMError(`${this.config.label} retornou erro: ${failure}`, 'http');
        const delta = payload.choices?.[0]?.delta;
        if (delta?.reasoning_content || delta?.reasoning) req.onReasoning?.();
        const text = extractText(payload);
        if (text) {
          produced = true;
          yield text;
        }
      }

      if (events === 0) {
        // Servidor ignorou stream:true e devolveu JSON simples sem o content-type esperado.
        const raw = lines.join('\n').trim();
        if (!raw) throw new LLMError(`${this.config.label} devolveu uma resposta vazia.`, 'protocol');
        let payload: ChatCompletionPayload;
        try {
          payload = JSON.parse(raw) as ChatCompletionPayload;
        } catch {
          throw new LLMError(`Resposta do ${this.config.label} em formato inesperado.`, 'protocol');
        }
        const text = extractText(payload);
        if (text) {
          produced = true;
          yield text;
        }
      }

      // Fluxo que terminou sem nenhum texto (só raciocínio, ou limite de tokens): erro explícito,
      // em vez de a interface ficar aguardando para sempre.
      if (!produced) throw empty();
    } finally {
      watch.stop();
      req.signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  /** Lista os ids de modelos disponíveis (GET {baseUrl}/models). */
  async listModels(): Promise<string[]> {
    const res = await this.send('/models', 'GET', undefined, 'application/json');
    const payload = await this.parsePayload(res);
    return (payload.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => typeof id === 'string')
      .sort();
  }

  private assertConfigured(): void {
    if (!this.config.baseUrl) {
      throw new LLMError(`Base URL não definida para ${this.config.label}.`, 'config');
    }
    if (!this.config.model) {
      throw new LLMError(
        `Nenhum modelo escolhido para ${this.config.label}. Defina o modelo nas configurações do provedor.`,
        'config',
      );
    }
  }

  private async send(
    path: string,
    method: 'GET' | 'POST',
    body: string | undefined,
    accept: string,
    signal?: AbortSignal,
  ): Promise<Response> {
    const url = `${this.config.baseUrl.replace(/\/+$/, '')}${path}`;
    const headers: Record<string, string> = { Accept: accept };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.config.apiKey) headers.Authorization = `Bearer ${this.config.apiKey}`;

    let res: Response;
    try {
      res = await this.fetchImpl(url, { method, headers, body, signal });
    } catch (err) {
      if (isAbortError(err)) throw err;
      throw new LLMError(`Falha de rede ao contatar ${this.config.label}. Verifique a conexão e a base URL.`, 'network');
    }
    if (!res.ok) throw await this.httpError(res);
    return res;
  }

  private async parsePayload(res: Response): Promise<ChatCompletionPayload> {
    let payload: ChatCompletionPayload;
    try {
      payload = (await res.json()) as ChatCompletionPayload;
    } catch {
      throw new LLMError(`Resposta do ${this.config.label} não é JSON válido.`, 'protocol');
    }
    const failure = errorMessageOf(payload);
    if (failure) throw new LLMError(`${this.config.label} retornou erro: ${failure}`, 'http');
    return payload;
  }

  private async httpError(res: Response): Promise<LLMError> {
    const label = this.config.label;
    const status = res.status;
    if (status === 401 || status === 403) {
      return new LLMError(
        `Chave de API rejeitada pelo ${label} (HTTP ${status}). Confira a chave nas configurações.`,
        'auth',
        status,
      );
    }
    if (status === 404) {
      const detail = await readErrorDetail(res);
      return new LLMError(
        `Endpoint ou modelo não encontrado no ${label} (HTTP 404). Confira a base URL e o nome do modelo${detail ? `: ${detail}` : '.'}`,
        'not_found',
        status,
      );
    }
    if (status === 429) {
      return new LLMError(
        `Limite de requisições atingido no ${label} (HTTP 429). Aguarde um pouco e tente de novo.`,
        'rate_limit',
        status,
      );
    }
    if (status >= 500) {
      return new LLMError(
        `O ${label} está indisponível no momento (HTTP ${status}). Tente de novo em instantes.`,
        'server',
        status,
      );
    }
    const detail = await readErrorDetail(res);
    return new LLMError(`Erro do ${label} (HTTP ${status})${detail ? `: ${detail}` : '.'}`, 'http', status);
  }
}

export interface ProviderDeps {
  /**
   * Token de acesso do plano ChatGPT (kind 'chatgpt'). Deve renovar o token quando estiver perto de expirar.
   * `forceRefresh` é pedido após um 401, para tentar uma renovação antes de desistir.
   */
  getAccessToken?: (opts?: { forceRefresh?: boolean }) => Promise<string>;
}

/** Fábrica por tipo de provedor. Novos adaptadores entram aqui. */
export function createProvider(
  config: ProviderConfig,
  fetchImpl: FetchLike,
  deps: ProviderDeps = {},
): LLMProvider & { listModels?: () => Promise<string[]> } {
  switch (config.kind) {
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config, fetchImpl);
    case 'chatgpt':
      if (!deps.getAccessToken) {
        throw new LLMError('Sessão do ChatGPT não disponível. Entre com o ChatGPT nas configurações.', 'config');
      }
      return new OpenAIResponsesProvider(config, fetchImpl, deps.getAccessToken);
    default:
      throw new LLMError(`Tipo de provedor não suportado: ${String((config as { kind: unknown }).kind)}`, 'config');
  }
}

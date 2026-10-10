// Provedores de LLM. O primeiro adaptador fala o protocolo OpenAI (/chat/completions com SSE).
// Para outro provedor, basta um novo arquivo que implemente LLMProvider e um ramo em createProvider.
import type { ChatRequest, FetchLike, LLMProvider, ProviderConfig } from '../types';

export type LLMErrorCode =
  | 'config'
  | 'auth'
  | 'not_found'
  | 'rate_limit'
  | 'server'
  | 'http'
  | 'network'
  | 'protocol';

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

interface ChatCompletionPayload {
  choices?: Array<{
    delta?: { content?: string | null };
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

/**
 * Lê um corpo SSE e devolve o conteúdo de cada linha `data:` (sem o prefixo).
 * `collect` recebe todas as linhas, para o fallback de resposta JSON não-streamed.
 */
async function* readSSEData(body: ReadableStream<Uint8Array>, collect: string[]): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;
  const handle = (rawLine: string): string | undefined => {
    const line = rawLine.replace(/\r$/, '');
    collect.push(line);
    return line.startsWith('data:') ? line.slice(5).trim() : undefined;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf('\n');
      while (nl !== -1) {
        const data = handle(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        if (data !== undefined) yield data;
        nl = buffer.indexOf('\n');
      }
    }
    buffer += decoder.decode();
    if (buffer.length > 0) {
      const data = handle(buffer);
      if (data !== undefined) yield data;
    }
    finished = true;
  } finally {
    if (finished) {
      reader.releaseLock();
    } else {
      await reader.cancel().catch(() => undefined);
    }
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
      model: this.config.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxTokens,
      stream: true,
    });
    const res = await this.send('/chat/completions', 'POST', body, 'text/event-stream', req.signal);

    if (!res.body) {
      const payload = await this.parsePayload(res);
      const text = extractText(payload);
      if (text) yield text;
      return;
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const payload = await this.parsePayload(res);
      const text = extractText(payload);
      if (text) yield text;
      return;
    }

    const lines: string[] = [];
    let events = 0;
    for await (const data of readSSEData(res.body, lines)) {
      if (data === '') continue;
      if (data === '[DONE]') return;
      events++;
      let payload: ChatCompletionPayload;
      try {
        payload = JSON.parse(data) as ChatCompletionPayload;
      } catch {
        throw new LLMError(`Resposta do ${this.config.label} em formato inesperado.`, 'protocol');
      }
      const failure = errorMessageOf(payload);
      if (failure) throw new LLMError(`${this.config.label} retornou erro: ${failure}`, 'http');
      const text = extractText(payload);
      if (text) yield text;
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
      if (text) yield text;
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

/** Fábrica por tipo de provedor. Novos adaptadores entram aqui. */
export function createProvider(config: ProviderConfig, fetchImpl: FetchLike): LLMProvider & { listModels?: () => Promise<string[]> } {
  switch (config.kind) {
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config, fetchImpl);
    default:
      throw new LLMError(`Tipo de provedor não suportado: ${String((config as { kind: unknown }).kind)}`, 'config');
  }
}

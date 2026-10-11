import { describe, expect, it } from 'vitest';
import { buildProviderConfig, LLMError, OpenAICompatibleProvider, type FetchLike, type ProviderConfig } from '../src/index';

const encoder = new TextEncoder();

function sseResponse(chunks: string[], status = 200): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status, headers: { 'content-type': 'text/event-stream' } });
}

function config(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'nvidia',
    kind: 'openai-compatible',
    label: 'NVIDIA (teste)',
    baseUrl: 'https://provider.test/v1/',
    apiKey: 'segredo',
    model: 'modelo-x',
    ...overrides,
  };
}

async function collect(provider: OpenAICompatibleProvider): Promise<string> {
  let out = '';
  for await (const piece of provider.stream({ messages: [{ role: 'user', content: 'oi' }] })) out += piece;
  return out;
}

describe('OpenAICompatibleProvider.stream', () => {
  it('lê SSE mesmo com linhas quebradas entre chunks e para em [DONE]', async () => {
    const payload = [
      'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Olá"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" mundo [[txt:blivre:50002005]]"}}]}\n\n',
      'data: [DONE]\n\n',
      'data: {"choices":[{"delta":{"content":"ignorado"}}]}\n\n',
    ].join('');
    // Quebra o corpo em pedaços de tamanhos arbitrários (inclusive no meio de uma linha e de um UTF-8).
    const chunks: string[] = [];
    for (let i = 0; i < payload.length; i += 7) chunks.push(payload.slice(i, i + 7));

    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: FetchLike = async (url, init) => {
      calls.push({ url, init });
      return sseResponse(chunks);
    };

    const text = await collect(new OpenAICompatibleProvider(config(), fetchImpl));
    expect(text).toBe('Olá mundo [[txt:blivre:50002005]]');

    expect(calls[0]?.url).toBe('https://provider.test/v1/chat/completions');
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer segredo');
    const body = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ model: 'modelo-x', stream: true, temperature: 0.2 });
    expect(body.max_tokens).toBeUndefined();
  });

  it('aceita UTF-8 quebrado entre chunks', async () => {
    const bytes = encoder.encode('data: {"choices":[{"delta":{"content":"ἐν Ἰησοῦ"}}]}\n\n');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3));
        controller.close();
      },
    });
    const fetchImpl: FetchLike = async () => new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
    expect(await collect(new OpenAICompatibleProvider(config(), fetchImpl))).toBe('ἐν Ἰησοῦ');
  });

  it('usa a resposta JSON completa quando o servidor não faz streaming', async () => {
    const fetchImpl: FetchLike = async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'Resposta inteira' } }] }), {
        headers: { 'content-type': 'application/json' },
      });
    expect(await collect(new OpenAICompatibleProvider(config(), fetchImpl))).toBe('Resposta inteira');
  });

  it('usa res.json() quando não há corpo legível', async () => {
    const fetchImpl: FetchLike = async () =>
      ({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: null,
        json: async () => ({ choices: [{ message: { content: 'via json' } }] }),
      }) as unknown as Response;
    expect(await collect(new OpenAICompatibleProvider(config(), fetchImpl))).toBe('via json');
  });

  it('usa o fallback JSON quando o corpo não é SSE e não tem content-type', async () => {
    const fetchImpl: FetchLike = async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'sem tipo' } }] }, null, 2), {
        headers: { 'content-type': 'text/plain' },
      });
    expect(await collect(new OpenAICompatibleProvider(config(), fetchImpl))).toBe('sem tipo');
  });

  it('transforma erros HTTP em mensagens claras', async () => {
    const cases: Array<[number, string, string]> = [
      [401, 'auth', 'Chave de API rejeitada'],
      [429, 'rate_limit', 'Limite de requisições'],
      [503, 'server', 'indisponível'],
      [404, 'not_found', 'Endpoint ou modelo não encontrado'],
      [400, 'http', 'HTTP 400'],
    ];
    for (const [status, code, fragment] of cases) {
      const fetchImpl: FetchLike = async () =>
        new Response(JSON.stringify({ error: { message: 'detalhe' } }), { status, headers: { 'content-type': 'application/json' } });
      const provider = new OpenAICompatibleProvider(config(), fetchImpl);
      const error = await collect(provider).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(LLMError);
      expect((error as LLMError).code).toBe(code);
      expect((error as LLMError).status).toBe(status);
      expect((error as LLMError).message).toContain(fragment);
    }
  });

  it('reporta falha de rede e erro no próprio stream', async () => {
    const offline: FetchLike = async () => {
      throw new TypeError('fetch failed');
    };
    const networkError = await collect(new OpenAICompatibleProvider(config(), offline)).catch((e: unknown) => e);
    expect((networkError as LLMError).code).toBe('network');

    const inStream: FetchLike = async () => sseResponse(['data: {"error":{"message":"quota"}}\n\n']);
    const streamError = await collect(new OpenAICompatibleProvider(config(), inStream)).catch((e: unknown) => e);
    expect((streamError as LLMError).code).toBe('http');
    expect((streamError as LLMError).message).toContain('quota');
  });

  it('recusa modelo vazio antes de chamar a rede', async () => {
    let called = false;
    const fetchImpl: FetchLike = async () => {
      called = true;
      return sseResponse([]);
    };
    const provider = new OpenAICompatibleProvider(config({ model: '' }), fetchImpl);
    const error = await collect(provider).catch((e: unknown) => e);
    expect((error as LLMError).code).toBe('config');
    expect(called).toBe(false);
  });

  it('avisa do raciocínio antes do texto e não o trata como resposta', async () => {
    const reasoning = (t: string) => `data: {"choices":[{"delta":{"reasoning_content":"${t}"}}]}\r\n\r\n`;
    const chunks = [reasoning('pensando'), reasoning(' mais'), 'data: {"choices":[{"delta":{"content":"Pronto"}}]}\r\n\r\n', 'data: [DONE]\r\n\r\n'];
    let thinking = 0;
    const provider = new OpenAICompatibleProvider(config(), async () => sseResponse(chunks));
    let text = '';
    for await (const piece of provider.stream({ messages: [], onReasoning: () => thinking++ })) text += piece;
    expect(thinking).toBe(2);
    expect(text).toBe('Pronto');
  });

  it('erro explícito quando o fluxo termina só com raciocínio', async () => {
    const chunks = ['data: {"choices":[{"delta":{"reasoning_content":"hmm"}}]}\n\n', 'data: [DONE]\n\n'];
    const provider = new OpenAICompatibleProvider(config(), async () => sseResponse(chunks));
    const error = await collect(provider).catch((e: unknown) => e);
    expect((error as LLMError).code).toBe('protocol');
    expect((error as LLMError).message).toContain('limite de tokens');
  });

  it('aborta e reporta timeout quando nenhum byte chega dentro do prazo', async () => {
    let aborted = false;
    const hanging: FetchLike = async (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          aborted = true;
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
      });
    const provider = new OpenAICompatibleProvider(config(), hanging);
    const error = await provider.stream({ messages: [], stallMs: 30 }).next().catch((e: unknown) => e);
    expect((error as LLMError).code).toBe('timeout');
    expect(aborted).toBe(true);
  });

  it('o prazo de inatividade reinicia a cada pedaço recebido', async () => {
    const encoder2 = new TextEncoder();
    const slow: FetchLike = async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          async start(controller) {
            for (const piece of ['data: {"choices":[{"delta":{"content":"a"}}]}\n\n', 'data: {"choices":[{"delta":{"content":"b"}}]}\n\n', 'data: [DONE]\n\n']) {
              await new Promise((r) => setTimeout(r, 20));
              controller.enqueue(encoder2.encode(piece));
            }
            controller.close();
          },
        }),
        { headers: { 'content-type': 'text/event-stream' } },
      );
    const text = await collect(new OpenAICompatibleProvider(config(), slow)).catch((e: unknown) => e);
    expect(text).toBe('ab');
  });
});

describe('OpenAICompatibleProvider extraBody', () => {
  const okSse = () => sseResponse(['data: {"choices":[{"delta":{"content":"ok"}}]}\n\n', 'data: [DONE]\n\n']);

  it('envia extraBody no corpo (ex.: desligar raciocínio) sem sobrescrever modelo, mensagens ou stream', async () => {
    const bodies: string[] = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      bodies.push(String(init?.body));
      return okSse();
    };
    const provider = new OpenAICompatibleProvider(
      config({ extraBody: { chat_template_kwargs: { enable_thinking: false }, model: 'outro', stream: false } }),
      fetchImpl,
    );
    expect(await collect(provider)).toBe('ok');
    const body = JSON.parse(bodies[0] ?? '{}') as Record<string, unknown>;
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(body).toMatchObject({ model: 'modelo-x', stream: true });
    expect(body.messages).toEqual([{ role: 'user', content: 'oi' }]);
  });

  it('sem extraBody, o corpo da requisição não ganha campos extras', async () => {
    const bodies: string[] = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      bodies.push(String(init?.body));
      return okSse();
    };
    await collect(new OpenAICompatibleProvider(config(), fetchImpl));
    const body = JSON.parse(bodies[0] ?? '{}') as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['messages', 'model', 'stream', 'temperature']);
  });
});

describe('OpenAICompatibleProvider.listModels', () => {
  it('lista ids de GET {baseUrl}/models', async () => {
    let url = '';
    const fetchImpl: FetchLike = async (u) => {
      url = u;
      return new Response(JSON.stringify({ data: [{ id: 'b-modelo' }, { id: 'a-modelo' }, {}] }), {
        headers: { 'content-type': 'application/json' },
      });
    };
    const ids = await new OpenAICompatibleProvider(config(), fetchImpl).listModels();
    expect(url).toBe('https://provider.test/v1/models');
    expect(ids).toEqual(['a-modelo', 'b-modelo']);
  });
});

describe('presets', () => {
  it('monta a configuração do preset NVIDIA com o modelo sugerido e o raciocínio desligado', () => {
    const cfg = buildProviderConfig('nvidia', { apiKey: ' k ', baseUrl: '' });
    expect(cfg).toMatchObject({
      id: 'nvidia',
      kind: 'openai-compatible',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      apiKey: 'k',
      model: 'nvidia/nemotron-3-ultra-550b-a55b',
      extraBody: { chat_template_kwargs: { enable_thinking: false } },
    });
  });

  it('só os presets que pedem extraBody o levam para a configuração', () => {
    expect(buildProviderConfig('openai', { apiKey: 'k' }).extraBody).toBeUndefined();
    expect(buildProviderConfig('nvidia', { apiKey: 'k', model: 'outro/modelo' }).model).toBe('outro/modelo');
  });

  it('usa o modelo sugerido do preset quando não há sobrescrita', () => {
    expect(buildProviderConfig('openai', { apiKey: 'k' }).model).toBe('gpt-4o-mini');
    expect(buildProviderConfig('custom', { apiKey: 'k', baseUrl: 'http://localhost:11434/v1', model: 'm' })).toMatchObject({
      baseUrl: 'http://localhost:11434/v1',
      model: 'm',
    });
  });
});

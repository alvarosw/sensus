import { describe, expect, it } from 'vitest';
import {
  buildChatGPTProviderConfig,
  createProvider,
  LLMError,
  OpenAIResponsesProvider,
  toResponsesInput,
  type FetchLike,
  type ProviderConfig,
} from '../src/index';

const encoder = new TextEncoder();

function sse(events: unknown[], status = 200): Response {
  const body = events.map((e) => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`).join('');
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(encoder.encode(body));
      c.close();
    },
  });
  return new Response(stream, { status, headers: { 'content-type': 'text/event-stream' } });
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

const CONFIG: ProviderConfig = buildChatGPTProviderConfig('gpt-test-1');

interface Recorded {
  url: string;
  init: RequestInit | undefined;
}

function fakeFetch(responses: Array<() => Response>): { fetch: FetchLike; calls: Recorded[] } {
  const calls: Recorded[] = [];
  let i = 0;
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const next = responses[Math.min(i, responses.length - 1)]!;
    i++;
    return next();
  };
  return { fetch, calls };
}

const tokenGetter = (tokens: string[] = ['tok-1']) => {
  const seen: Array<{ forceRefresh?: boolean }> = [];
  let i = 0;
  const get = async (opts?: { forceRefresh?: boolean }) => {
    seen.push({ forceRefresh: opts?.forceRefresh });
    const t = tokens[Math.min(i, tokens.length - 1)]!;
    i++;
    return t;
  };
  return { get, seen };
};

async function collect(p: OpenAIResponsesProvider, onReasoning?: () => void): Promise<string> {
  let out = '';
  for await (const piece of p.stream({ messages: [{ role: 'user', content: 'oi' }], onReasoning })) out += piece;
  return out;
}

const OK_EVENTS = [
  { type: 'response.created', response: { id: 'r1' } },
  { type: 'response.reasoning_summary_text.delta', delta: 'pensando' },
  { type: 'response.output_text.delta', delta: 'Olá' },
  { type: 'response.output_text.delta', delta: ', mundo' },
  { type: 'response.completed', response: { id: 'r1', status: 'completed' } },
];

describe('toResponsesInput', () => {
  it('system vai para instructions; user/assistant ficam em input', () => {
    const r = toResponsesInput([
      { role: 'system', content: 'Regras A' },
      { role: 'system', content: 'Regras B' },
      { role: 'user', content: 'pergunta' },
      { role: 'assistant', content: 'resposta' },
    ]);
    expect(r.instructions).toBe('Regras A\n\nRegras B');
    expect(r.input).toEqual([
      { role: 'user', content: 'pergunta' },
      { role: 'assistant', content: 'resposta' },
    ]);
  });
});

describe('OpenAIResponsesProvider.stream', () => {
  it('envia store=false, stream=true, bearer e lê deltas até response.completed', async () => {
    const { fetch, calls } = fakeFetch([() => sse(OK_EVENTS)]);
    const tokens = tokenGetter();
    const p = new OpenAIResponsesProvider(CONFIG, fetch, tokens.get);
    let reasoning = 0;
    const text = await collect(p, () => reasoning++);

    expect(text).toBe('Olá, mundo');
    expect(reasoning).toBe(1);
    expect(calls[0]!.url).toBe('https://api.openai.com/v1/responses');
    const headers = calls[0]!.init!.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok-1');
    const body = JSON.parse(calls[0]!.init!.body as string) as Record<string, unknown>;
    expect(body.store).toBe(false);
    expect(body.stream).toBe(true);
    expect(body.model).toBe('gpt-test-1');
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('max_output_tokens');
  });

  it('falha de plano no meio do stream vira erro com código estável', async () => {
    const { fetch } = fakeFetch([
      () =>
        sse([
          { type: 'response.output_text.delta', delta: 'parcial' },
          { type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded', message: 'x' } } },
        ]),
    ]);
    const p = new OpenAIResponsesProvider(CONFIG, fetch, tokenGetter().get);
    await expect(collect(p)).rejects.toMatchObject({ code: 'plan_limit' });
  });

  it('403 de conta não elegível: sem retry e sem novo OAuth', async () => {
    const { fetch, calls } = fakeFetch([
      () => json({ error: { code: 'subscription_sharing_user_not_eligible', message: 'no' } }, 403),
    ]);
    const tokens = tokenGetter();
    const p = new OpenAIResponsesProvider(CONFIG, fetch, tokens.get);
    const err = await collect(p).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect((err as LLMError).code).toBe('plan_not_eligible');
    expect((err as LLMError).status).toBe(403);
    expect(calls).toHaveLength(1);
    expect(tokens.seen).toHaveLength(1);
  });

  it('401: renova o token uma vez e repete o pedido', async () => {
    const { fetch, calls } = fakeFetch([() => json({ detail: 'expired' }, 401), () => sse(OK_EVENTS)]);
    const tokens = tokenGetter(['velho', 'novo']);
    const p = new OpenAIResponsesProvider(CONFIG, fetch, tokens.get);
    expect(await collect(p)).toBe('Olá, mundo');
    expect(tokens.seen.map((s) => s.forceRefresh)).toEqual([false, true]);
    expect((calls[1]!.init!.headers as Record<string, string>).Authorization).toBe('Bearer novo');
  });

  it('401 persistente vira reauth (sem laço infinito)', async () => {
    const { fetch, calls } = fakeFetch([() => json({ detail: 'no' }, 401)]);
    const p = new OpenAIResponsesProvider(CONFIG, fetch, tokenGetter().get);
    await expect(collect(p)).rejects.toMatchObject({ code: 'reauth' });
    expect(calls).toHaveLength(2);
  });

  it('503 de admissão com detail vira plan_unavailable', async () => {
    const { fetch } = fakeFetch([() => json({ detail: 'routing off' }, 503)]);
    const p = new OpenAIResponsesProvider(CONFIG, fetch, tokenGetter().get);
    await expect(collect(p)).rejects.toMatchObject({ code: 'plan_unavailable', status: 503 });
  });

  it('erro 400 de capacidade não suportada cita o parâmetro', async () => {
    const { fetch } = fakeFetch([
      () => json({ error: { code: 'subscription_sharing_unsupported_capability', param: 'temperature' } }, 400),
    ]);
    const p = new OpenAIResponsesProvider(CONFIG, fetch, tokenGetter().get);
    const err = (await collect(p).catch((e: unknown) => e)) as LLMError;
    expect(err.code).toBe('plan_unsupported');
    expect(err.message).toContain('temperature');
  });

  it('stream que termina sem response.completed é erro (não sucesso parcial)', async () => {
    const { fetch } = fakeFetch([() => sse([{ type: 'response.output_text.delta', delta: 'meio' }])]);
    const p = new OpenAIResponsesProvider(CONFIG, fetch, tokenGetter().get);
    await expect(collect(p)).rejects.toMatchObject({ code: 'protocol' });
  });

  it('response.incomplete é erro de protocolo', async () => {
    const { fetch } = fakeFetch([() => sse([{ type: 'response.incomplete', response: { status: 'incomplete' } }])]);
    const p = new OpenAIResponsesProvider(CONFIG, fetch, tokenGetter().get);
    await expect(collect(p)).rejects.toMatchObject({ code: 'protocol' });
  });

  it('exige um modelo escolhido', async () => {
    const p = new OpenAIResponsesProvider({ ...CONFIG, model: '' }, fakeFetch([() => sse(OK_EVENTS)]).fetch, tokenGetter().get);
    await expect(collect(p)).rejects.toMatchObject({ code: 'config' });
  });
});

describe('OpenAIResponsesProvider.listModelInfo', () => {
  it('mantém só visibility="list", na ordem do servidor, com display_name', async () => {
    const { fetch, calls } = fakeFetch([
      () =>
        json(
          {
            models: [
              { slug: 'modelo-b', display_name: 'Modelo B', visibility: 'list' },
              { slug: 'interno', display_name: 'Interno', visibility: 'hide' },
              { slug: 'modelo-a', visibility: 'list' },
            ],
          },
          200,
        ),
    ]);
    const p = new OpenAIResponsesProvider(CONFIG, fetch, tokenGetter().get);
    expect(await p.listModelInfo()).toEqual([
      { slug: 'modelo-b', displayName: 'Modelo B' },
      { slug: 'modelo-a', displayName: 'modelo-a' },
    ]);
    expect(calls[0]!.url).toBe('https://api.openai.com/v1/models');
    expect((calls[0]!.init!.headers as Record<string, string>).Authorization).toBe('Bearer tok-1');
  });
});

describe('createProvider com kind chatgpt', () => {
  it('sem getAccessToken, falha com erro de configuração', () => {
    let caught: unknown = null;
    try {
      createProvider(CONFIG, fakeFetch([]).fetch);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LLMError);
    expect((caught as LLMError).code).toBe('config');
  });

  it('com getAccessToken, devolve o provedor do plano', () => {
    const p = createProvider(CONFIG, fakeFetch([]).fetch, { getAccessToken: tokenGetter().get });
    expect(p).toBeInstanceOf(OpenAIResponsesProvider);
  });
});

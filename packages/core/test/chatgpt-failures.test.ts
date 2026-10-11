// Erros do plano ChatGPT: códigos estáveis, horário de volta (resetAt) e a classificação usada pela escolha
// de provedor (chatGPTFailureOf). Fetch falso; nenhuma rede.
import { describe, expect, it } from 'vitest';
import {
  buildChatGPTProviderConfig,
  chatGPTFailureOf,
  LLMError,
  OpenAIResponsesProvider,
  parseResetValue,
  resetAtOf,
  type FetchLike,
} from '../src/index';

const encoder = new TextEncoder();
const CONFIG = buildChatGPTProviderConfig('gpt-test-1');

function sse(events: unknown[]): Response {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(encoder.encode(body));
      c.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function errorResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

const LIMIT_BODY = { error: { code: 'subscription_sharing_usage_limit_exceeded', message: 'limite' } };

function provider(fetchImpl: FetchLike, stallMs?: number) {
  const p = new OpenAIResponsesProvider(CONFIG, fetchImpl, async () => 'tok-1');
  return {
    p,
    async run(): Promise<{ text: string; error?: LLMError }> {
      let text = '';
      try {
        for await (const d of p.stream({ messages: [{ role: 'user', content: 'oi' }], stallMs })) text += d;
        return { text };
      } catch (e) {
        return { text, error: e as LLMError };
      }
    },
  };
}

const once = (r: Response): FetchLike => async () => r;

describe('parseResetValue', () => {
  const now = 1_800_000_000_000;

  it('segundos a partir de agora (Retry-After numérico)', () => {
    expect(parseResetValue('120', now)).toBe(now + 120_000);
    expect(parseResetValue(30, now)).toBe(now + 30_000);
  });

  it('duração no formato da OpenAI ("6m0s", "1h2m3.5s", "250ms")', () => {
    expect(parseResetValue('6m0s', now)).toBe(now + 360_000);
    expect(parseResetValue('1h2m3.5s', now)).toBe(now + 3_723_500);
    expect(parseResetValue('250ms', now)).toBe(now + 250);
  });

  it('epoch em segundos e em milissegundos', () => {
    const future = Math.floor(now / 1000) + 600;
    expect(parseResetValue(future, now)).toBe(future * 1000);
    expect(parseResetValue(future * 1000, now)).toBe(future * 1000);
  });

  it('data ISO e HTTP-date', () => {
    const iso = new Date(now + 90_000).toISOString();
    expect(parseResetValue(iso, now)).toBe(Date.parse(iso));
    expect(parseResetValue(new Date(now + 90_000).toUTCString(), now)).toBe(Math.floor((now + 90_000) / 1000) * 1000);
  });

  it('descarta valores passados, longos demais ou inválidos', () => {
    expect(parseResetValue(new Date(now - 3_600_000).toISOString(), now)).toBeUndefined();
    expect(parseResetValue(String(60 * 24 * 60 * 60), now)).toBeUndefined();
    expect(parseResetValue('amanhã', now)).toBeUndefined();
    expect(parseResetValue(null, now)).toBeUndefined();
  });
});

describe('resetAtOf', () => {
  const now = 1_800_000_000_000;

  it('lê Retry-After e x-ratelimit-reset* dos cabeçalhos', () => {
    expect(resetAtOf({ headers: new Headers({ 'retry-after': '90' }) }, now)).toBe(now + 90_000);
    expect(resetAtOf({ headers: new Headers({ 'x-ratelimit-reset-requests': '20s' }) }, now)).toBe(now + 20_000);
  });

  it('prefere o campo do corpo (resets_at) aos cabeçalhos', () => {
    const body = { error: { resets_at: now + 5_000 } };
    expect(resetAtOf({ headers: new Headers({ 'retry-after': '90' }), body }, now)).toBe(now + 5_000);
  });

  it('sem horário nenhum: undefined', () => {
    expect(resetAtOf({ headers: new Headers(), body: LIMIT_BODY }, now)).toBeUndefined();
  });
});

describe('falhas do plano no provedor (fetch falso)', () => {
  it('429 de limite com Retry-After: plan_limit com resetAt', async () => {
    const before = Date.now();
    const r = await provider(once(errorResponse(429, LIMIT_BODY, { 'retry-after': '600' }))).run();
    expect(r.error?.code).toBe('plan_limit');
    expect(r.error?.status).toBe(429);
    expect(r.error?.resetAt).toBeGreaterThanOrEqual(before + 600_000 - 50);
    expect(r.error?.resetAt).toBeLessThanOrEqual(Date.now() + 600_000 + 50);
    expect(chatGPTFailureOf(r.error)).toBe('plan_limit');
  });

  it('limite sem horário informado: plan_limit sem resetAt', async () => {
    const r = await provider(once(errorResponse(429, LIMIT_BODY))).run();
    expect(r.error?.code).toBe('plan_limit');
    expect(r.error?.resetAt).toBeUndefined();
  });

  it('limite de uso no corpo com resets_at em epoch (segundos)', async () => {
    const at = Math.floor(Date.now() / 1000) + 1200;
    const r = await provider(once(errorResponse(429, { error: { ...LIMIT_BODY.error, resets_at: at } }))).run();
    expect(r.error?.code).toBe('plan_limit');
    expect(r.error?.resetAt).toBe(at * 1000);
  });

  it('429 sem código de plano: rate_limit (com horário do cabeçalho)', async () => {
    const r = await provider(once(errorResponse(429, { detail: 'slow down' }, { 'x-ratelimit-reset-requests': '45s' }))).run();
    expect(r.error?.code).toBe('rate_limit');
    expect(chatGPTFailureOf(r.error)).toBe('rate_limit');
    expect(r.error?.resetAt).toBeGreaterThan(Date.now());
  });

  it('limite no meio do stream (response.failed): plan_limit', async () => {
    const r = await provider(
      once(
        sse([
          { type: 'response.output_text.delta', delta: 'Parte' },
          { type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded', resets_at: Math.floor(Date.now() / 1000) + 300 } } },
        ]),
      ),
    ).run();
    expect(r.text).toBe('Parte');
    expect(r.error?.code).toBe('plan_limit');
    expect(r.error?.resetAt).toBeGreaterThan(Date.now());
  });

  it('403 de conta sem o plano: not_eligible (sem retry)', async () => {
    let calls = 0;
    const r = await provider(async () => {
      calls++;
      return errorResponse(403, { error: { code: 'subscription_sharing_user_not_eligible' } });
    }).run();
    expect(r.error?.code).toBe('plan_not_eligible');
    expect(chatGPTFailureOf(r.error)).toBe('not_eligible');
    expect(calls).toBe(1);
  });

  it('permissão do plano recusada (chatpass_v2): reauth, não transitório', async () => {
    const r = await provider(once(errorResponse(403, { error: { code: 'chatpass_v2_scope_not_authorized' } }))).run();
    expect(r.error?.code).toBe('reauth');
    expect(chatGPTFailureOf(r.error)).toBe('reauth');
  });

  it('401 persistente (depois da renovação): reauth', async () => {
    const r = await provider(once(errorResponse(401, { error: { code: 'subscription_sharing_invalid_user' } }))).run();
    expect(r.error?.code).toBe('reauth');
    expect(chatGPTFailureOf(r.error)).toBe('reauth');
  });

  it('503 de uso indisponível: transitório', async () => {
    const r = await provider(once(errorResponse(503, { error: { code: 'subscription_sharing_usage_unavailable' } }))).run();
    expect(r.error?.code).toBe('plan_unavailable');
    expect(chatGPTFailureOf(r.error)).toBe('transient');
  });

  it('5xx sem código: transitório', async () => {
    const r = await provider(once(errorResponse(500, { detail: 'oops' }))).run();
    expect(r.error?.code).toBe('server');
    expect(chatGPTFailureOf(r.error)).toBe('transient');
  });

  it('400 de capacidade não suportada: transitório para a escolha (não repete o mesmo pedido)', async () => {
    const r = await provider(once(errorResponse(400, { error: { code: 'subscription_sharing_unsupported_capability', param: 'temperature' } }))).run();
    expect(r.error?.code).toBe('plan_unsupported');
    expect(chatGPTFailureOf(r.error)).toBe('transient');
  });

  it('falha de rede no fetch: network, transitória', async () => {
    const r = await provider(async () => {
      throw new TypeError('network down');
    }).run();
    expect(r.error?.code).toBe('network');
    expect(chatGPTFailureOf(r.error)).toBe('transient');
  });

  it('parada sem bytes (vigia de inatividade): timeout, transitório', async () => {
    const r = await provider(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        }),
      20,
    ).run();
    expect(r.error?.code).toBe('timeout');
    expect(chatGPTFailureOf(r.error)).toBe('transient');
  });

  it('stream sem response.completed: protocol, transitório', async () => {
    const r = await provider(once(sse([{ type: 'response.output_text.delta', delta: 'x' }]))).run();
    expect(r.error?.code).toBe('protocol');
    expect(chatGPTFailureOf(r.error)).toBe('transient');
  });

  it('chatGPTFailureOf: erros que não são LLMError são transitórios', () => {
    expect(chatGPTFailureOf(new Error('x'))).toBe('transient');
    expect(chatGPTFailureOf(null)).toBe('transient');
  });
});

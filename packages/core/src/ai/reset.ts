// Horário em que um limite de uso volta, lido dos cabeçalhos e do corpo do erro. Sem documentação pública
// de um campo fixo para o plano ChatGPT (developers.openai.com/siwc: nenhum cabeçalho nem `resets_at`):
// lemos os nomes comuns e só aceitamos valores plausíveis. Quem chama cai no retorno padrão se vier undefined.

/** Maior reset aceito à frente: um limite não passa de 7 dias (valores além disso são descartados). */
const MAX_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;

/** Cabeçalhos que trazem o tempo de espera (Retry-After e x-ratelimit-reset*). */
const RESET_HEADER = /^(retry-after|x-ratelimit-reset[\w-]*)$/i;

/** Campos do corpo do erro que podem trazer o horário (topo e dentro de `error`). */
const RESET_BODY_KEYS = ['resets_at', 'reset_at', 'retry_after', 'retry_after_seconds'] as const;

type Plausible = (value: number, nowMs: number) => number | undefined;

const plausible: Plausible = (value, nowMs) => {
  if (!Number.isFinite(value)) return undefined;
  if (value <= nowMs - 60_000) return undefined; // passado: não serve como horário de volta
  if (value > nowMs + MAX_AHEAD_MS) return undefined;
  return value;
};

/** Duração no formato "6m0s", "1h2m3.5s", "250ms" (usado pelo x-ratelimit-reset-*). Devolve ms, ou NaN. */
function durationMs(text: string): number {
  const parts = [...text.matchAll(/(\d+(?:\.\d+)?)(ms|h|m|s)/g)];
  if (parts.length === 0 || parts.map((p) => p[0]).join('') !== text) return NaN;
  const unit: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 };
  return parts.reduce((sum, p) => sum + Number(p[1]) * unit[p[2]!]!, 0);
}

/**
 * Converte um valor de horário: epoch em ms (>= 1e12), epoch em s (>= 1e9), segundos a partir de agora
 * (número pequeno, como Retry-After), duração ("6m0s") ou data (ISO / HTTP-date). Devolve epoch em ms.
 */
export function parseResetValue(value: unknown, nowMs: number): number | undefined {
  if (typeof value === 'number') {
    if (value >= 1e12) return plausible(value, nowMs);
    if (value >= 1e9) return plausible(value * 1000, nowMs);
    return plausible(nowMs + value * 1000, nowMs);
  }
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text) return undefined;
  if (/^\d+(\.\d+)?$/.test(text)) return parseResetValue(Number(text), nowMs);
  const duration = durationMs(text);
  if (Number.isFinite(duration)) return plausible(nowMs + duration, nowMs);
  const date = Date.parse(text);
  return Number.isNaN(date) ? undefined : plausible(date, nowMs);
}

/** Primeiro horário plausível entre os cabeçalhos de resposta (Retry-After, x-ratelimit-reset*). */
export function resetFromHeaders(headers: Headers | undefined, nowMs: number): number | undefined {
  if (!headers) return undefined;
  let found: number | undefined;
  headers.forEach((value, name) => {
    if (found !== undefined || !RESET_HEADER.test(name)) return;
    found = parseResetValue(value, nowMs);
  });
  return found;
}

/** Horário no corpo do erro (`resets_at` etc., no topo ou dentro de `error`). */
export function resetFromBody(body: unknown, nowMs: number): number | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const top = body as Record<string, unknown>;
  const inner = top.error && typeof top.error === 'object' ? (top.error as Record<string, unknown>) : {};
  for (const source of [inner, top]) {
    for (const key of RESET_BODY_KEYS) {
      const found = parseResetValue(source[key], nowMs);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** Horário de volta de um erro: primeiro o corpo (campos explícitos), depois os cabeçalhos. */
export function resetAtOf(input: { headers?: Headers; body?: unknown }, nowMs: number): number | undefined {
  return resetFromBody(input.body, nowMs) ?? resetFromHeaders(input.headers, nowMs);
}

// Leitura de Server-Sent Events com vigia de inatividade. Compartilhada pelos adaptadores de IA.
import { LLMError } from './llm-error';

/** Sem bytes por este tempo, a requisição é abortada e o erro 'timeout' é mostrado (com "tente novamente"). */
export const STALL_TIMEOUT_MS = 45_000;

/**
 * Vigia a conexão: `failed` rejeita (com LLMError 'timeout') se nenhum byte chegar por `ms`.
 * `touch()` reinicia o prazo a cada atividade; `stop()` desarma ao fim da resposta.
 */
export class StallWatch {
  readonly failed: Promise<never>;
  private readonly ms: number;
  private readonly label: string;
  private readonly abort: () => void;
  private fail: (err: LLMError) => void = () => undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(ms: number, label: string, abort: () => void) {
    this.ms = ms;
    this.label = label;
    this.abort = abort;
    this.failed = new Promise<never>((_, reject) => {
      this.fail = reject;
    });
    this.failed.catch(() => undefined);
    this.touch();
  }

  touch(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.abort();
      this.fail(
        new LLMError(
          `${this.label} parou de responder (sem dados por ${Math.round(this.ms / 1000)} s). Tentar novamente.`,
          'timeout',
        ),
      );
    }, this.ms);
  }

  stop(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
}

/**
 * Lê um corpo SSE e devolve o conteúdo de cada linha `data:` (sem o prefixo).
 * `collect` recebe todas as linhas, para o fallback de resposta JSON não-streamed.
 * Cada leitura é corrida contra o `watch` (ver StallWatch).
 */
export async function* readSSEData(
  body: ReadableStream<Uint8Array>,
  collect: string[],
  watch: StallWatch,
): AsyncGenerator<string> {
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
      const { done, value } = await Promise.race([reader.read(), watch.failed]);
      watch.touch();
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
      // Sem await: após um timeout a leitura pendente pode não resolver nunca.
      reader.cancel().catch(() => undefined);
    }
  }
}

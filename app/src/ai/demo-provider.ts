// Provedor de IA de demonstração: reproduz respostas REAIS do modelo gravadas em dev/fixtures/
// (scripts/record-fixtures.ts), sem rede, com o ritmo de um stream de verdade (~40 caracteres a
// cada 30 ms). Serve para capturas de tela e testes determinísticos, e para a web (o CORS do
// navegador bloqueia a NVIDIA). Selecionado pelo preset 'demo' (ver settings/presets.ts).
//
// A fixture é escolhida pelo pedido: tipo (resumo / aprofundamento de seção / pergunta), intervalo
// (a linha "# Passagem: <referência>" do contexto), seção ou texto da pergunta. Sem correspondência
// exata, usa a fixture mais próxima do mesmo tipo.
import {
  CHAT_CONTEXT_PREFIX,
  CURIOSITY_REQUEST_MARK,
  CURIOSITY_REVIEW_MARK,
  SECTION_KEYS,
  type ChatMessage,
  type ChatRequest,
  type LLMProvider,
  type ProviderConfig,
  type SectionKey,
} from '@sensus/core';
import type { Fixture } from '../../dev/fixtures/types';

export const DEMO_PRESET_ID = 'demo';
export const DEMO_LABEL = 'Demonstração (offline)';

/** Configuração do provedor demo no formato do app (sem segredos; os campos são só marcadores). */
export const DEMO_PROVIDER_CONFIG: ProviderConfig = {
  id: DEMO_PRESET_ID,
  kind: 'openai-compatible',
  label: DEMO_LABEL,
  baseUrl: 'demo://offline',
  apiKey: 'demo',
  model: 'demo-fixtures',
};

export interface DemoTiming {
  /** Caracteres por pedaço. */
  chunkChars: number;
  /** Pausa entre pedaços (ms). */
  chunkDelayMs: number;
  /** Latência até o primeiro pedaço (ms). */
  startDelayMs: number;
}

export const DEFAULT_DEMO_TIMING: DemoTiming = { chunkChars: 40, chunkDelayMs: 30, startDelayMs: 250 };

// ---- classificação do pedido ------------------------------------------------------------------

export type DemoRequest =
  | { kind: 'summary'; reference: string | null }
  | { kind: 'section'; reference: string | null; section: SectionKey | null }
  | { kind: 'answer'; reference: string | null; question: string }
  | { kind: 'curiosity'; reference: string | null }
  | { kind: 'curiosity-review'; reference: string | null };

/** Resposta do gerador sem fixture da unidade: "nenhuma curiosidade" (nunca a de outro trecho). */
export const DEMO_NO_CURIOSITY = '@nenhuma\n@fim';
/** Resposta do revisor sem fixture da unidade: reprova (a curiosidade não aparece). */
export const DEMO_REJECT_REVIEW = [
  'interesse: 2',
  'fundamento: 3',
  'disputa: nao',
  'alcance: sim',
  'tipo: sim',
  'peso: nao',
  'motivo: demonstração sem revisão gravada para esta unidade',
  '@fim',
].join('\n');

const ANSWER_SUFFIX = '\n\nResponda com markdown';

function referenceOf(messages: readonly ChatMessage[]): string | null {
  for (const m of messages) {
    const hit = /^# Passagem: (.+)$/m.exec(m.content);
    if (hit) return hit[1]!.trim();
  }
  return null;
}

/** Descobre o tipo de pedido a partir das mensagens montadas por summaryMessages/sectionMessages/answerMessages. */
export function classifyRequest(messages: readonly ChatMessage[]): DemoRequest {
  const reference = referenceOf(messages);
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

  if (messages.some((m) => m.role === 'system' && m.content.startsWith(CHAT_CONTEXT_PREFIX))) {
    const cut = lastUser.indexOf(ANSWER_SUFFIX);
    return { kind: 'answer', reference, question: (cut >= 0 ? lastUser.slice(0, cut) : lastUser).trim() };
  }
  // Curiosidade: o gerador e o revisor são reconhecidos pelo início das instruções do núcleo (curiosity.ts).
  if (lastUser.includes(CURIOSITY_REVIEW_MARK)) return { kind: 'curiosity-review', reference };
  if (lastUser.includes(CURIOSITY_REQUEST_MARK)) return { kind: 'curiosity', reference };
  // "Aprofunde a lente "<rótulo>" (chave: <seção>) ..." (o rótulo pode mudar; a chave é a que casa com a seção).
  if (/^Aprofunde\b/.test(lastUser)) {
    const key = /\(chave: (\w+)\)/.exec(lastUser)?.[1];
    const section = SECTION_KEYS.find((k) => k === key) ?? null;
    return { kind: 'section', reference, section };
  }
  return { kind: 'summary', reference };
}

// ---- escolha da fixture -----------------------------------------------------------------------

interface LooseRef {
  book: string;
  /** capítulo*1000 + versículo, sem o livro. */
  start: number;
  end: number;
}

/** "Filipenses 2:5-8", "Filipenses 1:27-2:4", "Filipenses 2", "Filipenses 2-3". */
export function parseLooseRef(ref: string): LooseRef | null {
  const m = /^(.*?)\s+(\d+)(?::(\d+))?(?:\s*[-–]\s*(?:(\d+):)?(\d+))?\s*$/.exec(ref.trim());
  if (!m) return null;
  const ch = Number(m[2]);
  const hasVerse = m[3] !== undefined;
  const start = ch * 1000 + (hasVerse ? Number(m[3]) : 1);
  let end: number;
  if (m[5] === undefined) end = hasVerse ? start : ch * 1000 + 999;
  else if (m[4] !== undefined) end = Number(m[4]) * 1000 + Number(m[5]);
  else if (hasVerse) end = ch * 1000 + Number(m[5]);
  else end = Number(m[5]) * 1000 + 999; // "Filipenses 2-3": capítulos
  return { book: m[1]!.trim().toLowerCase(), start, end };
}

function fixtureLooseRef(f: Fixture): LooseRef {
  const parsed = parseLooseRef(f.reference);
  return (
    parsed ?? {
      book: '',
      start: f.range.start % 1_000_000,
      end: f.range.end % 1_000_000,
    }
  );
}

/** [mesmo livro, interseção, -distância]: maior é melhor. */
function rangeScore(want: LooseRef | null, f: Fixture): [number, number, number] {
  if (!want) return [0, 0, 0];
  const have = fixtureLooseRef(f);
  const overlap = Math.max(0, Math.min(want.end, have.end) - Math.max(want.start, have.start) + 1);
  return [have.book === want.book ? 1 : 0, overlap, -Math.abs(want.start - have.start)];
}

function words(s: string): Set<string> {
  return new Set(
    s
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2),
  );
}

/** Similaridade de Jaccard entre as palavras de duas perguntas. */
export function questionSimilarity(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (wa.size + wb.size - inter);
}

function compareScores(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i]! !== b[i]!) return b[i]! - a[i]!;
  }
  return 0;
}

/** Fixture que melhor atende ao pedido, ou null se não houver nenhuma do mesmo tipo. */
/**
 * Curiosidade e revisão: só a gravada para a MESMA unidade (mesmo livro e mesmo intervalo). Outro trecho não serve:
 * sem ela, o demo responde "nenhuma curiosidade".
 */
export function pickCuriosityFixture(req: { kind: 'curiosity' | 'curiosity-review'; reference: string | null }, fixtures: readonly Fixture[]): Fixture | null {
  const want = req.reference ? parseLooseRef(req.reference) : null;
  if (!want) return null;
  return (
    fixtures.find((f) => {
      if (f.kind !== req.kind) return false;
      const have = fixtureLooseRef(f);
      return have.book === want.book && have.start === want.start && have.end === want.end;
    }) ?? null
  );
}

export function pickFixture(req: DemoRequest, fixtures: readonly Fixture[]): Fixture | null {
  if (req.kind === 'curiosity' || req.kind === 'curiosity-review') return pickCuriosityFixture(req, fixtures);
  let pool = fixtures.filter((f) => f.kind === req.kind);
  if (pool.length === 0) return null;
  if (req.kind === 'section' && req.section) {
    const same = pool.filter((f) => f.section === req.section);
    if (same.length > 0) pool = same;
  }
  const want = req.reference ? parseLooseRef(req.reference) : null;
  const scored = pool.map((f, i) => ({
    f,
    i,
    score: [
      ...rangeScore(want, f),
      req.kind === 'answer' ? questionSimilarity(req.question, f.question ?? '') : 0,
    ],
  }));
  scored.sort((x, y) => compareScores(x.score, y.score) || x.i - y.i);
  return scored[0]!.f;
}

// ---- provedor ---------------------------------------------------------------------------------

function abortError(): Error {
  const e = new Error('Aborted');
  e.name = 'AbortError';
  return e;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Fixtures carregadas sob demanda (e só em desenvolvimento ou com EXPO_PUBLIC_SENSUS_DEMO=1). */
function loadFixtures(): readonly Fixture[] {
  if (process.env.NODE_ENV !== 'production' || process.env.EXPO_PUBLIC_SENSUS_DEMO === '1') {
    return (require('../../dev/fixtures') as { FIXTURES: readonly Fixture[] }).FIXTURES;
  }
  return [];
}

export class DemoProvider implements LLMProvider {
  constructor(
    private readonly timing: DemoTiming = DEFAULT_DEMO_TIMING,
    private readonly fixtures: readonly Fixture[] = loadFixtures(),
  ) {}

  async *stream(req: ChatRequest): AsyncGenerator<string> {
    const request = classifyRequest(req.messages);
    const fixture = pickFixture(request, this.fixtures);
    let text: string;
    if (fixture) text = fixture.text;
    else if (request.kind === 'curiosity') text = DEMO_NO_CURIOSITY;
    else if (request.kind === 'curiosity-review') text = DEMO_REJECT_REVIEW;
    else throw new Error('Provedor de demonstração sem fixtures. Rode: cd app && npx tsx scripts/record-fixtures.ts');
    const { chunkChars, chunkDelayMs, startDelayMs } = this.timing;
    await sleep(startDelayMs, req.signal);
    for (let i = 0; i < text.length; ) {
      let end = Math.min(i + chunkChars, text.length);
      // Não corta um par substituto (emoji, símbolos fora do BMP) ao meio.
      const last = text.charCodeAt(end - 1);
      if (end < text.length && last >= 0xd800 && last <= 0xdbff) end++;
      yield text.slice(i, end);
      i = end;
      if (i < text.length) await sleep(chunkDelayMs, req.signal);
    }
  }

  async listModels(): Promise<string[]> {
    return ['demo-fixtures'];
  }

  async listModelListings(): Promise<{ id: string; usable: boolean }[]> {
    return [{ id: 'demo-fixtures', usable: true }];
  }

  async checkModel(): Promise<void> {
    // Offline: nada a verificar.
  }
}

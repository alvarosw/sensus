// Benchmark dos modelos NVIDIA nas tarefas reais do app: resumo estruturado, uma pergunta de chat e um
// aprofundamento de lente. Mede velocidade (primeiro conteúdo e total) e precisão (formato, citações válidas
// e inválidas, frases sem citação, conflitos morfológicos, língua). Usa data/sensus.db e o mesmo contexto
// do app (unidade literária do trecho, com a seleção como foco). Metodologia: docs/MODEL_BENCHMARK.md.
//
//   npx tsx packages/core/tools/bench-models.ts probe              testa cada modelo de chat de GET /models
//   npx tsx packages/core/tools/bench-models.ts run [opções]       roda as tarefas (retoma o que já existe)
//   npx tsx packages/core/tools/bench-models.ts report             tabela de velocidade e precisão
//
// Opções de run:
//   --models a,b                 ids (padrão: os que responderam ao probe)
//   --tasks summary,answer,deepen
//   --passages fp-2-5-8,fp-4-13,jo-1-1-3
//   --default-mode <regex>       modelos que também rodam sem desligar o raciocínio (padrão: nemotron)
//   --out <dir>                  saídas (padrão: tmp/bench-models, ignorado pelo git)
//
// Chave e URL vêm do .env da raiz (NVIDIA_API_KEY, NVIDIA_BASE_URL). Nunca são impressas.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  answerMessages,
  blocksToPlainText,
  buildPanel,
  buildProviderConfig,
  buildRichTextContext,
  CHAT_MAX_TOKENS,
  claimsOf,
  classifyModels,
  deepenMessages,
  DEFAULT_PANEL_LIMITS,
  LLMError,
  OpenAICompatibleProvider,
  parseCited,
  parseStructuredAnswer,
  parseStructuredSummary,
  PROVIDER_PRESETS,
  Repo,
  SECTION_KEYS,
  serializePanel,
  splitMarkers,
  SUMMARY_MARKERS,
  SUMMARY_MAX_TOKENS,
  summaryMessages,
  type Block,
  type ChatMessage,
  type CitedSegment,
  type RichTextContext,
  type SectionKey,
  type SerializedContext,
  type SqlDriver,
  type SqlParam,
  type StructuredAnswer,
  type StructuredSummary,
  type VerseRange,
} from '../src/index';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
process.loadEnvFile(resolve(ROOT, '.env'));

const DB_PATH = process.env.SENSUS_DB ? resolve(process.env.SENSUS_DB) : resolve(ROOT, 'data', 'sensus.db');
const LANGUAGE = 'pt-BR';
/** Tempo sem dados até desistir. Modelos com raciocínio podem levar minutos para o primeiro texto. */
const STALL_MS = 240_000;
/** Limite da NVIDIA: 40 req/min. Espaçamento de 1,6 s entre inícios (no máximo ~37/min). */
const MIN_GAP_MS = 1_600;
const CONCURRENCY = 2;
const TASKS = ['summary', 'answer', 'deepen'] as const;
type Task = (typeof TASKS)[number];
type Extra = 'off' | 'default';

interface Passage {
  id: string;
  label: string;
  range: VerseRange;
  /** Pergunta sugerida (tarefa "answer"). Fixa, para que todos os modelos respondam à mesma pergunta. */
  question: string;
  /** Lente do aprofundamento (tarefa "deepen"). */
  lens: SectionKey;
}

const PASSAGES: Passage[] = [
  {
    id: 'fp-2-5-8',
    label: 'Fp 2:5–8',
    range: { start: 50002005, end: 50002008 },
    question: 'Por que Paulo diz que Cristo "esvaziou a si mesmo" (2:7) e como isso se liga à exortação de 2:5?',
    lens: 'lingua',
  },
  {
    id: 'fp-4-13',
    label: 'Fp 4:13',
    range: { start: 50004013, end: 50004013 },
    question: 'Qual é o sentido de "tudo posso naquele que me fortalece" (4:13) à luz do contexto de 4:10–13?',
    lens: 'literario',
  },
  {
    id: 'jo-1-1-3',
    label: 'Jo 1:1–3',
    range: { start: 43001001, end: 43001003 },
    question: 'Por que João apresenta o Verbo como Deus e como agente da criação em 1:1–3?',
    lens: 'interpretacao',
  },
];

// ---- contexto ----------------------------------------------------------------------------------

interface Prepared {
  passage: Passage;
  ctx: SerializedContext;
  rich: RichTextContext;
  focus?: VerseRange;
}

async function prepareAll(): Promise<Prepared[]> {
  if (!existsSync(DB_PATH)) throw new Error(`Banco não encontrado: ${DB_PATH}`);
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  const driver: SqlDriver = {
    async all<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
      return db.prepare(sql).all(...params) as unknown as T[];
    },
  };
  const repo = new Repo(driver);
  const books = await repo.books();
  const out: Prepared[] = [];
  for (const passage of PASSAGES) {
    const selPanel = await buildPanel(repo, passage.range, { limits: DEFAULT_PANEL_LIMITS });
    const unit = selPanel.layers.literary.unit ?? passage.range;
    const unitPanel = await buildPanel(repo, unit, { limits: DEFAULT_PANEL_LIMITS });
    const ctx = serializePanel(unitPanel);
    const rich = buildRichTextContext(ctx, unitPanel, books);
    const focus = unit.start === passage.range.start && unit.end === passage.range.end ? undefined : passage.range;
    out.push({ passage, ctx, rich, focus });
  }
  db.close();
  return out;
}

function messagesFor(task: Task, p: Prepared): { messages: ChatMessage[]; maxTokens: number } {
  if (task === 'summary') {
    return { messages: summaryMessages(p.ctx, { language: LANGUAGE, focus: p.focus }), maxTokens: SUMMARY_MAX_TOKENS };
  }
  if (task === 'answer') {
    return { messages: answerMessages(p.ctx, [], p.passage.question, { language: LANGUAGE }), maxTokens: CHAT_MAX_TOKENS };
  }
  return { messages: deepenMessages(p.ctx, p.passage.lens, { language: LANGUAGE }), maxTokens: SUMMARY_MAX_TOKENS };
}

// ---- análise -----------------------------------------------------------------------------------

const ENGLISH_RE = /\b(the|and|with|which|because|therefore|however|this|that|are|is|of the)\b/gi;
const CJK_RE = /[぀-ヿ㐀-鿿가-힯]/g;
const CITE_MARKER_RE = /\[\[[^\]]*\]\]/g;
const SUMMARY_LENS_KEYS = ['visao', ...SECTION_KEYS] as const;

interface Analysis {
  complete: boolean;
  blocks: number;
  citeValid: number;
  citeInvalid: number;
  uncited: number;
  factual: number;
  inferenceMisuse: number;
  morph: number;
  english: number;
  cjk: number;
  tables: number;
  fences: number;
  stray: number;
  /** Summary only. */
  markers?: number;
  lensOk?: number;
  perguntas?: number;
  aplicacaoInf?: number;
  aplicacaoN?: number;
  /** Answer and deepen only. */
  followUps?: number;
  format: number;
}

/** Linhas de conteúdo (sem marcadores, perguntas "?" nem perguntas de seguimento), para a atribuição de citações. */
function contentLines(text: string, known: readonly string[]): string[] {
  const split = splitMarkers(text, known);
  const lines = [...split.preamble];
  for (const part of split.parts.values()) lines.push(...part);
  return lines
    .filter((l) => !/^\s*\?(\s|$)/.test(l) && !/^\s*@/.test(l))
    .map((l) => l.replace(/^\s*(?:#{1,6}\s*|[-*•]\s+|\d+[.)]\s+)/, '').trim())
    .filter(Boolean);
}

function strayMarkers(text: string, known: readonly string[]): number {
  const names = new Set(known);
  let n = 0;
  for (const m of text.matchAll(/^\s*(?:#{1,6}\s*)?(?:\*\*|__)?\s*@\s*(\p{L}+)/gmu)) {
    if (!names.has(m[1]!.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase())) n++;
  }
  return n;
}

function citeCounts(segments: readonly CitedSegment[]) {
  let valid = 0;
  let invalid = 0;
  let uncited = 0;
  let factual = 0;
  let misuse = 0;
  for (const s of segments) {
    valid += s.cites.length;
    invalid += s.invalidCites.length;
    if (s.kind === 'uncited') uncited++;
    if (s.kind === 'uncited' || s.kind === 'source') factual++;
    if (s.kind === 'inference' && s.cites.length > 0) misuse++;
  }
  return { valid, invalid, uncited, factual, misuse };
}

function blocksOf(s: StructuredSummary): Block[] {
  return [...s.overview, ...SECTION_KEYS.flatMap((k) => s.sections[k] ?? [])];
}

function walkCites(blocks: readonly Block[]): { valid: number; invalid: number } {
  let valid = 0;
  let invalid = 0;
  const visit = (inlines: readonly { type: string; refs?: { valid: boolean }[] }[]) => {
    for (const inl of inlines) {
      if (inl.type !== 'cite' || !inl.refs) continue;
      for (const r of inl.refs) (r.valid ? valid++ : invalid++);
    }
  };
  for (const b of blocks) {
    if (b.type === 'list') for (const item of b.items) visit(item.inlines);
    else if (b.type !== 'heading') visit(b.inlines);
  }
  return { valid, invalid };
}

function scoreOf(a: Analysis): number {
  const precision = a.citeValid + a.citeInvalid === 0 ? 0 : a.citeValid / (a.citeValid + a.citeInvalid);
  const uncitedRate = a.factual === 0 ? 0 : a.uncited / a.factual;
  const citation = 0.5 * precision + 0.5 * (1 - uncitedRate);
  const morph = a.morph === 0 ? 1 : Math.max(0, 1 - 0.25 * a.morph);
  const lang = Math.max(0, 1 - 0.2 * (a.english + a.cjk + a.tables + a.fences + a.stray));
  let s = 100 * (0.4 * a.format + 0.35 * citation + 0.15 * morph + 0.1 * lang);
  if (!a.complete) s *= 0.5;
  return Math.round(s * 10) / 10;
}

function analyzeSummary(text: string, rich: RichTextContext): Analysis {
  const s = parseStructuredSummary(text, rich);
  const split = splitMarkers(text, SUMMARY_MARKERS);
  const cites = citeCounts(lineSegments(text, SUMMARY_MARKERS, rich));
  const blocks = blocksOf(s);
  const claims = claimsOf(blocks);
  const walk = walkCites(blocks);
  const markers = ['visao', ...SECTION_KEYS, 'perguntas'].filter((k) => split.parts.has(k)).length;
  const lensOk = SUMMARY_LENS_KEYS.filter((k) => {
    const n = s.sectionQuestions?.[k]?.length ?? 0;
    return n >= 1 && n <= 2;
  }).length;
  const perguntasOk = s.questions.length >= 3 && s.questions.length <= 5 ? 1 : 0;
  const aplic = (split.parts.get('aplicacao') ?? []).filter((l) => l.trim() && !/^\s*\?/.test(l) && !/^\s*@/.test(l));
  const aplicInf = aplic.filter((l) => /^\W*\(Inferência\)/.test(l.trim())).length;
  const plain = blocksToPlainText(blocks);
  const stripped = plain.replace(CITE_MARKER_RE, '');
  const a: Analysis = {
    complete: s.complete,
    blocks: blocks.length,
    citeValid: walk.valid,
    citeInvalid: walk.invalid,
    uncited: claims.reduce((n, c) => n + c.uncited.length, 0),
    factual: cites.factual,
    inferenceMisuse: cites.misuse,
    morph: claims.reduce((n, c) => n + c.morphConflicts.length, 0),
    english: count(stripped, ENGLISH_RE),
    cjk: count(stripped, CJK_RE),
    tables: text.split('\n').filter((l) => /^\s*\|/.test(l)).length,
    fences: (text.match(/```/g) ?? []).length,
    stray: strayMarkers(text, SUMMARY_MARKERS),
    markers,
    lensOk,
    perguntas: perguntasOk,
    aplicacaoInf: aplicInf,
    aplicacaoN: aplic.length,
    format: 0,
  };
  const markersFrac = markers / (SECTION_KEYS.length + 2);
  const lensFrac = lensOk / SUMMARY_LENS_KEYS.length;
  const aplicFrac = aplic.length === 0 ? 0 : aplicInf / aplic.length;
  a.format = 0.4 * markersFrac + 0.2 * lensFrac + 0.1 * perguntasOk + 0.2 * aplicFrac + 0.1 * (cites.misuse === 0 ? 1 : 0);
  return a;
}

function analyzeAnswer(text: string, rich: RichTextContext, task: 'answer' | 'deepen'): Analysis {
  const r: StructuredAnswer = parseStructuredAnswer(text, rich);
  const cites = citeCounts(lineSegments(text, ['perguntas', 'fim'], rich));
  const claims = claimsOf(r.blocks);
  const walk = walkCites(r.blocks);
  const plain = blocksToPlainText(r.blocks).replace(CITE_MARKER_RE, '');
  const [lo, hi] = task === 'answer' ? [2, 3] : [2, 4];
  const followOk = r.followUps.length >= lo && r.followUps.length <= hi ? 1 : 0;
  const stray = strayMarkers(text, ['perguntas', 'fim']);
  const a: Analysis = {
    complete: r.complete,
    blocks: r.blocks.length,
    citeValid: walk.valid,
    citeInvalid: walk.invalid,
    uncited: claims.reduce((n, c) => n + c.uncited.length, 0),
    factual: cites.factual,
    inferenceMisuse: cites.misuse,
    morph: claims.reduce((n, c) => n + c.morphConflicts.length, 0),
    english: count(plain, ENGLISH_RE),
    cjk: count(plain, CJK_RE),
    tables: text.split('\n').filter((l) => /^\s*\|/.test(l)).length,
    fences: (text.match(/```/g) ?? []).length,
    stray,
    followUps: r.followUps.length,
    format: 0,
  };
  a.format = 0.5 * followOk + 0.3 * (stray === 0 ? 1 : 0) + 0.2 * (r.blocks.length > 0 ? 1 : 0);
  return a;
}

/** Segmentos de citação das linhas de conteúdo (sem marcadores). */
function lineSegments(text: string, known: readonly string[], rich: RichTextContext): CitedSegment[] {
  return contentLines(text, known).flatMap((line) => parseCited(line, rich.citeIds));
}

function count(s: string, re: RegExp): number {
  return (s.match(re) ?? []).length;
}

// ---- execução ----------------------------------------------------------------------------------

interface RunRecord {
  key: string;
  model: string;
  extra: Extra;
  task: Task;
  passage: string;
  ok: boolean;
  error?: string;
  ttftS?: number;
  reasonS?: number;
  totalS: number;
  chars: number;
  score: number;
  analysis?: Analysis;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Espaçamento global entre inícios de requisição (limite de 40/min da NVIDIA). */
let nextStartAt = 0;
async function gate(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextStartAt);
  nextStartAt = at + MIN_GAP_MS;
  if (at > now) await sleep(at - now);
}

function apiConfig(): { apiKey: string; baseUrl: string } {
  const apiKey = process.env.NVIDIA_API_KEY ?? '';
  const baseUrl = process.env.NVIDIA_BASE_URL ?? PROVIDER_PRESETS.nvidia.baseUrl;
  if (!apiKey) throw new Error('NVIDIA_API_KEY ausente no .env (raiz do repositório).');
  return { apiKey, baseUrl };
}

function providerFor(model: string, extra: Extra): OpenAICompatibleProvider {
  const { apiKey, baseUrl } = apiConfig();
  const cfg = buildProviderConfig('nvidia', { apiKey, baseUrl, model });
  if (extra === 'default') delete cfg.extraBody;
  return new OpenAICompatibleProvider(cfg, fetch);
}

function errText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 200);
}

async function streamOnce(model: string, extra: Extra, task: Task, p: Prepared) {
  const provider = providerFor(model, extra);
  const { messages, maxTokens } = messagesFor(task, p);
  const t0 = Date.now();
  let tFirst = 0;
  let tReason = 0;
  let text = '';
  await gate();
  for await (const piece of provider.stream({
    messages,
    maxTokens,
    temperature: 0.2,
    stallMs: STALL_MS,
    onReasoning: () => {
      if (!tReason) tReason = Date.now();
    },
  })) {
    if (!tFirst) tFirst = Date.now();
    text += piece;
  }
  return { text, t0, tFirst, tReason, totalS: (Date.now() - t0) / 1000 };
}

async function runJob(model: string, extra: Extra, task: Task, p: Prepared): Promise<RunRecord> {
  const key = `${model}|${extra}|${task}|${p.passage.id}`;
  const base = { key, model, extra, task, passage: p.passage.id };
  let res: Awaited<ReturnType<typeof streamOnce>>;
  try {
    try {
      res = await streamOnce(model, extra, task, p);
    } catch (err) {
      if (err instanceof LLMError && err.code === 'rate_limit') {
        await sleep(20_000);
        res = await streamOnce(model, extra, task, p);
      } else {
        throw err;
      }
    }
  } catch (err) {
    return { ...base, ok: false, error: errText(err), totalS: 0, chars: 0, score: 0 };
  }
  const ttftS = res.tFirst ? (res.tFirst - res.t0) / 1000 : undefined;
  const reasonS = res.tReason ? (res.tReason - res.t0) / 1000 : undefined;
  if (!res.text.trim()) {
    return { ...base, ok: false, error: 'resposta vazia', totalS: res.totalS, chars: 0, score: 0, ttftS, reasonS };
  }
  const analysis = task === 'summary' ? analyzeSummary(res.text, p.rich) : analyzeAnswer(res.text, p.rich, task);
  saveText(model, extra, task, p.passage.id, res.text);
  return {
    ...base,
    ok: true,
    ttftS,
    reasonS,
    totalS: Math.round(res.totalS * 10) / 10,
    chars: res.text.length,
    score: scoreOf(analysis),
    analysis,
  };
}

function slug(model: string): string {
  return model.replace(/[^a-zA-Z0-9.-]+/g, '_');
}

let OUT_DIR = resolve(ROOT, 'tmp', 'bench-models');

function saveText(model: string, extra: Extra, task: Task, passage: string, text: string): void {
  const dir = resolve(OUT_DIR, 'texts', slug(model));
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `${extra}-${task}-${passage}.txt`), text);
}

async function pool<T>(items: readonly T[], worker: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const runners = Array.from({ length: CONCURRENCY }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await worker(item);
  });
  await Promise.all(runners);
}

// ---- probe ------------------------------------------------------------------------------------

interface ProbeRecord {
  model: string;
  ok: boolean;
  status?: string;
  totalS: number;
}

async function probe(): Promise<void> {
  const { apiKey, baseUrl } = apiConfig();
  const list = await fetchListings(apiKey, baseUrl);
  const usable = list.filter((m) => m.usable).map((m) => m.id);
  console.log(`Candidatos de chat: ${usable.length} (de ${list.length} ids em GET /models).`);
  mkdirSync(OUT_DIR, { recursive: true });
  const file = resolve(OUT_DIR, 'probe.jsonl');
  writeFileSync(file, '');
  await pool(usable, async (model) => {
    const provider = providerFor(model, 'off');
    const t0 = Date.now();
    let status = 'ok';
    let ok = true;
    await gate();
    try {
      let text = '';
      for await (const piece of provider.stream({
        messages: [{ role: 'user', content: 'Responda somente com a palavra: pronto.' }],
        maxTokens: 64,
        temperature: 0,
        stallMs: STALL_MS,
      })) text += piece;
      if (!text.trim()) {
        ok = false;
        status = 'sem texto';
      }
    } catch (err) {
      ok = false;
      status = err instanceof LLMError ? `${err.code}${err.status ? ` ${err.status}` : ''}` : errText(err);
    }
    const rec: ProbeRecord = { model, ok, status, totalS: Math.round((Date.now() - t0) / 100) / 10 };
    appendFileSync(file, JSON.stringify(rec) + '\n');
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${model} ${ok ? `${rec.totalS}s` : status}`);
  });
  console.log(`\nProbe salvo em ${file}`);
}

async function fetchListings(apiKey: string, baseUrl: string): Promise<ReturnType<typeof classifyModels>> {
  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`GET /models falhou (HTTP ${res.status}).`);
  const payload = (await res.json()) as { data?: unknown[] };
  return classifyModels(payload.data ?? []);
}

function readJsonl<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as T);
}

// ---- run --------------------------------------------------------------------------------------

interface Options {
  models?: string[];
  tasks: Task[];
  passages: string[];
  defaultMode: RegExp;
  force: boolean;
}

function parseOptions(argv: string[]): Options {
  const opts: Options = {
    tasks: [...TASKS],
    passages: PASSAGES.map((p) => p.id),
    defaultMode: /nemotron/i,
    force: argv.includes('--force'),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--models' && next) opts.models = next.split(',').map((s) => s.trim()).filter(Boolean);
    if (a === '--tasks' && next) opts.tasks = next.split(',').map((s) => s.trim()) as Task[];
    if (a === '--passages' && next) opts.passages = next.split(',').map((s) => s.trim());
    if (a === '--default-mode' && next) opts.defaultMode = new RegExp(next, 'i');
  }
  return opts;
}

async function run(argv: string[]): Promise<void> {
  const opts = parseOptions(argv);
  mkdirSync(OUT_DIR, { recursive: true });
  const runsFile = resolve(OUT_DIR, 'runs.jsonl');
  const done = new Set(readJsonl<RunRecord>(runsFile).map((r) => r.key));
  const models =
    opts.models ??
    readJsonl<ProbeRecord>(resolve(OUT_DIR, 'probe.jsonl'))
      .filter((r) => r.ok)
      .map((r) => r.model);
  if (models.length === 0) throw new Error('Nenhum modelo: rode "probe" antes ou use --models.');
  const passages = (await prepareAll()).filter((p) => opts.passages.includes(p.passage.id));

  const jobs: Array<{ model: string; extra: Extra; task: Task; p: Prepared }> = [];
  for (const model of models) {
    const modes: Extra[] = opts.defaultMode.test(model) ? ['off', 'default'] : ['off'];
    for (const extra of modes)
      for (const p of passages)
        for (const task of opts.tasks) jobs.push({ model, extra, task, p });
  }
  const pending = jobs.filter((j) => opts.force || !done.has(`${j.model}|${j.extra}|${j.task}|${j.p.passage.id}`));
  console.log(`Execução: ${pending.length} tarefas (${jobs.length} no total, ${jobs.length - pending.length} já feitas).`);

  let n = 0;
  await pool(pending, async (j) => {
    const rec = await runJob(j.model, j.extra, j.task, j.p);
    appendFileSync(runsFile, JSON.stringify(rec) + '\n');
    n++;
    const tail = rec.ok ? `score ${rec.score}, total ${rec.totalS}s` : `ERRO: ${rec.error}`;
    console.log(`[${n}/${pending.length}] ${j.model} ${j.extra} ${j.task} ${j.p.passage.id}: ${tail}`);
  });
}

// ---- report -----------------------------------------------------------------------------------

function median(xs: number[]): number | undefined {
  if (xs.length === 0) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1]! + s[m]!) / 2;
}

function report(): void {
  const runs = readJsonl<RunRecord>(resolve(OUT_DIR, 'runs.jsonl'));
  const groups = new Map<string, RunRecord[]>();
  for (const r of runs) {
    const g = `${r.model}|${r.extra}`;
    groups.set(g, [...(groups.get(g) ?? []), r]);
  }
  const rows = [...groups.entries()].map(([g, rs]) => {
    const [model, extra] = g.split('|') as [string, Extra];
    const ok = rs.filter((r) => r.ok);
    const totals = ok.map((r) => r.totalS);
    const ttfts = ok.map((r) => r.ttftS).filter((x): x is number => x !== undefined);
    const an = ok.map((r) => r.analysis).filter((a): a is Analysis => a !== undefined);
    const sum = (f: (a: Analysis) => number) => an.reduce((n, a) => n + f(a), 0);
    const acc = rs.reduce((n, r) => n + r.score, 0) / Math.max(1, rs.length);
    const med = median(totals);
    const speed = med === undefined ? 0 : 100 * Math.min(1, Math.max(0, (120 - med) / 110));
    return {
      model,
      extra,
      runs: rs.length,
      errors: rs.length - ok.length,
      complete: an.filter((a) => a.complete).length,
      ttft: median(ttfts),
      total: median(totals),
      valid: sum((a) => a.citeValid),
      invalid: sum((a) => a.citeInvalid),
      uncited: sum((a) => a.uncited),
      morph: sum((a) => a.morph),
      lang: sum((a) => a.english + a.cjk + a.tables + a.fences + a.stray),
      acc,
      overall: 0.8 * acc + 0.2 * speed,
    };
  });
  rows.sort((a, b) => b.overall - a.overall);
  const f = (x: number | undefined) => (x === undefined ? '–' : x.toFixed(1));
  console.log('| Modelo | Raciocínio | Tarefas | Erros | Completos | 1º texto (s) | Total (s) | Cit. válidas / inválidas | Sem citação | Conflitos morfo | Erros de língua | Precisão | Geral |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    console.log(
      `| ${r.model} | ${r.extra === 'off' ? 'desligado' : 'padrão'} | ${r.runs} | ${r.errors} | ${r.complete} | ${f(r.ttft)} | ${f(r.total)} | ${r.valid} / ${r.invalid} | ${r.uncited} | ${r.morph} | ${r.lang} | ${r.acc.toFixed(1)} | ${r.overall.toFixed(1)} |`,
    );
  }
}

// ---- main -------------------------------------------------------------------------------------

async function main(): Promise<void> {
  const [cmd = '', ...rest] = process.argv.slice(2);
  const outIdx = rest.indexOf('--out');
  if (outIdx >= 0 && rest[outIdx + 1]) OUT_DIR = resolve(rest[outIdx + 1]!);
  if (cmd === 'probe') return probe();
  if (cmd === 'run') return run(rest);
  if (cmd === 'report') return report();
  console.error('Uso: bench-models.ts probe | run [opções] | report  (ver o cabeçalho do arquivo)');
  process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(errText(err));
  process.exitCode = 1;
});

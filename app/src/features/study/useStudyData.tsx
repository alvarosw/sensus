// Dados da folha de estudo: painel da seleção, painel da perícope (contexto da IA), resumo em streaming
// e "Detalhar" por lente. Uma instância vive em <StudySheet/> e chega às lentes por contexto.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  deepenMessages,
  parseStructuredAnswer,
  parseStructuredSummary,
  splitVid,
  summaryCacheKey,
  summaryMessages,
  SUMMARY_MAX_TOKENS,
  wordKey,
  type Block,
  type Book,
  type PanelData,
  type ProviderConfig,
  type Repo,
  type RichTextContext,
  type StructuredSummary,
  type Vid,
} from '@sensus/core';
import { streamChat } from '@/ai/client';
import { useRepo } from '@/data/db-context';
import { APP_LOCALE } from '@/i18n';
import { useSettings } from '@/settings/settings-context';
import { LENS_KEYS, useStudy, type LensKey } from '@/state/study';
import { useBooks } from './useBooks';
import { usePassagePanel } from './usePassagePanel';

export interface Range {
  start: Vid;
  end: Vid;
}

export type AiStatus = 'noprovider' | 'waiting' | 'streaming' | 'done' | 'error';

export interface DeepView {
  key: string;
  /** Trecho da afirmação detalhada (vazio = a lente inteira). */
  claim: string;
  blocks: Block[];
  followUps: string[];
  status: 'streaming' | 'done' | 'error';
  error?: string;
  /** Modelo de raciocínio pensando, sem texto ainda ("pensando…"). */
  thinking: boolean;
}

export interface StudyAi {
  provider: ProviderConfig | null;
  status: AiStatus;
  error: string | null;
  summary: StructuredSummary | null;
  /** Lente que está recebendo texto agora (cursor piscante). */
  writingLens: LensKey | null;
  /** Resumo: modelo de raciocínio pensando, sem texto ainda ("pensando…" no lugar do esqueleto). */
  thinking: boolean;
  /** Perícope diferente da seleção: texto "Resumo da perícope …". */
  unitRange: Range | null;
  retry: () => void;
  /** Pode pedir "Detalhar" (provedor e contexto prontos). */
  canDeepen: boolean;
  deepen: (lens: LensKey, opts?: { claim?: string; claimKey?: string }) => void;
  deepViews: (lens: LensKey) => DeepView[];
  /** Perguntas sugeridas da lente. */
  questions: (lens: LensKey) => string[];
}

export interface StudyData {
  range: Range;
  books: Book[];
  panel: PanelData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Perícope que contém a seleção (literaryUnit). */
  unit: Range | null;
  /** palavra normalizada → cite_id do token (para tornar o grego tocável em textos de fontes). */
  tokenByKey: ReadonlyMap<string, string>;
  textSource: string;
  /** Versículos da seleção e vizinhos imediatos (inclusive em outro livro); null enquanto carrega. */
  edges: RangeEdges | null;
  /** Rótulo curto de um cite_id do painel (ex.: "Calvino", "Fp 2:5"); o próprio id se desconhecido. */
  labelOf: (citeId: string) => string;
}

export interface RangeEdges {
  count: number | null;
  prev: Vid | null;
  next: Vid | null;
}

/** Último versículo do livro (para "+ prev" quando a seleção começa no primeiro versículo de um livro). */
async function lastVerseOf(repo: Repo, src: string, book: number, books: readonly Book[]): Promise<Vid | null> {
  const b = books.find((x) => x.num === book);
  if (!b) return null;
  return (await repo.chapter(src, book, b.chapters)).at(-1)?.vid ?? null;
}

/** Primeiro versículo do livro (para "+ next" quando a seleção termina no último versículo de um livro). */
async function firstVerseOf(repo: Repo, src: string, book: number, books: readonly Book[]): Promise<Vid | null> {
  if (!books.some((x) => x.num === book)) return null;
  return (await repo.chapter(src, book, 1))[0]?.vid ?? null;
}

/** Contagem e vizinhos da seleção, direto do banco. Os vizinhos atravessam o livro (ex.: Cl 1:1 → Fp 4:23). */
function useRangeEdges(range: Range, textSource: string, books: readonly Book[]): RangeEdges | null {
  const repo = useRepo();
  const key = `${textSource}:${range.start}-${range.end}:${books.length}`;
  const [state, setState] = useState<{ key: string; edges: RangeEdges } | null>(null);
  useEffect(() => {
    let alive = true;
    const src = textSource === 'kjv' ? 'kjv' : 'blivre';
    (async () => {
      const first = splitVid(range.start).book;
      const last = splitVid(range.end).book;
      const [inside, before, after] = await Promise.all([
        repo.verseTexts(src, range),
        repo.neighbors(src, { start: range.start, end: range.start }, 1),
        repo.neighbors(src, { start: range.end, end: range.end }, 1),
      ]);
      const prev = before.before.at(-1)?.vid ?? (await lastVerseOf(repo, src, first - 1, books));
      const next = after.after[0]?.vid ?? (await firstVerseOf(repo, src, last + 1, books));
      return { count: inside.length > 0 ? inside.length : null, prev: prev ?? null, next: next ?? null };
    })().then(
      (edges) => alive && setState({ key, edges }),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [repo, key, range, textSource, books]);
  return state?.key === key ? state.edges : null;
}

// Dois contextos: os dados determinísticos mudam só com a seleção; a IA muda a cada pedaço do stream.
const DataCtx = createContext<StudyData | null>(null);
const AiCtx = createContext<StudyAi | null>(null);

export function useStudyData(): StudyData {
  const v = useContext(DataCtx);
  if (!v) throw new Error('useStudyData fora de <StudyDataProvider>');
  return v;
}

export function useStudyAi(): StudyAi {
  const v = useContext(AiCtx);
  if (!v) throw new Error('useStudyAi fora de <StudyDataProvider>');
  return v;
}

export function StudyDataProvider({ range, children }: { range: Range; children: ReactNode }) {
  const { data, ai } = useBuildStudyData(range);
  return (
    <DataCtx.Provider value={data}>
      <AiCtx.Provider value={ai}>{children}</AiCtx.Provider>
    </DataCtx.Provider>
  );
}

// ---- núcleo --------------------------------------------------------------------------------------

/** Perícopes muito longas (livro sem divisões) viram a própria seleção, para não montar o livro inteiro. */
function effectiveUnit(unit: Range | null, sel: Range): Range | null {
  if (!unit) return null;
  const a = splitVid(unit.start);
  const b = splitVid(unit.end);
  // Estimativa de versículos (~30 por capítulo); acima do limite o contexto da IA ficaria enorme.
  const approx = (b.chapter - a.chapter) * 30 + (b.verse - a.verse) + 1;
  if (a.book !== b.book || approx > MAX_UNIT_VERSES) return sel;
  return unit;
}

const MAX_UNIT_VERSES = 45;
/** Ordem em que o resumo chega (linhas-marcadoras de SUMMARY_FORMAT, no núcleo). */
const STREAM_ORDER: readonly LensKey[] = ['visao', 'literario', 'lingua', 'texto', 'intertexto', 'historico', 'interpretacao', 'aplicacao'];
const controllers = new Map<string, AbortController>();
const FLUSH_MS = 60;

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Modelo de raciocínio ainda pensando e sem texto: a UI mostra "pensando…" no lugar do esqueleto. */
function markThinking(key: string): void {
  const g = useStudy.getState().generations[key];
  if (g && !g.thinking && !g.text) useStudy.getState().setGeneration(key, { thinking: true });
}

function runStream(provider: ProviderConfig, key: string, messages: Parameters<typeof streamChat>[1]): void {
  const store = useStudy.getState();
  controllers.get(key)?.abort();
  const ctrl = new AbortController();
  controllers.set(key, ctrl);
  store.setGeneration(key, { text: '', status: 'streaming', error: undefined, thinking: false });
  let buf = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    if (buf) {
      const chunk = buf;
      buf = '';
      useStudy.getState().appendGeneration(key, chunk);
    }
  };
  // Reserva com a chave: descarta o texto parcial e refaz a resposta inteira (sem emendar).
  const restart = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    buf = '';
    useStudy.getState().setGeneration(key, { text: '', status: 'streaming', error: undefined, thinking: false });
  };
  streamChat(
    provider,
    messages,
    (chunk) => {
      buf += chunk;
      if (!timer) timer = setTimeout(flush, FLUSH_MS);
    },
    ctrl.signal,
    SUMMARY_MAX_TOKENS,
    () => markThinking(key),
    restart,
  ).then(
    () => {
      if (timer) clearTimeout(timer);
      flush();
      if (controllers.get(key) === ctrl) controllers.delete(key);
      useStudy.getState().setGeneration(key, { status: 'done', thinking: false });
    },
    (e: unknown) => {
      if (timer) clearTimeout(timer);
      flush();
      if (controllers.get(key) === ctrl) controllers.delete(key);
      if (ctrl.signal.aborted) return;
      useStudy.getState().setGeneration(key, { status: 'error', error: messageOf(e), thinking: false });
    },
  );
}

function useBuildStudyData(range: Range): { data: StudyData; ai: StudyAi } {
  const books = useBooks();
  const { provider } = useSettings();
  const detent = useStudy((s) => s.detent);
  const textSource = useStudy((s) => s.textSource);
  const generations = useStudy((s) => s.generations);

  const sel = usePassagePanel(range);
  // Mantém o painel anterior enquanto o novo carrega (evita piscar ao ajustar a seleção).
  const lastPanel = useRef<PanelData | null>(null);
  if (sel.panel) lastPanel.current = sel.panel;
  const panel = sel.panel ?? (sel.loading ? lastPanel.current : null);

  const unitRange = useMemo(() => effectiveUnit(sel.unit, range), [sel.unit, range]);
  const open = detent === 'half' || detent === 'full';
  // O painel da perícope é preparado já no "espiar"; só a IA espera a folha abrir.
  const unitPanel = usePassagePanel(unitRange);

  // Falha de carga (ex.: banco ainda abrindo): uma nova tentativa automática; depois, o botão "Tentar novamente".
  const autoRetried = useRef<string | null>(null);
  useEffect(() => {
    const id = `${range.start}-${range.end}`;
    if (!sel.error || autoRetried.current === id) return;
    autoRetried.current = id;
    const t = setTimeout(sel.reload, 1200);
    return () => clearTimeout(t);
  }, [sel.error, sel.reload, range.start, range.end]);

  const edges = useRangeEdges(range, textSource, books);
  const key = unitRange ? summaryCacheKey(unitRange) : null;
  const gen = key ? generations[key] : undefined;
  const ctxReady = !!(unitPanel.context && unitPanel.richCtx);

  // ---- resumo automático ao abrir a folha -------------------------------------------------------
  const startSummary = useCallback(() => {
    if (!provider || !key || !unitRange || !unitPanel.context) return;
    // Só uma geração de resumo em andamento: a anterior (outra perícope) é descartada.
    for (const [k, c] of controllers) {
      if (k.startsWith('summary:') && k !== key) {
        c.abort();
        controllers.delete(k);
        useStudy.getState().setGeneration(k, { text: '', status: 'idle', error: undefined, thinking: false });
      }
    }
    const focus = unitRange.start === range.start && unitRange.end === range.end ? undefined : { start: range.start, end: range.end };
    runStream(provider, key, summaryMessages(unitPanel.context, { language: APP_LOCALE, focus }));
  }, [provider, key, unitRange, unitPanel.context, range.start, range.end]);

  useEffect(() => {
    if (!open || !provider || !key || !ctxReady) return;
    const g = useStudy.getState().generations[key];
    if (g?.status === 'done' || g?.status === 'error') return;
    if (g?.status === 'streaming' && controllers.has(key)) return;
    startSummary();
  }, [open, provider, key, ctxReady, startSummary]);

  useEffect(
    () => () => {
      for (const c of controllers.values()) c.abort();
      controllers.clear();
      // Gerações interrompidas voltam a "idle" para recomeçar quando a folha reabrir.
      const st = useStudy.getState();
      for (const [k, g] of Object.entries(st.generations)) if (g.status === 'streaming') st.setGeneration(k, { text: '', status: 'idle', thinking: false });
    },
    [],
  );

  const richCtx: RichTextContext | null = unitPanel.richCtx;
  const summaryText = gen?.text ?? '';
  const summary = useMemo(
    () => (richCtx && summaryText ? parseStructuredSummary(summaryText, richCtx) : null),
    [richCtx, summaryText],
  );

  const status: AiStatus = !provider
    ? 'noprovider'
    : gen?.status === 'error'
      ? 'error'
      : gen?.status === 'done'
        ? 'done'
        : gen?.status === 'streaming' && summaryText
          ? 'streaming'
          : 'waiting';

  const thinking = !!gen?.thinking && !summaryText;

  const writingLens = useMemo<LensKey | null>(() => {
    if (status !== 'streaming' || !summary) return null;
    // A última seção com texto na ordem em que o resumo chega (SUMMARY_FORMAT) é a que está sendo escrita.
    let cur: LensKey | null = null;
    for (const k of STREAM_ORDER) {
      const has = k === 'visao' ? summary.overview.length > 0 : (summary.sections[k]?.length ?? 0) > 0;
      if (has) cur = k;
    }
    return cur;
  }, [status, summary]);

  // ---- Detalhar ----------------------------------------------------------------------------------
  const canDeepen = !!provider && ctxReady;
  const deepen = useCallback(
    (lens: LensKey, opts?: { claim?: string; claimKey?: string }) => {
      if (!provider || !unitPanel.context || !key) return;
      const k = `deep:${key}:${lens}${opts?.claimKey ? `:${opts.claimKey}` : ''}`;
      const g = useStudy.getState().generations[k];
      if (g && g.status !== 'error' && g.status !== 'idle') return;
      const claim = opts?.claim?.trim();
      // O texto do ponto detalhado fica ao lado da geração para o rótulo do bloco.
      claimLabels.set(k, claim ?? '');
      runStream(provider, k, deepenMessages(unitPanel.context, lens, { language: APP_LOCALE, claim: claim || undefined }));
    },
    [provider, unitPanel.context, key],
  );

  const deepViews = useCallback(
    (lens: LensKey): DeepView[] => {
      if (!key || !richCtx) return [];
      const prefix = `deep:${key}:${lens}`;
      const out: DeepView[] = [];
      for (const [k, g] of Object.entries(generations)) {
        if (k !== prefix && !k.startsWith(`${prefix}:`)) continue;
        if (g.status === 'idle') continue;
        const parsed = parseStructuredAnswer(g.text, richCtx);
        out.push({
          key: k,
          claim: claimLabels.get(k) ?? '',
          blocks: parsed.blocks,
          followUps: parsed.followUps,
          status: g.status === 'streaming' ? 'streaming' : g.status === 'error' ? 'error' : 'done',
          error: g.error,
          thinking: !!g.thinking && !g.text,
        });
      }
      return out;
    },
    [generations, key, richCtx],
  );

  const questions = useCallback(
    (lens: LensKey): string[] => {
      const own = summary?.sectionQuestions?.[lens];
      if (own && own.length > 0) return own;
      if (lens === 'visao' && summary?.complete) return summary.questions.slice(0, 2);
      return [];
    },
    [summary],
  );

  const ai = useMemo<StudyAi>(
    () => ({
      provider,
      status,
      error: gen?.error ?? null,
      summary,
      writingLens,
      thinking,
      unitRange: unitRange && (unitRange.start !== range.start || unitRange.end !== range.end) ? unitRange : null,
      retry: () => {
        if (key) useStudy.getState().setGeneration(key, { text: '', status: 'idle', error: undefined, thinking: false });
        startSummary();
      },
      canDeepen,
      deepen,
      deepViews,
      questions,
    }),
    [provider, status, gen?.error, summary, writingLens, thinking, unitRange, range.start, range.end, key, startSummary, canDeepen, deepen, deepViews, questions],
  );

  const tokenByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of panel?.layers.text.original ?? []) {
      const k = wordKey(t.surface);
      if (k && !m.has(k)) m.set(k, t.cite_id);
    }
    return m;
  }, [panel]);

  const allBooks = books.length > 0 ? books : sel.books;
  const loading = sel.loading && !panel;
  const citeIndex = sel.richCtx?.citeIndex;
  const labelOf = useCallback((id: string) => citeIndex?.get(id)?.label ?? id, [citeIndex]);
  const data = useMemo<StudyData>(
    () => ({ range, books: allBooks, panel, loading, error: sel.error, reload: sel.reload, unit: sel.unit, tokenByKey, textSource, edges, labelOf }),
    [range, allBooks, panel, loading, sel.error, sel.reload, sel.unit, tokenByKey, textSource, edges, labelOf],
  );
  return { data, ai };
}

/** Rótulo do ponto detalhado por chave de geração (só para exibição). */
const claimLabels = new Map<string, string>();

export { LENS_KEYS };

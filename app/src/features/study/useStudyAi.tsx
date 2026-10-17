// IA da folha de estudo: resumo da perícope em streaming, "Detalhar" por lente e perguntas sugeridas. Roda só
// com a folha aberta (ou quando o pedido chega); o texto parcial vai para o store de gerações. O estado é lido
// pela folha por useStudyAi (study-context), que recebe o mesmo objeto de useStudyData.tsx.
import { useCallback, useEffect, useMemo } from 'react';
import {
  deepenMessages,
  parseStructuredAnswer,
  parseStructuredSummary,
  summaryCacheKey,
  summaryMessages,
  SUMMARY_MAX_TOKENS,
  type ProviderConfig,
  type RichTextContext,
} from '@sensus/core';
import { streamChat } from '@/ai/client';
import { APP_LOCALE } from '@/i18n';
import { useSettings } from '@/settings/settings-context';
import { useStudy, type LensKey } from '@/state/study';
import type { PassagePanel } from './usePassagePanel';
import type { AiStatus, DeepView, Range, StudyAi } from './study-state';

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

/**
 * Estado da IA da folha. `range` é a seleção; `unitRange` é a perícope que dá contexto ao resumo (null sem
 * perícope); `unitPanel` é o painel dela, já preparado pelo lado de dados (useStudyData).
 */
export function useStudyAiFeed(range: Range, unitRange: Range | null, unitPanel: PassagePanel): StudyAi {
  const { provider } = useSettings();
  const detent = useStudy((s) => s.detent);
  const generations = useStudy((s) => s.generations);

  const open = detent === 'half' || detent === 'full';
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

  return ai;
}

/** Rótulo do ponto detalhado por chave de geração (só para exibição). */
const claimLabels = new Map<string, string>();

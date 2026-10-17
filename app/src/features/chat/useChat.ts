// Ligação entre o estado, o contexto do trecho (usePassagePanel) e o motor: oferece ask/retry/stop ao chat.
import { useCallback, useEffect, useMemo } from 'react';
import { parseStructuredSummary, splitVid, summaryCacheKey, type RichTextContext } from '@sensus/core';
import { useSettings } from '@/settings/settings-context';
import { LENS_LABELS, useStudy, type Attachment, type LensKey } from '@/state/study';
import { usePassagePanel, type PassagePanel } from '@/features/study';
import { CHAT } from '../common/strings';
import { ask as engineAsk, EMPTY_CTX, retry as engineRetry, stop as engineStop } from './engine';

export interface ChatApi {
  hasProvider: boolean;
  passage: PassagePanel;
  /** Contexto ainda sendo montado para o trecho atual. */
  contextBusy: boolean;
  /** Intervalo da pergunta atual: a seleção, ou o da última vez da conversa. */
  range: { start: number; end: number } | null;
  streaming: boolean;
  ask: (question: string, extra?: Attachment[]) => boolean;
  retry: (turnId: string) => void;
  stop: () => void;
  /** Contexto de leitura da resposta no trecho atual (fallback quando a vez não tem o seu). */
  richCtx: RichTextContext;
}

export function useChat(onNoProvider: (question: string) => void): ChatApi {
  const { provider } = useSettings();
  const selection = useStudy((s) => s.selection);
  const lastRange = useStudy((s) => s.thread[s.thread.length - 1]?.range ?? null);
  const streaming = useStudy((s) => s.thread.some((t) => t.status === 'streaming'));

  const start = selection ? selection.start : (lastRange?.start ?? null);
  const end = selection ? selection.end : (lastRange?.end ?? null);
  const range = useMemo(() => (start !== null && end !== null ? { start, end } : null), [start, end]);
  const passage = usePassagePanel(range);
  const contextBusy = range !== null && passage.loading && !passage.context;

  const ask = useCallback(
    (question: string, extra?: Attachment[]): boolean => {
      const q = question.trim();
      if (!q) return false;
      if (!provider) {
        onNoProvider(q);
        return false;
      }
      const s = useStudy.getState();
      for (const a of extra ?? []) s.attach(a);
      const id = engineAsk({
        provider,
        question: q,
        range,
        contextText: passage.context?.text ?? '',
        richCtx: passage.richCtx ?? EMPTY_CTX,
      });
      return id !== null;
    },
    [provider, range, passage.context, passage.richCtx, onNoProvider],
  );

  const retry = useCallback(
    (turnId: string) => {
      if (provider) engineRetry(turnId, provider);
    },
    [provider],
  );

  return {
    hasProvider: provider !== null,
    passage,
    contextBusy,
    range,
    streaming,
    ask,
    retry,
    stop: engineStop,
    richCtx: passage.richCtx ?? EMPTY_CTX,
  };
}

/** Mesma regra da folha: perícope longa demais vira a própria seleção (ver study/useStudyData). */
function effectiveUnit(unit: { start: number; end: number } | null, sel: { start: number; end: number }) {
  if (!unit) return null;
  const a = splitVid(unit.start);
  const b = splitVid(unit.end);
  if (a.book !== b.book || b.chapter - a.chapter > 3) return sel;
  return unit;
}

/** Perguntas sugeridas da lente visível (do resumo gerado), com as da visão geral e algumas genéricas. */
export function useSuggestions(passage: PassagePanel, range: { start: number; end: number } | null, hasProvider: boolean): string[] {
  const lens = useStudy((s) => s.lens);
  const generations = useStudy((s) => s.generations);
  const unitRange = useMemo(() => (range ? effectiveUnit(passage.unit, range) : null), [passage.unit, range]);
  const unitPanel = usePassagePanel(unitRange);
  const text = unitRange ? generations[summaryCacheKey(unitRange)]?.text : undefined;
  const richCtx = unitPanel.richCtx;
  return useMemo(() => {
    if (!hasProvider) return [];
    const out: string[] = [];
    if (text && richCtx) {
      const parsed = parseStructuredSummary(text, richCtx);
      const bySection = parsed.sectionQuestions ?? {};
      for (const key of [lens, 'visao'] as LensKey[]) {
        for (const q of bySection[key as keyof typeof bySection] ?? []) out.push(q);
      }
      if (out.length < 3) out.push(...parsed.questions);
    }
    const unique = [...new Set(out)].slice(0, 5);
    return unique.length > 0 ? unique : [...CHAT.fallbackQuestions];
  }, [text, richCtx, lens, hasProvider]);
}

/** Zera a pergunta pendente depois que o chat a consumir. */
export function usePendingQuestion(ready: boolean, send: (q: string) => void): void {
  const pending = useStudy((s) => s.pendingQuestion);
  const consume = useStudy((s) => s.consumeQuestion);
  useEffect(() => {
    if (!pending || !ready) return;
    consume();
    send(pending);
  }, [pending, ready, consume, send]);
}

export function lensLabel(lens: LensKey): string {
  return LENS_LABELS[lens];
}

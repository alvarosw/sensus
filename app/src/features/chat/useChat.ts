// Ligação entre o estado, o contexto do trecho (usePassagePanel) e o motor: oferece ask/retry/stop ao chat.
// O contexto da IA é o da unidade (perícope), igual ao da folha; a seleção vai como foco. Mudar de trecho tira os
// anexos (com aviso e Desfazer) e marca um divisor na conversa.
import { useCallback, useEffect, useMemo } from 'react';
import { formatShortRef, parseStructuredSummary, splitVid, summaryCacheKey, type RichTextContext } from '@sensus/core';
import { useSettings } from '@/settings/settings-context';
import { LENS_LABELS, unitKeyOf, useStudy, type Attachment, type LensKey } from '@/state/study';
import { usePassagePanel, type PassagePanel } from '@/features/study';
import { CHAT, TOAST } from '../common/strings';
import { ask as engineAsk, EMPTY_CTX, forgetAll, retry as engineRetry, stop as engineStop } from './engine';

export interface ChatApi {
  hasProvider: boolean;
  /** Painel do contexto que a IA recebe: a unidade (perícope), ou a seleção quando não há unidade. */
  passage: PassagePanel;
  /** Painel da seleção (base das perguntas sugeridas da folha). */
  selectionPanel: PassagePanel;
  /** Contexto ainda sendo montado para o trecho atual. */
  contextBusy: boolean;
  /** Intervalo da pergunta atual: a seleção, ou o da última vez da conversa. */
  range: { start: number; end: number } | null;
  /** Unidade que a IA recebe como contexto (null: o contexto é a própria seleção). */
  unit: { start: number; end: number } | null;
  /** Seleção dentro da unidade, que a resposta deve focar (null: a unidade é a própria seleção). */
  focus: { start: number; end: number } | null;
  streaming: boolean;
  /** `fromComposer`: a pergunta digitada leva os anexos do composer; sugeridas e de lente não levam. */
  ask: (question: string, fromComposer: boolean) => boolean;
  retry: (turnId: string) => void;
  stop: () => void;
  /** Nova conversa: para a resposta em curso e esquece a conversa e os anexos. */
  newConversation: () => void;
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
  const selectionPanel = usePassagePanel(range);
  // Mesma unidade que a folha usa (effectiveUnit), com a seleção como foco.
  const unitRange = useMemo(
    () => (range && selectionPanel.unit ? effectiveUnit(selectionPanel.unit, range) : null),
    [selectionPanel.unit, range],
  );
  const unitPanel = usePassagePanel(unitRange);
  const passage = unitRange ? unitPanel : selectionPanel;
  const contextBusy = range !== null && passage.loading && !passage.context;
  const focus = useMemo(
    () => (unitRange && range && (unitRange.start !== range.start || unitRange.end !== range.end) ? range : null),
    [unitRange, range],
  );

  // Trecho da conversa: só vale depois que o contexto dele chegou (assim o nome do trecho também está pronto).
  const chatRange = passage.context && range ? (unitRange ?? range) : null;
  const chatKey = chatRange ? unitKeyOf(chatRange) : null;
  const chatRef = chatRange ? formatShortRef(chatRange.start, chatRange.end, passage.books, true) : '';

  const announceRemoved = useCallback((removed: Attachment[]) => {
    if (removed.length === 0) return;
    useStudy.getState().showToast({
      text: CHAT.unitChanged,
      actionLabel: TOAST.action,
      onAction: () => useStudy.getState().restoreAttachments(removed),
    });
  }, []);

  // Mudou de trecho: tira os anexos (com Desfazer) e marca o divisor, mesmo com o chat fechado.
  useEffect(() => {
    if (chatKey === null) return;
    announceRemoved(useStudy.getState().moveToUnit(chatKey, chatRef));
  }, [chatKey, chatRef, announceRemoved]);

  const ask = useCallback(
    (question: string, fromComposer: boolean): boolean => {
      const q = question.trim();
      if (!q) return false;
      if (!provider) {
        onNoProvider(q);
        return false;
      }
      // Confere o trecho na hora de perguntar (a pergunta não pode ir com anexos de outro trecho).
      if (chatKey !== null) announceRemoved(useStudy.getState().moveToUnit(chatKey, chatRef));
      const attachments = fromComposer ? useStudy.getState().attachments : [];
      const id = engineAsk({
        provider,
        question: q,
        range,
        unitKey: chatKey ?? '',
        attachments,
        contextText: passage.context?.text ?? '',
        richCtx: passage.richCtx ?? EMPTY_CTX,
        focus,
      });
      return id !== null;
    },
    [provider, chatKey, chatRef, announceRemoved, range, passage.context, passage.richCtx, focus, onNoProvider],
  );

  const retry = useCallback(
    (turnId: string) => {
      if (provider) engineRetry(turnId, provider);
    },
    [provider],
  );

  const newConversation = useCallback(() => {
    forgetAll();
    useStudy.getState().newConversation();
  }, []);

  return {
    hasProvider: provider !== null,
    passage,
    selectionPanel,
    contextBusy,
    range,
    unit: unitRange ?? range,
    focus,
    streaming,
    ask,
    retry,
    stop: engineStop,
    newConversation,
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

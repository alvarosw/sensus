// Curiosidade do trecho na folha: com a folha aberta e o contexto da unidade pronto, dispara UMA vez por unidade o
// gerador, o portão em código e as duas revisões (em paralelo, sem esperar o resumo). Estado no store (curiosities),
// só em memória. Erro e "não mostrar" ficam silenciosos: nada aparece. Fechar a folha cancela (volta a idle).
import { useEffect, useMemo } from 'react';
import {
  CURIOSITY_MAX_TOKENS,
  CURIOSITY_REVIEW_MAX_TOKENS,
  curiosityCacheKey,
  curiosityMessages,
  curiosityReviewMessages,
  curiosityVerdict,
  parseCuriosityReview,
  parseRichText,
  type CuriosityReview,
  type ProviderConfig,
  type RichTextContext,
  type SerializedContext,
  type VerseRange,
} from '@sensus/core';
import { streamChat } from '@/ai/client';
import { currentBcp47 } from '@/i18n';
import { useSettings } from '@/settings/settings-context';
import { canStartCuriosity, useStudy, type CuriosityEvent } from '@/state/study';
import { judgeGenerator, plainText } from './curiosity-model';
import type { PassagePanel } from './usePassagePanel';
import type { CuriosityView, Range } from './study-state';

/** Uma geração por unidade: a chave aponta para o controlador da chamada em curso. */
const controllers = new Map<string, AbortController>();

function dispatch(key: string, ev: CuriosityEvent): void {
  useStudy.getState().dispatchCuriosity(key, ev);
}

/** Para a curiosidade de uma unidade (folha fechada, outra unidade, desmontagem); o estado volta a idle. */
function cancelCuriosity(key: string): void {
  const c = controllers.get(key);
  if (!c) return;
  controllers.delete(key);
  c.abort();
  dispatch(key, { type: 'cancel' });
}

interface RunArgs {
  provider: ProviderConfig;
  key: string;
  context: SerializedContext;
  rich: RichTextContext;
  focus: VerseRange | undefined;
  signal: AbortSignal;
}

/** Gerador, portão, duas revisões e veredito. Cada etapa só roda se a anterior passou. */
async function runCuriosity({ provider, key, context, rich, focus, signal }: RunArgs): Promise<void> {
  const language = currentBcp47();
  const emit = (ev: CuriosityEvent) => {
    if (!signal.aborted) dispatch(key, ev);
  };
  try {
    let raw = '';
    await streamChat(
      provider,
      curiosityMessages(context, { language, focus }),
      (chunk) => {
        raw += chunk;
      },
      signal,
      CURIOSITY_MAX_TOKENS,
      undefined,
      () => {
        raw = '';
      },
    );
    const step = judgeGenerator(raw, rich);
    if (step.kind === 'hide') return emit({ type: 'hide', reason: step.reason });
    const candidate = step.candidate;
    emit({ type: 'candidate', candidate });

    // Duas revisões independentes, com a mesma mensagem; o veredito final exige as duas.
    const reviewOnce = async (): Promise<CuriosityReview | null> => {
      let text = '';
      await streamChat(
        provider,
        curiosityReviewMessages(context, candidate, { language }),
        (chunk) => {
          text += chunk;
        },
        signal,
        CURIOSITY_REVIEW_MAX_TOKENS,
        undefined,
        () => {
          text = '';
        },
      );
      return parseCuriosityReview(text);
    };
    const reviews = await Promise.all([reviewOnce(), reviewOnce()]);
    const verdict = curiosityVerdict(candidate, reviews);
    emit(verdict.show ? { type: 'show', reason: verdict.reason } : { type: 'hide', reason: verdict.reason });
  } catch (e) {
    emit({ type: 'fail', reason: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Curiosidade da unidade para a folha (null enquanto não há uma aprovada). `range` é a seleção (foco do pedido);
 * `unitRange` é a unidade literária com o painel já preparado em `unitPanel`, como no resumo.
 */
export function useCuriosityFeed(range: Range, unitRange: Range | null, unitPanel: PassagePanel): CuriosityView | null {
  const { provider } = useSettings();
  const detent = useStudy((s) => s.detent);
  const open = detent === 'half' || detent === 'full';
  const key = unitRange ? curiosityCacheKey(unitRange) : null;
  const entry = useStudy((s) => (key ? s.curiosities[key] : undefined));
  const status = entry?.status;
  const context = unitPanel.context;
  const rich = unitPanel.richCtx;

  // Arranque: só com a folha aberta, provedor e contexto prontos, e enquanto a unidade estiver ociosa.
  useEffect(() => {
    if (!key || !provider || !context || !rich) return;
    if (!canStartCuriosity(useStudy.getState().curiosities[key]?.status, { open, hasProvider: true, ready: true })) return;
    if (controllers.has(key)) return;
    // Uma unidade por vez: a anterior (outra perícope) é cancelada.
    for (const k of [...controllers.keys()]) if (k !== key) cancelCuriosity(k);
    const focus = unitRange && (unitRange.start !== range.start || unitRange.end !== range.end) ? { start: range.start, end: range.end } : undefined;
    const ctrl = new AbortController();
    controllers.set(key, ctrl);
    dispatch(key, { type: 'start' });
    void runCuriosity({ provider, key, context, rich, focus, signal: ctrl.signal }).finally(() => {
      if (controllers.get(key) === ctrl) controllers.delete(key);
    });
    // Dependências: o range e a unidade entram pelo foco; o status volta a disparar o arranque após um cancelamento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, provider, key, context, rich, status, range.start, range.end, unitRange]);

  // Fechar a folha cancela a geração em curso (ao reabrir, recomeça).
  useEffect(() => {
    if (!open && key) cancelCuriosity(key);
  }, [open, key]);

  // Desmontar a folha cancela tudo.
  useEffect(
    () => () => {
      for (const k of [...controllers.keys()]) cancelCuriosity(k);
    },
    [],
  );

  return useMemo<CuriosityView | null>(() => {
    if (!key || !rich || entry?.status !== 'shown' || !entry.candidate) return null;
    const c = entry.candidate;
    return {
      key,
      candidate: c,
      hook: plainText(c.hook),
      listener: parseRichText(c.listener, rich),
      today: parseRichText(c.today, rich),
      change: parseRichText(c.change, rich),
    };
  }, [key, rich, entry]);
}

// Tradução automática da linha do tempo (títulos, nomes de linhas, participantes). Diferente da tradução do estudo:
// sem oferta por item e sem "Ver original" em cada texto. Quando está configurada (ligada e modelo pronto) todos os
// textos da linha do tempo aparecem traduzidos; o pedido ao aparelho é um lote por quadro (ask/flush), e o original
// segue na tela até a tradução chegar (sem pular o layout). O "Ver original" vale para a linha do tempo inteira.
// Fonte dos dados: theographic, em inglês (source.lang); por isso não há checagem de idioma por item.
import { useEffect } from 'react';
import { create } from 'zustand';
import { cachedTranslation, translateMany } from './engine';
import { ensureTranslateLoaded, useTranslate } from './store';

/** Espera antes de mandar o lote: os itens que renderizam no mesmo quadro entram no mesmo pedido. */
const BATCH_DELAY_MS = 30;

const pending = new Set<string>();
const failed = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

interface TimelineView {
  /** Sobe a cada lote concluído: quem lê o cache renderiza de novo. */
  version: number;
  showOriginal: boolean;
  toggleOriginal(): void;
}

export const useTimelineView = create<TimelineView>()((set) => ({
  version: 0,
  showOriginal: false,
  toggleOriginal: () => set((s) => ({ showOriginal: !s.showOriginal })),
}));

/** Pede a tradução de um texto para o próximo lote (ignora o que já está no cache ou já falhou). */
function ask(text: string): void {
  if (!text.trim() || failed.has(text) || cachedTranslation(text) !== null) return;
  pending.add(text);
  if (timer === null) timer = setTimeout(flush, BATCH_DELAY_MS);
}

async function flush(): Promise<void> {
  timer = null;
  const texts = [...pending];
  pending.clear();
  if (texts.length === 0) return;
  try {
    await translateMany(texts);
  } catch {
    // falha: o original fica na tela e esses textos não são pedidos de novo nesta sessão
    texts.forEach((t) => failed.add(t));
  }
  useTimelineView.setState((s) => ({ version: s.version + 1 }));
}

/** A tradução da linha do tempo está configurada: opção ligada e modelo pronto no aparelho. */
export function useTimelineActive(): boolean {
  const loaded = useTranslate((s) => s.loaded);
  const supported = useTranslate((s) => s.supported);
  const enabled = useTranslate((s) => s.enabled);
  const model = useTranslate((s) => s.model);
  useEffect(() => {
    ensureTranslateLoaded();
  }, []);
  return loaded && supported && enabled && model === 'ready';
}

/** Estado para a tela: configurada, mostrando o original ou a tradução, e o "Ver original". */
export function useTimelineTranslation(): { active: boolean; showOriginal: boolean; toggle: () => void } {
  const active = useTimelineActive();
  const showOriginal = useTimelineView((s) => s.showOriginal);
  const toggle = useTimelineView((s) => s.toggleOriginal);
  return { active, showOriginal, toggle };
}

/** Versão do cache de tradução: muda quando um lote chega (para memorizações que dependem da tradução). */
export function useTimelineVersion(): number {
  return useTimelineView((s) => s.version);
}

/** Um texto da linha do tempo, traduzido quando configurado (o original enquanto não chega). */
export function useTimelineText(text: string | null | undefined): string {
  const src = text ?? '';
  const active = useTimelineActive();
  const showOriginal = useTimelineView((s) => s.showOriginal);
  useTimelineVersion();
  useEffect(() => {
    if (active && src) ask(src);
  }, [active, src]);
  if (!active || showOriginal || !src) return src;
  return cachedTranslation(src) ?? src;
}

/**
 * Vários textos de uma vez (um lote por quadro). Devolve a função que dá o texto a mostrar; use-a em listas e no
 * gráfico, onde não se pode chamar um hook por item.
 */
export function useTimelineTexts(texts: readonly string[]): (text: string) => string {
  const active = useTimelineActive();
  const showOriginal = useTimelineView((s) => s.showOriginal);
  useTimelineVersion();
  const key = texts.join('\u0001');
  useEffect(() => {
    if (active) for (const t of texts) ask(t);
    // A chave é a lista de textos; o array muda de identidade a cada render sem mudar o conteúdo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key]);
  return (text: string) => (!active || showOriginal || !text ? text : (cachedTranslation(text) ?? text));
}

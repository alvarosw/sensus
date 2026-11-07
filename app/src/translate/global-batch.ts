// Lote global da tradução (política 'global', linha do tempo): os textos pedidos por todas as telas entram numa fila
// só e vão ao aparelho num pedido por quadro (30 ms), um pedido por par de idiomas. Um só "Ver original" para a tela
// inteira. Estado só em memória.
import { create } from 'zustand';
import type { TranslationPair } from '@sensus/core';
import { cacheKey, cachedTranslation, pairKey, translateMany } from './engine';
import { globalAskList } from './policy';

/** Espera antes de mandar o lote: os itens que renderizam no mesmo quadro entram no mesmo pedido. */
const BATCH_DELAY_MS = 30;

interface Ask {
  pair: TranslationPair;
  texts: Set<string>;
}

const pending = new Map<string, Ask>();
/** Textos que falharam no par, com a chave do cache (par + texto). */
const failed = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

export interface GlobalView {
  /** Sobe a cada lote concluído: quem lê o cache renderiza de novo. */
  version: number;
  showOriginal: boolean;
  toggleOriginal(): void;
}

export const useGlobalView = create<GlobalView>()((set) => ({
  version: 0,
  showOriginal: false,
  toggleOriginal: () => set((s) => ({ showOriginal: !s.showOriginal })),
}));

/** Pede a tradução de textos no par para o próximo lote (ignora o que já está no cache ou já falhou). */
export function askGlobal(texts: readonly string[], pair: TranslationPair): void {
  const todo = globalAskList(texts, {
    cached: (t) => cachedTranslation(t, pair) !== null,
    failed: (t) => failed.has(cacheKey(pair, t)),
  });
  if (todo.length === 0) return;
  const key = pairKey(pair);
  const ask = pending.get(key) ?? { pair, texts: new Set<string>() };
  pending.set(key, ask);
  for (const t of todo) ask.texts.add(t);
  if (timer === null) timer = setTimeout(flush, BATCH_DELAY_MS);
}

/** Tira textos da lista de falhas do par para que possam ser pedidos de novo (botão de tentar outra vez). */
export function retryGlobal(texts: readonly string[], pair: TranslationPair): void {
  for (const t of texts) failed.delete(cacheKey(pair, t));
  askGlobal(texts, pair);
}

/** O texto falhou neste par nesta sessão e não será pedido de novo sem `retryGlobal`. */
export function isGlobalFailed(text: string, pair: TranslationPair): boolean {
  return failed.has(cacheKey(pair, text));
}

async function flush(): Promise<void> {
  timer = null;
  const asks = [...pending.values()];
  pending.clear();
  for (const ask of asks) {
    const texts = [...ask.texts];
    try {
      await translateMany(texts, ask.pair);
    } catch {
      // falha: o original fica na tela e esses textos não são pedidos de novo nesta sessão
      texts.forEach((t) => failed.add(cacheKey(ask.pair, t)));
    }
  }
  useGlobalView.setState((s) => ({ version: s.version + 1 }));
}

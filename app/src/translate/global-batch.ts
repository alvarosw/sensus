// Lote global da tradução (política 'global', linha do tempo): os textos pedidos por todas as telas entram numa fila
// só e vão ao aparelho num pedido por quadro (30 ms). Um só "Ver original" para a tela inteira. Estado só em memória.
import { create } from 'zustand';
import { cachedTranslation, translateMany } from './engine';
import { globalAskList } from './policy';

/** Espera antes de mandar o lote: os itens que renderizam no mesmo quadro entram no mesmo pedido. */
const BATCH_DELAY_MS = 30;

const pending = new Set<string>();
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

/** Pede a tradução de textos para o próximo lote (ignora o que já está no cache ou já falhou). */
export function askGlobal(texts: readonly string[]): void {
  const todo = globalAskList(texts, { cached: (t) => cachedTranslation(t) !== null, failed: (t) => failed.has(t) });
  if (todo.length === 0) return;
  for (const t of todo) pending.add(t);
  if (timer === null) timer = setTimeout(flush, BATCH_DELAY_MS);
}

/** Tira textos da lista de falhas para que possam ser pedidos de novo (botão de tentar outra vez). */
export function retryGlobal(texts: readonly string[]): void {
  for (const t of texts) failed.delete(t);
  askGlobal(texts);
}

/** Textos desta sessão que falharam e não serão pedidos de novo sem `retryGlobal`. */
export function isGlobalFailed(text: string): boolean {
  return failed.has(text);
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
  useGlobalView.setState((s) => ({ version: s.version + 1 }));
}

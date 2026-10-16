// Tradução automática (inglês -> português) com cache só na memória: nada disto é gravado no aparelho.
import { assembleTranslation, chunked, runsToTranslate, segmentForTranslation, translatableRuns, type TextSegment } from '@sensus/core';
import { translateRuns } from './native';

/** Teto de trechos guardados (cada trecho é uma frase ou um fragmento entre referências). */
const CACHE_MAX = 3000;
/** Trechos por pedido ao aparelho (um lote da linha do tempo pode ter centenas de títulos e nomes). */
const BATCH_SIZE = 100;

const cache = new Map<string, string>();

function remember(run: string, out: string): void {
  cache.delete(run);
  cache.set(run, out);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

function recall(run: string): string | undefined {
  const hit = cache.get(run);
  if (hit !== undefined) {
    // renova a posição: o que é usado continua no cache
    cache.delete(run);
    cache.set(run, hit);
  }
  return hit;
}

/** Tradução já disponível no cache para o texto inteiro, ou null se algum trecho falta. */
export function cachedTranslation(text: string): string | null {
  const segs = segmentForTranslation(text);
  for (const run of translatableRuns(segs)) {
    if (!cache.has(run)) return null;
  }
  return assembleTranslation(segs, recall);
}

/** Traduz o texto (só os trechos em inglês; grego, referências e quebras de parágrafo ficam como estão). */
export async function translateText(text: string): Promise<string> {
  const segs: TextSegment[] = segmentForTranslation(text);
  const runs = translatableRuns(segs);
  const missing = runs.filter((run) => !cache.has(run));
  if (missing.length > 0) {
    const out = await translateRuns(missing);
    missing.forEach((run, i) => {
      const value = out[i];
      if (typeof value === 'string') remember(run, value);
    });
  }
  return assembleTranslation(segs, recall);
}

/**
 * Traduz de uma vez os trechos que faltam de vários textos (um pedido ao aparelho por lote de BATCH_SIZE). Só o
 * cache da memória recebe o resultado: nada é gravado no aparelho.
 */
export async function translateMany(texts: readonly string[]): Promise<void> {
  const missing = runsToTranslate(texts, (run) => cache.has(run));
  for (const part of chunked(missing, BATCH_SIZE)) {
    const out = await translateRuns(part);
    part.forEach((run, i) => {
      const value = out[i];
      if (typeof value === 'string') remember(run, value);
    });
  }
}

/** Esvazia o cache (ex.: ao remover o modelo). */
export function clearTranslationCache(): void {
  cache.clear();
}

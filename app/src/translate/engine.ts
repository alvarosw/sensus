// Tradução automática com cache só na memória: nada disto é gravado no aparelho. O cache é por par de idiomas
// (origem -> idioma do app): o mesmo trecho traduz de forma diferente para cada destino.
import {
  assembleTranslation,
  chunked,
  runsToTranslate,
  segmentForTranslation,
  translatableRuns,
  type TextSegment,
  type TranslationPair,
} from '@sensus/core';
import { translateRuns } from './native';

/** Teto de trechos guardados (cada trecho é uma frase ou um fragmento entre referências). */
const CACHE_MAX = 3000;
/** Trechos por pedido ao aparelho (um lote da linha do tempo pode ter centenas de títulos e nomes). */
const BATCH_SIZE = 100;

const cache = new Map<string, string>();

/** Identificador do par ("en>pt"): parte da chave do cache e do lote global. */
export function pairKey(pair: TranslationPair): string {
  return `${pair.from}>${pair.to}`;
}

/** Chave de um trecho no cache: o par e o trecho. */
export function cacheKey(pair: TranslationPair, run: string): string {
  return `${pairKey(pair)}\u0002${run}`;
}

function remember(key: string, out: string): void {
  cache.delete(key);
  cache.set(key, out);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

function recall(key: string): string | undefined {
  const hit = cache.get(key);
  if (hit !== undefined) {
    // renova a posição: o que é usado continua no cache
    cache.delete(key);
    cache.set(key, hit);
  }
  return hit;
}

/** Tradução já disponível no cache para o texto inteiro no par, ou null se algum trecho falta. */
export function cachedTranslation(text: string, pair: TranslationPair): string | null {
  const segs = segmentForTranslation(text);
  for (const run of translatableRuns(segs)) {
    if (!cache.has(cacheKey(pair, run))) return null;
  }
  return assembleTranslation(segs, (run) => recall(cacheKey(pair, run)));
}

/** Traduz o texto no par (só os trechos na língua de origem; grego, referências e quebras de parágrafo ficam). */
export async function translateText(text: string, pair: TranslationPair): Promise<string> {
  const segs: TextSegment[] = segmentForTranslation(text);
  const runs = translatableRuns(segs);
  const missing = runs.filter((run) => !cache.has(cacheKey(pair, run)));
  if (missing.length > 0) {
    const out = await translateRuns(missing, pair);
    missing.forEach((run, i) => {
      const value = out[i];
      if (typeof value === 'string') remember(cacheKey(pair, run), value);
    });
  }
  return assembleTranslation(segs, (run) => recall(cacheKey(pair, run)));
}

/**
 * Traduz de uma vez os trechos que faltam de vários textos no par (um pedido ao aparelho por lote de BATCH_SIZE). Só o
 * cache da memória recebe o resultado: nada é gravado no aparelho.
 */
export async function translateMany(texts: readonly string[], pair: TranslationPair): Promise<void> {
  const missing = runsToTranslate(texts, (run) => cache.has(cacheKey(pair, run)));
  for (const part of chunked(missing, BATCH_SIZE)) {
    const out = await translateRuns(part, pair);
    part.forEach((run, i) => {
      const value = out[i];
      if (typeof value === 'string') remember(cacheKey(pair, run), value);
    });
  }
}

/** Esvazia o cache (ex.: ao remover o modelo). */
export function clearTranslationCache(): void {
  cache.clear();
}

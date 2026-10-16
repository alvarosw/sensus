// Tradução em lote da linha do tempo (puro, sem RN): quais trechos faltam no cache, em lotes de tamanho fixo, e
// a busca que casa o original e a tradução já conhecida. O cache e a chamada ao aparelho ficam no app.
import { normalizeSearch } from './timeline';
import { segmentForTranslation, translatableRuns } from './translate-segments';

/**
 * Trechos em inglês de vários textos que ainda não estão no cache: únicos, na ordem de aparição.
 * `has` diz se um trecho já tem tradução. Textos sem trecho traduzível (grego, só referências) não entram.
 */
export function runsToTranslate(texts: readonly string[], has: (run: string) => boolean): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const text of texts) {
    for (const run of translatableRuns(segmentForTranslation(text))) {
      if (seen.has(run)) continue;
      seen.add(run);
      if (!has(run)) out.push(run);
    }
  }
  return out;
}

/** Divide uma lista em pedaços de no máximo `size` itens (um pedido ao aparelho por pedaço). */
export function chunked<T>(items: readonly T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

/**
 * Casa a busca com o original ou com a tradução (quando existe no cache). Sem acento e sem caixa; busca vazia casa
 * tudo.
 */
export function matchesTranslatedText(query: string, original: string, translated: string | null | undefined): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  if (normalizeSearch(original).includes(q)) return true;
  return translated != null && normalizeSearch(translated).includes(q);
}

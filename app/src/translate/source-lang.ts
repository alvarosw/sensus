// Idioma de uma fonte, para a tradução automática. Vem do registro de fontes do banco (campo lang). Bíblia baixada
// não está nesse banco: o idioma dela vem do catálogo (ver bibleRowInfo). Não há detecção por palavras: a fonte decide.
// Vem de data/ (e não de features/): a tradução é um serviço, e a camada de baixo não importa features.
import { sourceLangOf } from '@sensus/core';
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import { loadSources } from '@/data/sources';
import { bibleRowInfo } from '@/data/bibles/bible-model';
import { useBibles } from '@/data/bibles/bibles-store';

/**
 * Código de idioma da fonte (ex.: "en", "es"); null sem fonte. Ordem: o registro do banco; senão o catálogo de Bíblias
 * (Bíblias baixadas); senão o registro de fontes do domínio.
 */
export function useSourceLang(sourceId: string | null | undefined): string | null {
  const repo = useRepo();
  const sources = useAsync(() => loadSources(repo), [repo]);
  const catalog = useBibles((s) => s.catalog);
  if (!sourceId) return null;
  const registered = sources.data?.get(sourceId)?.lang;
  if (registered) return registered;
  const fromCatalog = bibleRowInfo(sourceId, catalog).lang;
  return fromCatalog || sourceLangOf(sourceId) || null;
}

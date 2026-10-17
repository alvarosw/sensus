// Idioma de uma fonte, lido do registro de fontes do banco (campo lang). Não há detecção por palavras: a fonte decide.
// Vem de data/ (e não de features/): a tradução é um serviço, e a camada de baixo não importa features.
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import { loadSources } from '@/data/sources';

/** Código de idioma da fonte (ex.: "en", "pt"); null enquanto carrega ou sem fonte. */
export function useSourceLang(sourceId: string | null | undefined): string | null {
  const repo = useRepo();
  const sources = useAsync(() => loadSources(repo), [repo]);
  if (!sourceId) return null;
  return sources.data?.get(sourceId)?.lang ?? null;
}

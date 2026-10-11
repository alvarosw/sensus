// Idioma de uma fonte, lido da tabela source (campo lang). Não há detecção por palavras: a fonte decide.
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import { loadSources } from '@/features/common/cites';

/** Código de idioma da fonte (ex.: "en", "pt"); null enquanto carrega ou sem fonte. */
export function useSourceLang(sourceId: string | null | undefined): string | null {
  const repo = useRepo();
  const sources = useAsync(() => loadSources(repo), [repo]);
  if (!sourceId) return null;
  return sources.data?.get(sourceId)?.lang ?? null;
}

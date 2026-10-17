// Filtros da busca de linhas, iguais na tela inicial e no seletor de combinações: tipo (Tudo, Períodos, Pessoas,
// Lugares), era e ★ Favoritos. Também a busca de linhas que junta o banco com as traduções já em cache.
import { useMemo } from 'react';
import { matchesTranslatedText, TIMELINE_ERAS, type TimelineLine, type TimelineSearchResult } from '@sensus/core';
import { cachedTranslation } from '@/translate/engine';
import { useTimelineActive, useTimelineVersion } from '@/translate/timeline-translate';
import type { KindFilter } from './model';
import { TL, TL_ERA_SHORT } from './strings';
import { Chip, ChipRow } from './parts';

/** Eras que entram no filtro (a lacuna não tem eventos). */
export const FILTER_ERAS = TIMELINE_ERAS.filter((e) => !e.gap);

/**
 * Linhas que casam a busca: as do banco (`hits`, a busca da cronologia) e as cuja tradução já está em cache. Sem
 * busca, vazio: a lista de todas as linhas é filtrada por quem chama.
 */
export function useLineMatches(query: string, lines: readonly TimelineLine[], hits: TimelineSearchResult | null): TimelineLine[] {
  const q = query.trim();
  const tlActive = useTimelineActive();
  const version = useTimelineVersion();
  return useMemo(() => {
    const db = hits?.lines ?? [];
    if (!q || !tlActive) return db;
    const extra = lines.filter((l) => !db.some((x) => x.id === l.id) && matchesTranslatedText(q, l.name, cachedTranslation(l.name)));
    return [...db, ...extra];
    // version: a tradução chegou ao cache; recalcula a busca por ela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hits, q, tlActive, lines, version]);
}

/** Linha de pílulas: tipo (com ★ Favoritos) e linha de eras. `prefix` separa os testIDs de cada tela. */
export function LineFilterChips({
  prefix,
  kind,
  onKind,
  eraId,
  onEra,
  onlyFav,
  onOnlyFav,
}: {
  prefix: string;
  kind: KindFilter;
  onKind: (k: KindFilter) => void;
  eraId: string;
  onEra: (id: string) => void;
  onlyFav: boolean;
  onOnlyFav: (on: boolean) => void;
}) {
  return (
    <>
      <ChipRow>
        {(
          [
            ['all', TL.kindAll],
            ['period', TL.kindPeriod],
            ['person', TL.kindPerson],
            ['place', TL.kindPlace],
          ] as const
        ).map(([k, label]) => (
          <Chip key={k} testID={`${prefix}-kind-${k}`} label={label} on={kind === k} onPress={() => onKind(k)} />
        ))}
        <Chip testID={`${prefix}-only-fav`} label={TL.onlyFavorites} on={onlyFav} star onPress={() => onOnlyFav(!onlyFav)} />
      </ChipRow>
      <ChipRow>
        <Chip testID={`${prefix}-era-all`} label={TL.eraAll} on={eraId === 'all'} onPress={() => onEra('all')} />
        {FILTER_ERAS.map((e) => (
          <Chip key={e.id} testID={`${prefix}-era-${e.id}`} label={TL_ERA_SHORT[e.id] ?? e.name} on={eraId === e.id} onPress={() => onEra(e.id)} />
        ))}
      </ChipRow>
    </>
  );
}

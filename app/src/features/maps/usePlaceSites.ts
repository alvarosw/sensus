// Lugares de um intervalo de versículos, já agrupados (ver groupPlaces em @sensus/core).
import { useMemo } from 'react';
import { groupPlaces, type PlaceSite, type VerseRange } from '@sensus/core';
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import type { MapMarker } from './SensusMap';

/** Todos os livros: usado para achar um lugar e seus homônimos fora do escopo atual. */
export const WHOLE_BIBLE: VerseRange = { start: 1001001, end: 66022021 };

export function usePlaceSites(range: VerseRange | null): { sites: PlaceSite[]; loading: boolean; error: string | undefined } {
  const repo = useRepo();
  const key = range ? `${range.start}-${range.end}` : '';
  const state = useAsync(async () => {
    if (!range) return [] as PlaceSite[];
    return groupPlaces(await repo.placesInRange(range));
  }, [repo, key]);
  return { sites: state.data ?? [], loading: state.loading, error: state.error };
}

/** Marcadores do mapa a partir dos lugares. */
export function markersOf(sites: readonly PlaceSite[]): MapMarker[] {
  return sites.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, band: s.band }));
}

export function useMarkers(sites: readonly PlaceSite[]): MapMarker[] {
  return useMemo(() => markersOf(sites), [sites]);
}

/** Intervalo do livro que contém o versículo (BBCCCVVV: livro × 1.000.000). */
export function bookRangeOf(vid: number): VerseRange {
  const base = Math.floor(vid / 1_000_000) * 1_000_000;
  return { start: base, end: base + 999_999 };
}

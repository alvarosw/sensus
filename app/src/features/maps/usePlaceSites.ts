// Lugares de um intervalo de versículos, já agrupados (ver groupPlaces em @sensus/core).
import { useMemo } from 'react';
import { bookRange, bookStartVid, groupPlaces, MAX_BOOK, splitVid, type PlaceSite, type VerseRange } from '@sensus/core';
import { useRepo } from '@/data/db-context';
import { useAsync } from '@/data/use-async';
import type { MapMarker } from './SensusMap';

/** Todos os livros: usado para achar um lugar e seus homônimos fora do escopo atual. */
export const WHOLE_BIBLE: VerseRange = { start: bookStartVid(1), end: bookRange(MAX_BOOK).end };

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

/** Intervalo do livro que contém o versículo. */
export function bookRangeOf(vid: number): VerseRange {
  return bookRange(splitVid(vid).book);
}

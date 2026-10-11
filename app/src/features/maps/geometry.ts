// Geometria e marcadores do mapa (sem código nativo: usado também na versão web).
import type { ConfidenceBand } from '@sensus/core';

/** Um marcador do mapa: um lugar, com a confiança da identificação. */
export interface MapMarker {
  id: string;
  name: string;
  lat: number;
  lon: number;
  band: ConfidenceBand;
}

const DEFAULT_VIEW = { center: [30, 35] as [number, number], zoom: 4 };

/** Enquadramento inicial: centro + zoom para um lugar, caixa com margem para vários, Mediterrâneo sem lugares. */
/** [oeste, sul, leste, norte], como o MapLibre. */
export type Bounds = [number, number, number, number];

export function viewFor(markers: readonly MapMarker[]): { center: [number, number]; zoom: number; bounds?: Bounds } {
  if (markers.length === 0) return DEFAULT_VIEW;
  if (markers.length === 1) return { center: [markers[0]!.lon, markers[0]!.lat], zoom: 8 };
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const m of markers) {
    w = Math.min(w, m.lon);
    e = Math.max(e, m.lon);
    s = Math.min(s, m.lat);
    n = Math.max(n, m.lat);
  }
  // Vão mínimo de ~2 graus: poucos lugares próximos não viram um zoom excessivo.
  const padLon = Math.max(0.6, (e - w) * 0.12);
  const padLat = Math.max(0.6, (n - s) * 0.12);
  const cx = (w + e) / 2;
  const cy = (s + n) / 2;
  const spanLon = Math.max(2, e - w + 2 * padLon);
  const spanLat = Math.max(2, n - s + 2 * padLat);
  return {
    center: [cx, cy],
    zoom: 4,
    bounds: [cx - spanLon / 2, cy - spanLat / 2, cx + spanLon / 2, cy + spanLat / 2],
  };
}

export function radiusOf(band: ConfidenceBand): { r: number; op: number; hollow: boolean } {
  switch (band) {
    case 'high':
      return { r: 6.5, op: 1, hollow: false };
    case 'mid':
      return { r: 5.5, op: 0.75, hollow: false };
    case 'low':
      return { r: 5, op: 0.45, hollow: false };
    case 'none':
      return { r: 5, op: 1, hollow: true };
  }
}


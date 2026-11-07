// RASCUNHO (vi): ainda é a cópia do inglês; traduzir. Origem: inglês de app/src/features/maps/strings.ts (mapas). As atribuições (MAP_ATTRIBUTIONS) ficam em pt, como licença.
import type { ConfidenceBand } from '@sensus/core';

export const viMaps = {
  title: 'Map',
  loading: 'Loading the map…',
  loadError: 'Could not load the map. Check your connection.',
  noPlaces: 'No places with coordinates in this passage.',
  scopeSelection: 'Selection',
  scopeUnit: 'Pericope',
  scopeBook: 'Book',
  placesCount: (n: number) => (n === 1 ? '1 place' : `${n} places`),
  passageTitle: 'Places in the passage',
  openMap: 'See on the map',
  fit: 'Fit',
  legendTitle: 'Identification confidence',
  bands: { high: 'high', mid: 'medium', low: 'low', none: 'not rated' } as Record<ConfidenceBand, string>,
  bandRange: { high: '≥ 0.8', mid: '0.5–0.8', low: '< 0.5', none: 'the source does not rate it' } as Record<
    ConfidenceBand,
    string
  >,
  confidence: 'Confidence',
  identification: 'Identification',
  coords: 'Coordinates',
  openPlace: 'Open place',
  passages: 'Passages',
  candidates: 'Other modern identifications',
  homonyms: 'Other places with this name',
  sourcesOf: 'Sources',
  selectedHint: 'Tap a marker to see the place.',
  close: 'Close',
  place: 'Place',
  placeHint: 'Tap a marker to see the place, its identification and the passages.',
};

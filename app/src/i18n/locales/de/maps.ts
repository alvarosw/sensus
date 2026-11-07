// Alemão de app/src/features/maps/strings.ts. A revisar por falante nativo.
import type { ConfidenceBand } from '@sensus/core';

export const deMaps = {
  title: 'Karte',
  loading: 'Karte wird geladen…',
  loadError: 'Die Karte konnte nicht geladen werden. Prüfe deine Verbindung.',
  noPlaces: 'Keine Orte mit Koordinaten in dieser Textstelle.',
  scopeSelection: 'Auswahl',
  scopeUnit: 'Perikope',
  scopeBook: 'Buch',
  placesCount: (n: number) => (n === 1 ? '1 Ort' : `${n} Orte`),
  passageTitle: 'Orte der Textstelle',
  openMap: 'Auf der Karte ansehen',
  fit: 'Einpassen',
  legendTitle: 'Verlässlichkeit der Identifizierung',
  bands: { high: 'hoch', mid: 'mittel', low: 'niedrig', none: 'nicht bewertet' } as Record<ConfidenceBand, string>,
  bandRange: { high: '≥ 0,8', mid: '0,5–0,8', low: '< 0,5', none: 'die Quelle bewertet es nicht' } as Record<
    ConfidenceBand,
    string
  >,
  confidence: 'Verlässlichkeit',
  identification: 'Identifizierung',
  coords: 'Koordinaten',
  openPlace: 'Ort öffnen',
  passages: 'Textstellen',
  candidates: 'Andere moderne Identifizierungen',
  homonyms: 'Andere Orte mit diesem Namen',
  sourcesOf: 'Quellen',
  selectedHint: 'Tippe auf eine Markierung, um den Ort zu sehen.',
  close: 'Schließen',
  place: 'Ort',
  placeHint: 'Tippe auf eine Markierung, um Ort, Identifizierung und Textstellen zu sehen.',
};

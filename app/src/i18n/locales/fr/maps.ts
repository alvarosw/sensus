// Français de app/src/features/maps/strings.ts. A revisar por falante nativo.
import type { ConfidenceBand } from '@sensus/core';

export const frMaps = {
  title: 'Carte',
  loading: 'Chargement de la carte…',
  loadError: 'Impossible de charger la carte. Vérifiez votre connexion.',
  noPlaces: 'Aucun lieu avec coordonnées dans ce passage.',
  scopeSelection: 'Sélection',
  scopeUnit: 'Péricope',
  scopeBook: 'Livre',
  placesCount: (n: number) => (n === 1 ? '1 lieu' : `${n} lieux`),
  passageTitle: 'Lieux du passage',
  openMap: 'Voir sur la carte',
  fit: 'Ajuster',
  legendTitle: 'Fiabilité de l’identification',
  bands: { high: 'élevée', mid: 'moyenne', low: 'faible', none: 'non évaluée' } as Record<ConfidenceBand, string>,
  bandRange: { high: '≥ 0,8', mid: '0,5–0,8', low: '< 0,5', none: 'la source ne l’évalue pas' } as Record<
    ConfidenceBand,
    string
  >,
  confidence: 'Fiabilité',
  identification: 'Identification',
  coords: 'Coordonnées',
  openPlace: 'Ouvrir le lieu',
  passages: 'Passages',
  candidates: 'Autres identifications modernes',
  homonyms: 'Autres lieux portant ce nom',
  sourcesOf: 'Sources',
  selectedHint: 'Touchez un repère pour voir le lieu.',
  close: 'Fermer',
  place: 'Lieu',
  placeHint: 'Touchez un repère pour voir le lieu, son identification et les passages.',
};

// Espanhol de app/src/features/maps/strings.ts. A revisar por falante nativo.
import type { ConfidenceBand } from '@sensus/core';

export const esMaps = {
  title: 'Mapa',
  loading: 'Cargando el mapa…',
  loadError: 'No se pudo cargar el mapa. Revisa la conexión.',
  noPlaces: 'No hay lugares con coordenadas en este pasaje.',
  scopeSelection: 'Selección',
  scopeUnit: 'Perícopa',
  scopeBook: 'Libro',
  placesCount: (n: number) => (n === 1 ? '1 lugar' : `${n} lugares`),
  passageTitle: 'Lugares del pasaje',
  openMap: 'Ver en el mapa',
  fit: 'Ajustar',
  legendTitle: 'Confianza de la identificación',
  bands: { high: 'alta', mid: 'media', low: 'baja', none: 'sin evaluar' } as Record<ConfidenceBand, string>,
  bandRange: { high: '≥ 0,8', mid: '0,5–0,8', low: '< 0,5', none: 'la fuente no lo evalúa' } as Record<
    ConfidenceBand,
    string
  >,
  confidence: 'Confianza',
  identification: 'Identificación',
  coords: 'Coordenadas',
  openPlace: 'Abrir lugar',
  passages: 'Pasajes',
  candidates: 'Otras identificaciones modernas',
  homonyms: 'Otros lugares con este nombre',
  sourcesOf: 'Fuentes',
  selectedHint: 'Toca un marcador para ver el lugar.',
  close: 'Cerrar',
  place: 'Lugar',
  placeHint: 'Toca un marcador para ver el lugar, su identificación y los pasajes.',
};

// Textos dos mapas (pt-BR). Nomes de lugares vêm do banco, em inglês, e não passam por aqui.
import type { ConfidenceBand } from '@sensus/core';
import { ATTRIBUTION } from './styles/sensus-map-style';

export const MAPS = {
  title: 'Mapa',
  attribution: ATTRIBUTION,
  loading: 'Carregando o mapa…',
  loadError: 'Não foi possível carregar o mapa. Verifique a conexão.',
  noPlaces: 'Nenhum lugar com coordenadas neste trecho.',
  scopeSelection: 'Seleção',
  scopeUnit: 'Perícope',
  scopeBook: 'Livro',
  placesCount: (n: number) => (n === 1 ? '1 lugar' : `${n} lugares`),
  passageTitle: 'Lugares do trecho',
  openMap: 'Ver no mapa',
  fit: 'Enquadrar',
  legendTitle: 'Confiança da identificação',
  bands: { high: 'alta', mid: 'média', low: 'baixa', none: 'sem avaliação' } as Record<ConfidenceBand, string>,
  bandRange: { high: '≥ 0,8', mid: '0,5–0,8', low: '< 0,5', none: 'a fonte não avalia' } as Record<ConfidenceBand, string>,
  confidence: 'Confiança',
  identification: 'Identificação',
  coords: 'Coordenadas',
  openPlace: 'Abrir lugar',
  passages: 'Passagens',
  candidates: 'Outras identificações modernas',
  homonyms: 'Outros lugares com este nome',
  sourcesOf: 'Fontes',
  selectedHint: 'Toque em um marcador para ver o lugar.',
  close: 'Fechar',
  place: 'Lugar',
  placeHint: 'Toque em um marcador para ver o lugar, a identificação e as passagens.',
} as const;

/** Atribuições dos mapas exibidas em "Sobre e licenças" (ver DATA_LICENSES.md, seção de mapas). */
export const MAP_ATTRIBUTIONS: readonly string[] = [
  '© OpenStreetMap contributors: dados de mapa, licença ODbL 1.0 (openstreetmap.org/copyright).',
  '© OpenMapTiles: vetores e esquema, licença CC BY 4.0 (openmaptiles.org).',
  'OpenFreeMap (openfreemap.org): serviço de tiles, projeto MIT, sem chave de API.',
  'maplibre-react-native: licença MIT.',
];

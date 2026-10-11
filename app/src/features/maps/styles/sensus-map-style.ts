// Estilo de mapa do Sensus (MapLibre), gerado a partir dos tokens de cor (app/src/design/tokens.ts).
// Fonte de vetores: OpenFreeMap (esquema OpenMapTiles, sem chave). Não copia o estilo de terceiros:
// as camadas são próprias, só com os nomes de camada do esquema OpenMapTiles.
// Atribuição obrigatória: ver ATTRIBUTION (mostrada em todo mapa e em "Sobre e licenças").
import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { palettes, sourceTypes, type Scheme } from '@/design/tokens';

export const OPENFREEMAP_TILES = 'https://tiles.openfreemap.org/planet';
/** Relevo sombreado (Natural Earth, domínio público), servido pelo OpenFreeMap até o zoom 6. */
export const OPENFREEMAP_RELIEF = 'https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png';
export const OPENFREEMAP_GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
/** Fontes disponíveis no OpenFreeMap (Noto Sans); a família do app não existe nos glifos do MapLibre. */
const FONT = { regular: ['Noto Sans Regular'], bold: ['Noto Sans Bold'], italic: ['Noto Sans Italic'] };
export const ATTRIBUTION = '© OpenStreetMap contributors · © OpenMapTiles · OpenFreeMap';

type Rgb = [number, number, number];

function hex(h: string): Rgb {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mistura `a` em direção a `b` (t = 0 é a, t = 1 é b). Entrada e saída em #RRGGBB. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hex(a);
  const [br, bg, bb] = hex(b);
  const f = (x: number, y: number) => Math.round(x + (y - x) * t);
  const to = (v: number) => v.toString(16).padStart(2, '0');
  return `#${to(f(ar, br))}${to(f(ag, bg))}${to(f(ab, bb))}`;
}

/** Cores do mapa derivadas da paleta do esquema (papel, água, traçados, rótulos). */
export interface MapColors {
  land: string;
  landTint: string;
  wood: string;
  water: string;
  waterLabel: string;
  road: string;
  roadMajor: string;
  boundary: string;
  text: string;
  textMuted: string;
  halo: string;
}

export function mapColors(scheme: Scheme): MapColors {
  const c = palettes[scheme];
  const st = sourceTypes[scheme];
  return {
    land: c.bg,
    landTint: c.surfaceAlt,
    wood: mix(st.dic, c.bg, 0.86),
    // Água: azul de infBorder dessaturado para o papel; harmoniza com a moldura de inferência.
    water: mix(c.infBorder, c.bg, scheme === 'light' ? 0.5 : 0.62),
    waterLabel: mix(c.infBorder, c.text, scheme === 'light' ? 0.25 : 0.1),
    road: c.border,
    roadMajor: mix(c.muted, c.bg, 0.55),
    boundary: mix(c.muted, c.bg, 0.45),
    text: c.text,
    textMuted: c.muted,
    halo: c.bg,
  };
}

/** Estilo completo (claro ou escuro). Estável por esquema: a tela memoiza o objeto. */
export function sensusMapStyle(scheme: Scheme): StyleSpecification {
  const m = mapColors(scheme);
  const name = ['coalesce', ['get', 'name:latin'], ['get', 'name']] as unknown as string;

  return {
    version: 8,
    name: `Sensus ${scheme}`,
    glyphs: OPENFREEMAP_GLYPHS,
    sources: {
      openmaptiles: { type: 'vector', url: OPENFREEMAP_TILES, attribution: ATTRIBUTION },
      relief: { type: 'raster', tiles: [OPENFREEMAP_RELIEF], tileSize: 256, maxzoom: 6 },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': m.land } },
      {
        // Relevo discreto: cinza, quase transparente; some com o zoom de detalhe.
        id: 'relief',
        type: 'raster',
        source: 'relief',
        paint: {
          'raster-saturation': -1,
          'raster-opacity': ['interpolate', ['linear'], ['zoom'], 0, scheme === 'light' ? 0.22 : 0.16, 6, 0.06],
        },
      },
      {
        id: 'landcover-wood',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['in', 'class', 'wood', 'grass', 'farmland'],
        paint: { 'fill-color': m.wood, 'fill-opacity': 0.9 },
      },
      {
        id: 'park',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'park',
        paint: { 'fill-color': m.landTint, 'fill-opacity': 0.8 },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': m.water },
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        filter: ['in', 'class', 'river', 'canal', 'stream'],
        paint: {
          'line-color': m.water,
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.3, 9, 1.2, 12, 2.4],
        },
      },
      {
        id: 'transportation-major',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        minzoom: 5,
        filter: ['in', 'class', 'motorway', 'trunk', 'primary'],
        paint: {
          'line-color': m.roadMajor,
          'line-opacity': 0.55,
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 10, 1.4, 14, 4],
        },
      },
      {
        id: 'transportation-minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        minzoom: 9,
        filter: ['in', 'class', 'secondary', 'tertiary', 'minor'],
        paint: {
          'line-color': m.road,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.4, 14, 2.5],
        },
      },
      {
        id: 'boundary-country',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['<=', 'admin_level', 2],
        paint: {
          'line-color': m.boundary,
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.6, 8, 1.2],
          'line-dasharray': [3, 2],
        },
      },
      {
        id: 'water-name',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'water_name',
        minzoom: 3,
        filter: ['in', 'class', 'sea', 'ocean', 'lake'],
        layout: {
          'text-field': name,
          'text-font': FONT.italic,
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11, 8, 14],
          'text-letter-spacing': 0.08,
          'text-max-width': 8,
        },
        paint: { 'text-color': m.waterLabel, 'text-halo-color': m.halo, 'text-halo-width': 1 },
      },
      {
        id: 'place-country',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        minzoom: 1,
        maxzoom: 7,
        filter: ['==', 'class', 'country'],
        layout: {
          'text-field': name,
          'text-font': FONT.bold,
          'text-size': ['interpolate', ['linear'], ['zoom'], 1, 9, 6, 13],
          'text-letter-spacing': 0.12,
          'text-transform': 'uppercase',
          'text-max-width': 6,
        },
        paint: { 'text-color': m.textMuted, 'text-halo-color': m.halo, 'text-halo-width': 1.4 },
      },
      {
        id: 'place-city',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        minzoom: 3,
        filter: ['all', ['==', 'class', 'city'], ['!=', 'capital', 2]],
        layout: {
          'text-field': name,
          'text-font': FONT.regular,
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11, 10, 15],
          'text-max-width': 8,
          'text-padding': 3,
        },
        paint: { 'text-color': m.text, 'text-halo-color': m.halo, 'text-halo-width': 1.4 },
      },
      {
        id: 'place-town',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        minzoom: 6,
        filter: ['in', 'class', 'town', 'village'],
        layout: {
          'text-field': name,
          'text-font': FONT.regular,
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 12, 13],
          'text-max-width': 7,
          'text-padding': 2,
        },
        paint: { 'text-color': m.textMuted, 'text-halo-color': m.halo, 'text-halo-width': 1.2 },
      },
    ],
  };
}

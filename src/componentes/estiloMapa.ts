import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { colores } from '@/tema/tokens';

export type TipoMapa = 'calles' | 'relieve';

const AGUA = '#BCCBF5';
const VERDE = '#DCEBDD';
const EDIFICIO = '#E9EBF0';
const CALLE = '#FFFFFF';
const VIA_PRINCIPAL = '#C9D1FF';
const LETRA = ['Noto Sans Regular'];
const LETRA_FUERTE = ['Noto Sans Bold'];
const NOMBRE = ['coalesce', ['get', 'name:es'], ['get', 'name']];
const HALO = { 'text-halo-color': colores.superficie, 'text-halo-width': 1.5 };

const ES_PRINCIPAL = [
  'match',
  ['get', 'class'],
  ['motorway', 'trunk', 'primary'],
  true,
  false,
];
/** Ancho de una vía según su clase, creciendo con el zoom. `extra` lo engrosa para el borde. */
const anchoVia = (extra: number) => [
  'interpolate',
  ['linear'],
  ['zoom'],
  10,
  [
    'match',
    ['get', 'class'],
    ['motorway', 'trunk', 'primary'],
    1.5 + extra,
    0.5,
  ],
  16,
  [
    'match',
    ['get', 'class'],
    ['motorway', 'trunk', 'primary'],
    10 + extra,
    ['secondary', 'tertiary'],
    8 + extra,
    ['minor', 'service'],
    5 + extra,
    2,
  ],
];

const CAPAS = [
  {
    id: 'fondo',
    type: 'background',
    paint: { 'background-color': colores.fondoSutil },
  },
  {
    id: 'verde',
    type: 'fill',
    source: 'calles',
    'source-layer': 'park',
    paint: { 'fill-color': VERDE },
  },
  {
    id: 'vegetacion',
    type: 'fill',
    source: 'calles',
    'source-layer': 'landcover',
    filter: ['match', ['get', 'class'], ['wood', 'grass'], true, false],
    paint: { 'fill-color': VERDE, 'fill-opacity': 0.6 },
  },
  {
    id: 'agua',
    type: 'fill',
    source: 'calles',
    'source-layer': 'water',
    paint: { 'fill-color': AGUA },
  },
  {
    id: 'rio',
    type: 'line',
    source: 'calles',
    'source-layer': 'waterway',
    paint: { 'line-color': AGUA, 'line-width': 1.5 },
  },
  {
    id: 'edificios',
    type: 'fill',
    source: 'calles',
    'source-layer': 'building',
    minzoom: 14,
    paint: { 'fill-color': EDIFICIO, 'fill-outline-color': colores.borde },
  },
  {
    id: 'vias-borde',
    type: 'line',
    source: 'calles',
    'source-layer': 'transportation',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': colores.borde, 'line-width': anchoVia(1.5) },
  },
  {
    id: 'vias',
    type: 'line',
    source: 'calles',
    'source-layer': 'transportation',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['case', ES_PRINCIPAL, VIA_PRINCIPAL, CALLE],
      'line-width': anchoVia(0),
    },
  },
  {
    id: 'nombres-vias',
    type: 'symbol',
    source: 'calles',
    'source-layer': 'transportation_name',
    minzoom: 13,
    layout: {
      'symbol-placement': 'line',
      'text-field': NOMBRE,
      'text-font': LETRA,
      'text-size': 12,
    },
    paint: { 'text-color': colores.textoSecundario, ...HALO },
  },
  {
    id: 'lugares-interes',
    type: 'symbol',
    source: 'calles',
    'source-layer': 'poi',
    minzoom: 15,
    filter: ['<=', ['get', 'rank'], 15],
    layout: { 'text-field': NOMBRE, 'text-font': LETRA, 'text-size': 11 },
    paint: { 'text-color': colores.primarioTexto, ...HALO },
  },
  {
    id: 'ciudades',
    type: 'symbol',
    source: 'calles',
    'source-layer': 'place',
    layout: {
      'text-field': NOMBRE,
      'text-font': LETRA_FUERTE,
      'text-size': 14,
    },
    paint: { 'text-color': colores.texto, ...HALO },
  },
];

const FUENTES = {
  calles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
};

const base = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
};

/** Colores de `tokens.ts` sobre datos de OpenStreetMap. El relieve sombrea la misma base. */
export const ESTILOS = {
  calles: { ...base, sources: FUENTES, layers: CAPAS },
  relieve: {
    ...base,
    sources: {
      ...FUENTES,
      relieve: {
        type: 'raster-dem',
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 15,
        tiles: [
          'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
        ],
      },
    },
    layers: [
      ...CAPAS.slice(0, 5),
      {
        id: 'sombreado',
        type: 'hillshade',
        source: 'relieve',
        paint: {
          'hillshade-shadow-color': colores.marcaProfundo,
          'hillshade-exaggeration': 0.5,
        },
      },
      ...CAPAS.slice(5),
    ],
  },
} as unknown as Record<TipoMapa, StyleSpecification>;

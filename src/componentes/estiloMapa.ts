import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { colores } from '@/tema/tokens';

export type TipoMapa = 'calles' | 'relieve';

// Paleta del mapa: tierra casi blanca con un velo índigo, parques y agua suaves, vías principales cálidas
// (como Google o Apple Maps) para que el trayecto de la marca sea lo que más resalta.
const TIERRA = '#F4F5FB';
const AGUA = '#BFD4F8';
const VERDE = '#D6EBD9';
const EDIFICIO = '#E7E9F2';
const EDIFICIO_BORDE = '#D9DCEA';
const CALLE = '#FFFFFF';
const CALLE_BORDE = '#DCDFEC';
const VIA_PRINCIPAL = '#FFE3A6';
const VIA_PRINCIPAL_BORDE = '#F0C46A';
const CAMPUS = '#E4E8FF';
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
    paint: { 'background-color': TIERRA },
  },
  {
    id: 'campus',
    type: 'fill',
    source: 'calles',
    'source-layer': 'landuse',
    filter: [
      'match',
      ['get', 'class'],
      ['school', 'university', 'college', 'hospital'],
      true,
      false,
    ],
    paint: { 'fill-color': CAMPUS },
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
    paint: {
      'fill-color': EDIFICIO,
      'fill-outline-color': EDIFICIO_BORDE,
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, 1],
    },
  },
  {
    id: 'vias-borde',
    type: 'line',
    source: 'calles',
    'source-layer': 'transportation',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['case', ES_PRINCIPAL, VIA_PRINCIPAL_BORDE, CALLE_BORDE],
      'line-width': anchoVia(1.5),
    },
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
    id: 'nombres-agua',
    type: 'symbol',
    source: 'calles',
    'source-layer': 'water_name',
    layout: {
      'text-field': NOMBRE,
      'text-font': LETRA,
      'text-size': 12,
      'text-letter-spacing': 0.1,
    },
    paint: { 'text-color': '#5B7FC7', ...HALO },
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
    filter: ['<=', ['get', 'rank'], 20],
    layout: { 'text-field': NOMBRE, 'text-font': LETRA, 'text-size': 11 },
    paint: { 'text-color': colores.primarioTexto, ...HALO },
  },
  {
    id: 'barrios',
    type: 'symbol',
    source: 'calles',
    'source-layer': 'place',
    minzoom: 12.5,
    filter: [
      'match',
      ['get', 'class'],
      ['suburb', 'neighbourhood', 'quarter'],
      true,
      false,
    ],
    layout: {
      'text-field': NOMBRE,
      'text-font': LETRA,
      'text-size': 12,
      'text-transform': 'uppercase',
      'text-letter-spacing': 0.12,
    },
    paint: { 'text-color': colores.textoPlaceholder, ...HALO },
  },
  {
    id: 'ciudades',
    type: 'symbol',
    source: 'calles',
    'source-layer': 'place',
    filter: [
      'match',
      ['get', 'class'],
      ['suburb', 'neighbourhood', 'quarter'],
      false,
      true,
    ],
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

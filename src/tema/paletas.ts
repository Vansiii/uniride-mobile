import { colores as claro } from './tokens';

/** Los mismos nombres de `colores`, con valores de texto: cada paleta los reemplaza por completo. */
export type Paleta = { [K in keyof typeof claro]: string };

/** DESIGN_SYSTEM.md §4.1.1, columna «Oscuro» (HU-31 RN-3). Las zonas de marca no cambian: son identidad. */
const oscuro: Paleta = {
  ...claro,
  fondo: '#0F1218',
  fondoSutil: '#14171E',
  superficie: '#181C24',
  borde: '#2C323D',
  bordeCampo: '#6F788A',
  texto: '#E7EAF0',
  textoSecundario: '#A3ABBA',
  textoPlaceholder: '#8E97A8',
  textoDeshabilitado: '#5B6475',
  fondoDeshabilitado: '#232833',
  primario: '#8B9BFF',
  primarioPresionado: '#A9B5FF',
  sobrePrimario: '#0F1218',
  primarioSuave: '#232A55',
  primarioTexto: '#C9D1FF',
  exito: '#4ADE80',
  exitoSuave: '#12301F',
  exitoTexto: '#B7F5CC',
  aviso: '#FBBF24',
  avisoSuave: '#33260A',
  avisoTexto: '#FDE7B0',
  peligro: '#FF8A80',
  peligroSuave: '#3A1512',
  peligroTexto: '#FFD3CE',
  acentoSuave: '#33260A',
};

/** Texto en negro o blanco puro y bordes visibles: contraste ≥ 7:1 (AAA) en los pares de texto y de control (CA-5). */
const altoContrasteClaro: Paleta = {
  ...claro,
  fondoSutil: '#F3F4FB',
  borde: '#595959',
  bordeCampo: '#000000',
  texto: '#000000',
  textoSecundario: '#1A1A1A',
  textoPlaceholder: '#4A4A4A',
  textoDeshabilitado: '#595959',
  primario: '#1F2E99',
  primarioPresionado: '#141F6B',
  primarioTexto: '#141F6B',
  exito: '#0B5A28',
  exitoTexto: '#083D1B',
  aviso: '#6B3F00',
  avisoTexto: '#4A2B00',
  peligro: '#8F1A10',
  peligroTexto: '#6B120B',
};

const altoContrasteOscuro: Paleta = {
  ...oscuro,
  fondo: '#000000',
  fondoSutil: '#0A0A0A',
  superficie: '#000000',
  borde: '#BFBFBF',
  bordeCampo: '#FFFFFF',
  texto: '#FFFFFF',
  textoSecundario: '#F2F2F2',
  textoPlaceholder: '#CFCFCF',
  textoDeshabilitado: '#A0A0A0',
  primario: '#B8C2FF',
  primarioPresionado: '#D3D9FF',
  sobrePrimario: '#000000',
  primarioTexto: '#FFFFFF',
  exito: '#7CF0A6',
  exitoTexto: '#FFFFFF',
  aviso: '#FFD25A',
  avisoTexto: '#FFFFFF',
  peligro: '#FFB4AB',
  peligroTexto: '#FFFFFF',
};

export const paletas = {
  claro,
  oscuro,
  altoContrasteClaro,
  altoContrasteOscuro,
} as const;

export type Esquema = 'claro' | 'oscuro';

export const elegirPaleta = (
  esquema: Esquema,
  altoContraste: boolean,
): Paleta =>
  altoContraste
    ? paletas[
        esquema === 'oscuro' ? 'altoContrasteOscuro' : 'altoContrasteClaro'
      ]
    : paletas[esquema];

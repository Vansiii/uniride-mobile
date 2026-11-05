// Tokens de DESIGN_SYSTEM.md §4 (fuente de verdad; se mantienen iguales a web/src/estilos/tokens.css).
// Solo tema claro hasta HU-31.
export const colores = {
  fondo: '#FFFFFF',
  fondoSutil: '#F6F7F9',
  superficie: '#FFFFFF',
  borde: '#DDE1E8',
  bordeCampo: '#7A8396',
  texto: '#1A1F27',
  textoSecundario: '#535B6C',
  textoPlaceholder: '#6B7385',
  textoDeshabilitado: '#8F98A8',
  fondoDeshabilitado: '#EEF0F4',
  primario: '#3447CC',
  primarioPresionado: '#2A39A6',
  sobrePrimario: '#FFFFFF',
  primarioSuave: '#EEF1FF',
  primarioTexto: '#2A39A6',
  exito: '#15803D',
  exitoSuave: '#E9F7EE',
  exitoTexto: '#166534',
  aviso: '#B26B00',
  avisoSuave: '#FFF4DB',
  avisoTexto: '#8A5300',
  peligro: '#B42318',
  peligroSuave: '#FDECEA',
  peligroTexto: '#912018',
  // Zonas de marca (3.5): iguales en los dos temas.
  marcaProfundo: '#1D2763',
  sobreMarca: '#FFFFFF',
  sobreMarcaSecundario: '#C9D1FF',
  marcaBrillante: '#8B9BFF',
  marcaVelo: 'rgba(255,255,255,0.14)',
} as const;

/** Fondo de la banda de marca (4.1.1). `colores.primario` queda como respaldo si el degradado no se dibuja. */
export const degradadoMarca =
  'linear-gradient(160deg, #3447CC 0%, #1D2763 100%)';

/** `espacio[n]` = n × 4 (4.3). */
export const espacio = (n: number) => n * 4;

export const radio = { s: 8, m: 12, l: 16, xl: 24, completo: 999 } as const;

export const tamano = { altoControl: 48, tactilMinimo: 48 } as const;

/** Duraciones en ms (4.7); pasan a 0 si el sistema pide reducir el movimiento. */
export const duracion = { corta: 100, media: 200, larga: 300 } as const;

export const tipografia = {
  pantalla: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
  titulo: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  subtitulo: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  cuerpo: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  cuerpoEnfasis: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  secundario: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  etiqueta: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  pequeno: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;

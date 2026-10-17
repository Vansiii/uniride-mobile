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
  avisoSuave: '#FFF4DB',
  avisoTexto: '#8A5300',
  peligro: '#B42318',
  peligroSuave: '#FDECEA',
  peligroTexto: '#912018',
} as const;

/** `espacio[n]` = n × 4 (4.3). */
export const espacio = (n: number) => n * 4;

export const radio = { s: 8, m: 12, l: 16, completo: 999 } as const;

export const tamano = { altoControl: 48 } as const;

export const tipografia = {
  titulo: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  cuerpo: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  cuerpoEnfasis: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  secundario: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  etiqueta: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
} as const;

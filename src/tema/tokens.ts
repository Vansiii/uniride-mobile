// Tokens de DESIGN_SYSTEM.md §4 (fuente de verdad; se mantienen iguales a web/src/estilos/tokens.css).
// Solo tema claro hasta HU-31.
export const colores = {
  fondo: '#FFFFFF',
  fondoSutil: '#F3F4FB',
  superficie: '#FFFFFF',
  borde: '#E6E8F2',
  bordeCampo: '#7A8396',
  texto: '#0F1729',
  textoSecundario: '#475467',
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
  // Zonas de marca: iguales en los dos temas.
  marcaProfundo: '#1D2763',
  sobreMarca: '#FFFFFF',
  sobreMarcaSecundario: '#C9D1FF',
  marcaBrillante: '#8B9BFF',
  marcaVelo: 'rgba(255,255,255,0.14)',
  /** Acento cálido, solo para destacar (cupos, avisos, cifras). */
  acento: '#FFB020',
  acentoSuave: '#FFF3D6',
  vidrio: 'rgba(255,255,255,0.16)',
  vidrioBorde: 'rgba(255,255,255,0.28)',
} as const;

/** Fondo de la banda de marca. `colores.primario` queda como respaldo si el degradado no se dibuja. */
export const degradadoMarca =
  'linear-gradient(155deg, #4B5CE6 0%, #3447CC 38%, #1D2763 100%)';

/** Botón primario con profundidad. */
export const degradadoBoton =
  'linear-gradient(135deg, #4F62EA 0%, #3447CC 55%, #2A39A6 100%)';

/** Tarjeta de saldo / destacada. */
export const degradadoSaldo =
  'linear-gradient(135deg, #4B5CE6 0%, #3447CC 50%, #1D2763 100%)';

/** `espacio[n]` = n × 4 (4.3). */
export const espacio = (n: number) => n * 4;

export const radio = { s: 10, m: 14, l: 20, xl: 28, completo: 999 } as const;

/** Sombra de tarjeta: difusa y teñida de índigo, para separar la superficie del fondo sin bordes duros. */
export const sombraTarjeta = {
  shadowColor: '#1D2763',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 5 },
  elevation: 3,
} as const;

/** Tarjeta que flota sobre la banda de marca o sobre el contenido. */
export const sombraElevada = {
  shadowColor: '#1D2763',
  shadowOpacity: 0.18,
  shadowRadius: 26,
  shadowOffset: { width: 0, height: 12 },
  elevation: 10,
} as const;

/** Resorte común de toda la interfaz: rápido, con un rebote mínimo. */
export const resorte = { damping: 16, stiffness: 240, mass: 0.7 } as const;

export const tamano = {
  altoControl: 56,
  tactilMinimo: 48,
  /** Barra de pestañas (6.1): 64 + el área segura inferior. */
  altoBarraPestanas: 72,
} as const;

/** Duraciones en ms (4.7); pasan a 0 si el sistema pide reducir el movimiento. */
export const duracion = { corta: 100, media: 200, larga: 300 } as const;

export const tipografia = {
  pantalla: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  titulo: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitulo: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cuerpo: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  cuerpoEnfasis: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  secundario: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  etiqueta: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  pequeno: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  cifra: { fontSize: 42, lineHeight: 48, fontWeight: '800', letterSpacing: -1 },
} as const;

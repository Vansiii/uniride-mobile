import { paletas, type Paleta } from './paletas';

/** Luminancia relativa y razón de contraste de WCAG 2.2. */
const canal = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminancia = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * canal((n >> 16) & 255) +
    0.7152 * canal((n >> 8) & 255) +
    0.0722 * canal(n & 255)
  );
};
export const razon = (a: string, b: string) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Pares texto/fondo que la app usa de verdad (DESIGN_SYSTEM.md §4.1). */
const TEXTOS: [keyof Paleta, keyof Paleta][] = [
  ['texto', 'fondo'],
  ['texto', 'superficie'],
  ['texto', 'fondoSutil'],
  ['textoSecundario', 'fondo'],
  ['textoSecundario', 'fondoSutil'],
  ['textoPlaceholder', 'superficie'],
  ['primario', 'fondo'],
  ['sobrePrimario', 'primario'],
  ['primarioTexto', 'primarioSuave'],
  ['exito', 'fondo'],
  ['exitoTexto', 'exitoSuave'],
  ['avisoTexto', 'avisoSuave'],
  ['avisoTexto', 'fondo'],
  ['peligro', 'fondo'],
  ['peligroTexto', 'peligroSuave'],
];
/** Íconos y bordes de controles: 3:1 (WCAG 1.4.11). `aviso` es solo ícono. */
const CONTROLES: [keyof Paleta, keyof Paleta][] = [
  ['bordeCampo', 'fondo'],
  ['bordeCampo', 'superficie'],
  ['aviso', 'fondo'],
];

describe('HU-31 CA-5, CA-7 · contraste de las paletas', () => {
  it.each([
    ['oscuro', paletas.oscuro, 4.5, 3],
    ['alto contraste claro', paletas.altoContrasteClaro, 7, 7],
    ['alto contraste oscuro', paletas.altoContrasteOscuro, 7, 7],
  ] as const)('%s', (_nombre, paleta, texto, control) => {
    for (const [t, f] of TEXTOS)
      expect({
        par: `${t}/${f}`,
        ok: razon(paleta[t], paleta[f]) >= texto,
      }).toEqual({
        par: `${t}/${f}`,
        ok: true,
      });
    for (const [t, f] of CONTROLES)
      expect({
        par: `${t}/${f}`,
        ok: razon(paleta[t], paleta[f]) >= control,
      }).toEqual({
        par: `${t}/${f}`,
        ok: true,
      });
  });

  it('el calculador coincide con los valores del sistema de diseño (negro sobre blanco = 21:1)', () => {
    expect(razon('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(razon('#E7EAF0', '#0F1218')).toBeGreaterThan(14);
  });
});

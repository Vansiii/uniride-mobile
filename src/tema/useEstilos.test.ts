import { leerApariencia, APARIENCIA_INICIAL } from './ProveedorTema';
import { escalar } from './useEstilos';

describe('HU-31 CA-4 · escala de texto', () => {
  const base = {
    titulo: { fontSize: 20, lineHeight: 28, color: '#000' },
    caja: { padding: 8 },
  };

  it('Grande ×1,15 y Muy grande ×1,3 sobre fontSize y lineHeight; lo demás no cambia', () => {
    expect(escalar(base, 1.15).titulo).toEqual({
      fontSize: 23,
      lineHeight: 32,
      color: '#000',
    });
    expect(escalar(base, 1.3).titulo).toEqual({
      fontSize: 26,
      lineHeight: 36,
      color: '#000',
    });
    expect(escalar(base, 1.3).caja).toEqual({ padding: 8 });
  });

  it('con escala 1 devuelve los estilos tal cual', () => {
    expect(escalar(base, 1)).toBe(base);
  });
});

describe('HU-31 CA-10 · dato guardado inválido', () => {
  it('lo válido se conserva', () => {
    expect(
      leerApariencia(
        JSON.stringify({
          tema: 'oscuro',
          texto: 'grande',
          altoContraste: true,
        }),
      ),
    ).toEqual({ tema: 'oscuro', texto: 'grande', altoContraste: true });
  });

  it.each([null, '', 'no-es-json', '[]', '{"tema":"rosado","texto":9}'])(
    'cae a Automático / Normal / sin alto contraste: %p',
    (crudo) => {
      expect(leerApariencia(crudo)).toEqual(APARIENCIA_INICIAL);
    },
  );

  it('cada campo se valida por separado', () => {
    expect(leerApariencia('{"tema":"claro","texto":"enorme"}')).toEqual({
      tema: 'claro',
      texto: 'normal',
      altoContraste: false,
    });
  });
});

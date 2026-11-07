import { formatearMonto } from '@/formato';

describe('formatearMonto (es-BO, sobre el texto)', () => {
  it.each([
    ['37.51', '37,51'],
    ['5.50', '5,50'],
    ['0.00', '0,00'],
    ['1234.50', '1.234,50'],
    ['1234567.89', '1.234.567,89'],
    ['999.99', '999,99'],
  ])('%s → %s', (api, esperado) => {
    expect(formatearMonto(api)).toBe(esperado);
  });

  it('un valor mayor que Number.MAX_SAFE_INTEGER no pierde cifras', () => {
    const api = '12345678901234567890123.45';
    expect(Number(api)).toBeGreaterThan(Number.MAX_SAFE_INTEGER);
    expect(formatearMonto(api)).toBe('12.345.678.901.234.567.890.123,45');
  });

  it('completa los decimales que falten y no redondea los que sobren', () => {
    expect(formatearMonto('7')).toBe('7,00');
    expect(formatearMonto('7.5')).toBe('7,50');
    expect(formatearMonto('12.349')).toBe('12,34');
  });

  it('un texto que no es un decimal simple se devuelve igual', () => {
    expect(formatearMonto('abc')).toBe('abc');
    expect(formatearMonto('1e21')).toBe('1e21');
  });
});

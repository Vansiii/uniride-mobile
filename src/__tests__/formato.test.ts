import {
  claveDia,
  formatearDia,
  formatearHoraLocal,
  formatearMonto,
} from '@/formato';

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

// Las fechas se arman en la hora local del equipo de pruebas: el resultado no depende de su zona horaria.
describe('fechas del historial', () => {
  const iso = (a: number, m: number, d: number, h = 12, min = 0) =>
    new Date(a, m - 1, d, h, min).toISOString();

  it('el día de hoy se llama Hoy; otro día, día abreviado, número y mes', () => {
    const ahora = new Date(2026, 10, 6, 21, 30);
    expect(formatearDia(iso(2026, 11, 6, 0, 5), ahora)).toBe('Hoy');
    expect(formatearDia(iso(2026, 11, 6, 23, 59), ahora)).toBe('Hoy');
    expect(formatearDia(iso(2026, 10, 21, 7, 5), ahora)).toBe('mié 21 oct');
    expect(formatearDia(iso(2026, 11, 5), ahora)).toBe('jue 5 nov');
    expect(formatearDia(iso(2025, 12, 31), ahora)).toBe('mié 31 dic');
  });

  it('la hora va en 24 h con dos dígitos', () => {
    expect(formatearHoraLocal(iso(2026, 10, 21, 7, 5))).toBe('07:05');
    expect(formatearHoraLocal(iso(2026, 10, 21, 19, 40))).toBe('19:40');
    expect(formatearHoraLocal(iso(2026, 10, 21, 0, 0))).toBe('00:00');
  });

  it('dos horas del mismo día local comparten clave y la medianoche separa los días', () => {
    expect(claveDia(iso(2026, 11, 6, 0, 1))).toBe(
      claveDia(iso(2026, 11, 6, 23, 59)),
    );
    expect(claveDia(iso(2026, 11, 6, 23, 59))).not.toBe(
      claveDia(iso(2026, 11, 7, 0, 0)),
    );
    expect(claveDia(iso(2026, 1, 5))).toBe('2026-01-05');
  });
});

describe('formatearHora (reintentar)', () => {
  const { formatearHora } = jest.requireActual('@/i18n');
  const ahora = new Date(2026, 10, 10, 18, 24);
  it('hoy: solo la hora', () => {
    expect(
      formatearHora(new Date(2026, 10, 10, 18, 39).toISOString(), ahora),
    ).toBe('18:39');
  });
  it('otro día (bloqueo de 24 h): la hora con el día, para que no parezca vencido', () => {
    expect(
      formatearHora(new Date(2026, 10, 11, 18, 24).toISOString(), ahora),
    ).toBe('18:24 del 11/11');
  });
});

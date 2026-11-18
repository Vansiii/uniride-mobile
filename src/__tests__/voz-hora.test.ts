import { resolverHora } from '../voz/hora';

describe('HU-27 RN-4 · resolverHora (pure function)', () => {
  it('a las 06:00, "a las 7" resuelve a hoy 07:00', () => {
    const ahora = new Date('2026-11-16T06:00:00');
    const r = resolverHora(7, 0, undefined, undefined, ahora);
    expect(r.getFullYear()).toBe(2026);
    expect(r.getMonth()).toBe(10);
    expect(r.getDate()).toBe(16);
    expect(r.getHours()).toBe(7);
    expect(r.getMinutes()).toBe(0);
  });

  it('a las 10:00, "a las 7" resuelve a hoy 19:00 (próxima ocurrencia >= ahora - 30 min)', () => {
    const ahora = new Date('2026-11-16T10:00:00');
    const r = resolverHora(7, 0, undefined, undefined, ahora);
    expect(r.getDate()).toBe(16);
    expect(r.getHours()).toBe(19);
    expect(r.getMinutes()).toBe(0);
  });

  it('a las 20:00, "a las 7" resuelve a mañana 07:00', () => {
    const ahora = new Date('2026-11-16T20:00:00');
    const r = resolverHora(7, 0, undefined, undefined, ahora);
    expect(r.getDate()).toBe(17);
    expect(r.getHours()).toBe(7);
    expect(r.getMinutes()).toBe(0);
  });

  it('a las 07:25, "a las 7" resuelve a hoy 07:00 (entra dentro de los 30 min de margen)', () => {
    const ahora = new Date('2026-11-16T07:25:00');
    const r = resolverHora(7, 0, undefined, undefined, ahora);
    expect(r.getDate()).toBe(16);
    expect(r.getHours()).toBe(7);
  });

  it('con "y media" (7:30)', () => {
    const ahora = new Date('2026-11-16T10:00:00');
    const r = resolverHora(7, 30, undefined, undefined, ahora);
    expect(r.getDate()).toBe(16);
    expect(r.getHours()).toBe(19);
    expect(r.getMinutes()).toBe(30);
  });

  it('formato 24h explícito: 19:00', () => {
    const ahora = new Date('2026-11-16T10:00:00');
    const r = resolverHora(19, 0, undefined, undefined, ahora);
    expect(r.getDate()).toBe(16);
    expect(r.getHours()).toBe(19);
  });

  it('con franja explícita: "7 de la mañana" a las 10:00 resuelve a mañana 07:00', () => {
    const ahora = new Date('2026-11-16T10:00:00');
    const r = resolverHora(7, 0, 'manana', undefined, ahora);
    expect(r.getDate()).toBe(17);
    expect(r.getHours()).toBe(7);
  });

  it('con franja "tarde" o "noche": 7 de la noche', () => {
    const ahora = new Date('2026-11-16T10:00:00');
    const r = resolverHora(7, 0, 'noche', undefined, ahora);
    expect(r.getDate()).toBe(16);
    expect(r.getHours()).toBe(19);
  });

  it('con día explícito "mañana": mañana a las 7 de la mañana', () => {
    const ahora = new Date('2026-11-16T06:00:00');
    const r = resolverHora(7, 0, 'manana', 'manana', ahora);
    expect(r.getDate()).toBe(17);
    expect(r.getHours()).toBe(7);
  });

  it('con día explícito "hoy" y franja ya pasada toma la tarde si aplica', () => {
    const ahora = new Date('2026-11-16T10:00:00');
    const r = resolverHora(7, 0, undefined, 'hoy', ahora);
    expect(r.getDate()).toBe(16);
    expect(r.getHours()).toBe(19);
  });
});

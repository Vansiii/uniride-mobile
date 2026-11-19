import { buscarRuta, resumenRuta } from '@/servicios/rutas';

const A = { lat: -17.78, lng: -63.18 };
const B = { lat: -17.775, lng: -63.195 };

const responder = (cuerpo: unknown, ok = true) =>
  jest.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => cuerpo,
  }));

describe('Ruta por las calles (OSRM)', () => {
  it('sigue las calles, toca los pines exactos y trae distancia y duración', async () => {
    const fetch = responder({
      code: 'Ok',
      routes: [
        {
          geometry: {
            coordinates: [
              [-63.1801, -17.7801],
              [-63.19, -17.779],
              [-63.1949, -17.7751],
            ],
          },
          distance: 2140,
          duration: 330,
        },
      ],
    });
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
    const ruta = await buscarRuta(A, B);
    expect(ruta?.coordenadas[0]).toEqual([A.lng, A.lat]);
    expect(ruta?.coordenadas.at(-1)).toEqual([B.lng, B.lat]);
    expect(ruta?.coordenadas).toHaveLength(5);
    // Solo salen las coordenadas: ni sesión ni datos de la persona.
    const [url] = fetch.mock.calls[0] as unknown as [string];
    expect(url).toContain('/route/v1/driving/-63.18,-17.78;-63.195,-17.775');
    // El mismo par se pide una sola vez.
    await buscarRuta(A, B);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('sin camino o sin red devuelve null y no guarda el fallo', async () => {
    const C = { lat: -16.5, lng: -68.15 };
    globalThis.fetch = responder({ code: 'NoRoute', routes: [] }) as never;
    expect(await buscarRuta(A, C)).toBeNull();
    const sinRed = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    globalThis.fetch = sinRed as never;
    expect(await buscarRuta(A, C)).toBeNull();
    expect(sinRed).toHaveBeenCalledTimes(1);
  });

  it('resume como lo diría una persona', () => {
    const r = (distanciaM: number, duracionS: number) =>
      resumenRuta({ coordenadas: [], distanciaM, duracionS });
    expect(r(2140, 330)).toBe('6 min · 2,1 km');
    expect(r(480, 20)).toBe('1 min · 480 m');
    expect(r(95_000, 4500)).toBe('1 h 15 min · 95,0 km');
  });
});

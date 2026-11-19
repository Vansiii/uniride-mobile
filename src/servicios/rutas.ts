import { useEffect, useState } from 'react';

const URL_OSRM = 'https://router.project-osrm.org/route/v1/driving';
const ESPERA_MS = 8000;

type Punto = { lat: number; lng: number };

export interface RutaCalles {
  /** `[lng, lat]` por las calles de OpenStreetMap, de origen a destino. */
  coordenadas: [number, number][];
  distanciaM: number;
  duracionS: number;
}

// Origen y destino de un viaje no cambian: se pide una vez por par y lo comparten el recuadro y el mapa completo.
const cache = new Map<string, Promise<RutaCalles | null>>();

const clave = (a: Punto, b: Punto) =>
  [a.lng, a.lat, b.lng, b.lat].map((n) => n.toFixed(5)).join(',');

/**
 * Trayecto en auto por las calles (OSRM sobre datos de OpenStreetMap). Solo salen las coordenadas, nunca la sesión.
 * Devuelve `null` si falla la red o no hay camino: el mapa dibuja entonces la línea aproximada.
 * ponytail: servidor público de demostración de OSRM; uno propio si el uso real supera su política de uso.
 */
export function buscarRuta(a: Punto, b: Punto): Promise<RutaCalles | null> {
  const k = clave(a, b);
  const enCache = cache.get(k);
  if (enCache !== undefined) return enCache;
  const pedido = (async (): Promise<RutaCalles | null> => {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), ESPERA_MS);
    try {
      const respuesta = await fetch(
        `${URL_OSRM}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`,
        {
          headers: { 'User-Agent': 'UniRide/0.1 (app movil)' },
          signal: control.signal,
        },
      );
      if (!respuesta.ok) return null;
      const datos: {
        code?: string;
        routes?: {
          geometry?: { coordinates?: [number, number][] };
          distance?: number;
          duration?: number;
        }[];
      } = await respuesta.json();
      const ruta = datos.routes?.[0];
      const coordenadas = ruta?.geometry?.coordinates;
      if (datos.code !== 'Ok' || !coordenadas || coordenadas.length < 2)
        return null;
      return {
        // Que la línea toque los pines exactos: OSRM la ajusta a la calle más cercana.
        coordenadas: [[a.lng, a.lat], ...coordenadas, [b.lng, b.lat]],
        distanciaM: ruta.distance ?? 0,
        duracionS: ruta.duration ?? 0,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(reloj);
    }
  })();
  cache.set(k, pedido);
  // Un fallo no queda guardado: la próxima vez que se abra el mapa se vuelve a intentar.
  void pedido.then((r) => {
    if (!r) cache.delete(k);
  });
  return pedido;
}

/** `undefined` mientras se pide, `null` si no hay ruta por calles. */
export function useRutaCalles(a: Punto, b: Punto) {
  const k = clave(a, b);
  const [estado, setEstado] = useState<{
    k: string;
    ruta: RutaCalles | null | undefined;
  }>({ k, ruta: undefined });
  // Depende de los cuatro números y no de los objetos: uno nuevo con las mismas coordenadas no repite el pedido.
  const { lat: aLat, lng: aLng } = a;
  const { lat: bLat, lng: bLng } = b;
  useEffect(() => {
    let vigente = true;
    void buscarRuta({ lat: aLat, lng: aLng }, { lat: bLat, lng: bLng }).then(
      (ruta) => {
        if (vigente)
          setEstado({
            k: clave({ lat: aLat, lng: aLng }, { lat: bLat, lng: bLng }),
            ruta,
          });
      },
    );
    return () => {
      vigente = false;
    };
  }, [aLat, aLng, bLat, bLng]);
  return estado.k === k ? estado.ruta : undefined;
}

/** «12 min · 5,4 km», redondeado como lo diría una persona. */
export function resumenRuta({ distanciaM, duracionS }: RutaCalles) {
  const minutos = Math.max(1, Math.round(duracionS / 60));
  const tiempo =
    minutos < 60
      ? `${minutos} min`
      : `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`;
  const distancia =
    distanciaM < 1000
      ? `${Math.round(distanciaM / 10) * 10} m`
      : `${(distanciaM / 1000).toFixed(1).replace('.', ',')} km`;
  return `${tiempo} · ${distancia}`;
}

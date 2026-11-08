const URL_NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const MAXIMO_NOMBRE = 200;

export interface Lugar {
  nombre: string;
  /** Dirección completa, para distinguir sugerencias con el mismo nombre. */
  detalle: string;
  lat: number;
  lng: number;
}

/**
 * Busca lugares en OpenStreetMap (RN-4). Solo sale el texto escrito, nunca el token de la sesión.
 * La política de Nominatim prohíbe autocompletar y pide 1 petición por segundo: se busca al pedirlo la persona.
 * ponytail: servidor público de Nominatim; uno propio o de pago si el uso real supera esa política.
 */
export async function buscarLugares(texto: string): Promise<Lugar[]> {
  const parametros = new URLSearchParams({
    q: texto,
    format: 'jsonv2',
    limit: '5',
    countrycodes: 'bo',
    'accept-language': 'es',
  });
  const respuesta = await fetch(`${URL_NOMINATIM}?${parametros}`, {
    headers: { 'User-Agent': 'UniRide/0.1 (app movil)' },
  });
  if (!respuesta.ok) throw new Error(`Nominatim ${respuesta.status}`);
  const filas: {
    name?: string;
    display_name: string;
    lat: string;
    lon: string;
  }[] = await respuesta.json();
  return filas.map((f) => ({
    // "Módulos, UAGRM, Santa Cruz…": sin las partes que solo repiten provincia y país.
    nombre: (f.name || f.display_name.split(',').slice(0, 2).join(','))
      .trim()
      .slice(0, MAXIMO_NOMBRE),
    detalle: f.display_name,
    lat: Number(f.lat),
    lng: Number(f.lon),
  }));
}

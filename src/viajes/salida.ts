import { formatearHoraLocal } from '@/formato';

/** La búsqueda mira ± media hora alrededor de la salida (RN-2 de HU-18). */
export const MEDIA_HORA_MS = 30 * 60_000;
export const ANTICIPACION_MAXIMA_DIAS = 7;

export const medianoche = (fecha: Date) =>
  new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());

/** La primera media hora desde ese instante (DESIGN_SYSTEM §9.2). */
export function salidaPorOmision(desde: number) {
  const salida = new Date(Math.ceil(desde / MEDIA_HORA_MS) * MEDIA_HORA_MS);
  return {
    fecha: medianoche(salida),
    hora: formatearHoraLocal(salida.toISOString()),
  };
}

/** "07:00" y "08:00" para una salida a las 07:30. */
export const ventanaDe = (salida: number) => ({
  desde: formatearHoraLocal(new Date(salida - MEDIA_HORA_MS).toISOString()),
  hasta: formatearHoraLocal(new Date(salida + MEDIA_HORA_MS).toISOString()),
});

/** Con toda la ventana en el pasado no queda viaje que encontrar: el servidor responde vacío sin buscar. */
export const ventanaPasada = (salida: number, ahora = Date.now()) =>
  salida + MEDIA_HORA_MS <= ahora;

/** "0730" o "730" → "07:30": el teclado numérico no trae los dos puntos. */
export function escribirHora(texto: string) {
  const escrito = texto.replace(/\D/g, '').slice(0, 4);
  // Ninguna hora empieza por 3-9: "730" no es "73:0".
  const digitos = /^[3-9]\d\d$/.test(escrito) ? `0${escrito}` : escrito;
  return digitos.length > 2
    ? `${digitos.slice(0, 2)}:${digitos.slice(2)}`
    : digitos;
}

/** La salida en la hora local, o `null` si la hora está mal escrita. */
export function leerSalida(fecha: Date, hora: string): Date | null {
  const partes = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora);
  if (!partes) return null;
  return new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate(),
    Number(partes[1]),
    Number(partes[2]),
  );
}

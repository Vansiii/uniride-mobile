import textos from './es-BO.json';

type Nodo = string | { [clave: string]: Nodo };

/** Devuelve el texto es-BO de `clave` (por ejemplo, "aplicacion.nombre"); si no existe, la propia clave. */
export function t(clave: string): string {
  const valor = clave
    .split('.')
    .reduce<Nodo | undefined>(
      (nodo, parte) => (typeof nodo === 'object' ? nodo[parte] : undefined),
      textos,
    );
  return typeof valor === 'string' ? valor : clave;
}

/** `t` con sus `{marcadores}` llenos. */
export const con = (clave: string, valores: Record<string, string | number>) =>
  Object.entries(valores).reduce(
    (texto, [nombre, valor]) => texto.replaceAll(`{${nombre}}`, String(valor)),
    t(clave),
  );

/**
 * Hora local en 24 h ("07:46") de una fecha ISO, para decir cuándo se puede reintentar. Si no es hoy agrega el día
 * ("18:24 del 11/11"): un bloqueo de 24 h termina a la misma hora de mañana y solo la hora parecería ya vencido.
 */
export function formatearHora(iso: unknown, ahora = new Date()): string {
  const fecha = new Date(String(iso));
  const hora = fecha.toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  if (fecha.toDateString() === ahora.toDateString()) return hora;
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${hora} del ${dia}/${mes}`;
}

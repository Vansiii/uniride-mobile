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

/** Hora local en 24 h ("07:46") de una fecha ISO, para decir cuándo se puede reintentar. */
export function formatearHora(iso: unknown): string {
  return new Date(String(iso)).toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

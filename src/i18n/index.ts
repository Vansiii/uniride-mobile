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

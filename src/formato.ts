/**
 * Monto de la API ("1234.50") a es-BO ("1.234,50"), DESIGN_SYSTEM §13.
 * Trabaja sobre el texto, sin pasar por `Number`: un saldo grande perdería precisión y "5.50" no puede volverse "5.5".
 * Si el texto no es un decimal simple lo devuelve igual: nunca se inventa una cifra.
 */
export function formatearMonto(texto: string): string {
  const partes = /^(-?)(\d+)(?:\.(\d*))?$/.exec(texto);
  if (!partes) return texto;
  const [, signo, entera, fraccion = ''] = partes;
  const miles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${signo}${miles},${fraccion.padEnd(2, '0').slice(0, 2)}`;
}

export interface ResultadoViajeEnPantalla {
  id: string;
  origenNombre: string;
  destinoNombre: string;
  fechaHoraSalida: string;
  precioPorAsiento: number;
}

let resultadosActuales: ResultadoViajeEnPantalla[] | null = null;

/**
 * Mantiene la lista de resultados de viajes actualmente visibles en la pantalla de búsqueda.
 * `viajes/buscar.tsx` la actualiza al recibir o enfocar los resultados, y la limpia al salir.
 * Permite que «reserva el {n}» sepa qué viaje reservar (CA-5) o responda «Primero busca un viaje» (CA-10).
 */
export const resultadosEnPantalla = {
  establecer(lista: ResultadoViajeEnPantalla[]) {
    resultadosActuales = lista;
  },
  obtener(): ResultadoViajeEnPantalla[] | null {
    return resultadosActuales;
  },
  limpiar() {
    resultadosActuales = null;
  },
};

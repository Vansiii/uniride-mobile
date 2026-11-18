import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import type { Paleta } from './paletas';
import { useTema } from './ProveedorTema';

type Estilos = Parameters<typeof StyleSheet.create>[0];

/** Multiplica `fontSize` y `lineHeight` por la escala elegida (HU-31 CA-4); lo demás queda igual. */
export function escalar<T extends Estilos>(estilos: T, escala: number): T {
  if (escala === 1) return estilos;
  const salida: Record<string, unknown> = {};
  for (const [nombre, estilo] of Object.entries(estilos)) {
    const e = { ...(estilo as Record<string, unknown>) };
    for (const clave of ['fontSize', 'lineHeight'])
      if (typeof e[clave] === 'number')
        e[clave] = Math.round((e[clave] as number) * escala);
    salida[nombre] = e;
  }
  return salida as T;
}

/**
 * Reemplaza `StyleSheet.create` en pantallas y componentes: la fábrica recibe la paleta del tema vigente y la hoja se
 * vuelve a crear solo cuando cambian el tema, el contraste o el tamaño de texto.
 */
export function crearEstilos<T extends Estilos>(
  fabrica: (colores: Paleta) => T,
) {
  return function useEstilos(): T {
    const { colores, escala } = useTema();
    return useMemo(
      () => StyleSheet.create(escalar(fabrica(colores), escala)) as T,
      [colores, escala],
    );
  };
}

/** Para los colores sueltos en JSX o en animaciones (no los de una hoja de estilos). */
export const useColores = (): Paleta => useTema().colores;

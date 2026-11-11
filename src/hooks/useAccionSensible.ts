import { useCallback, useRef, useState } from 'react';
import { ErrorApi, type OpcionesFirma } from '@/api/cliente';
import { ErrorKeystore, fallaDeLlave } from '@/dispositivo/keystore';
import { formatearMonto } from '@/formato';
import { con, t } from '@/i18n';

/** Acciones de la RN-1 de HU-29 que ya existen en la app. Una nueva agrega su texto en `comun.biometria`. */
export type AccionSensible = 'recarga' | 'publicar' | 'crear_billetera';

/** `firmando`: el diálogo del sistema está abierto. `enviando`: ya firmó y espera al servidor (CA-9). */
export type EstadoAccion = 'reposo' | 'firmando' | 'enviando';

export interface FallaFirma {
  texto: string;
  tono: 'info' | 'peligro';
  revincular?: 'llave_anulada' | 'sin_llave';
}

/** Título y subtítulo del diálogo biométrico: nombran la acción y el monto (CA-1). `monto` es texto de la API o del formulario. */
export const dialogoDe = (accion: AccionSensible, monto?: string) => ({
  titulo: t(`comun.biometria.dialogo.${accion}.titulo`),
  subtitulo: con(`comun.biometria.dialogo.${accion}.subtitulo`, {
    monto: monto === undefined ? '' : formatearMonto(monto),
  }),
});

/**
 * Lo que toda acción sensible explica igual (CA-2, CA-8, HU-10 CA-1, casos borde de la spec); `null` si el error es
 * propio de la acción y lo explica su pantalla.
 */
export function fallaDeFirma(
  error: unknown,
  accion: AccionSensible,
): FallaFirma | null {
  if (error instanceof ErrorKeystore) {
    // Cancelar es una decisión de la persona, no un error: tono informativo.
    if (error.codigo === 'BIOMETRIA_CANCELADA')
      return {
        texto: con('comun.biometria.no_confirmado', {
          accion: t(`comun.biometria.accion.${accion}`),
        }),
        tono: 'info',
      };
    const { clave, revincular } = fallaDeLlave(error);
    return { texto: t(clave), tono: 'peligro', revincular };
  }
  if (error instanceof ErrorApi && error.codigo === 'PETICION_EXPIRADA')
    return { texto: t('comun.errores.peticion_expirada'), tono: 'peligro' };
  if (error instanceof ErrorApi && error.codigo === 'SIN_CONEXION')
    return { texto: t('comun.errores.sin_conexion'), tono: 'peligro' };
  return null;
}

/**
 * Una huella por acción (RN-3): ejecuta la petición firmada con el diálogo de `accion` y lleva el estado del botón.
 * Un toque mientras hay una en curso no abre otro diálogo (devuelve `undefined`). Los errores llegan tal cual a quien
 * llama; el éxito, solo cuando respondió el servidor (CA-9).
 */
export function useAccionSensible(accion: AccionSensible) {
  const [estado, setEstado] = useState<EstadoAccion>('reposo');
  const enCurso = useRef(false);

  const ejecutar = useCallback(
    async <T>(
      peticion: (opciones: OpcionesFirma) => Promise<T>,
      monto?: string,
    ): Promise<T | undefined> => {
      if (enCurso.current) return undefined;
      enCurso.current = true;
      setEstado('firmando');
      try {
        return await peticion({
          dialogo: dialogoDe(accion, monto),
          alFirmar: () => setEstado('enviando'),
        });
      } finally {
        enCurso.current = false;
        setEstado('reposo');
      }
    },
    [accion],
  );

  /** Lee el candado, no el estado: dos toques en el mismo cuadro ven `reposo` los dos. */
  const ocupado = useCallback(() => enCurso.current, []);

  return { estado, ejecutar, ocupado };
}

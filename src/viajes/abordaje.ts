import { ErrorApi } from '@/api/cliente';
import { formatearHoraLocal } from '@/formato';
import { fallaDeFirma, type FallaFirma } from '@/hooks/useAccionSensible';
import { con, t } from '@/i18n';
import type { PosicionParaEncuentro } from '@/servicios/ubicacion';

/** El código vive 30 s en el servidor; se pide el siguiente a los 25 para que nunca haya uno vencido en pantalla. */
export const RENOVAR_MS = 25_000;
/** Cada cuánto el conductor mira si alguien escaneó: un escaneo gasta el código y hay que mostrar otro (RN-1). */
export const SONDEO_MS = 3_000;

/** Reservas que ya pasaron el abordaje; `verificacion_fallida` (HU-23) no cuenta. */
const ABORDADAS = new Set(['abordada', 'verificada', 'pagada']);
export const yaAbordo = (estado: string) => ABORDADAS.has(estado);

export type FallaAbordaje = FallaFirma & {
  /** Android ya no muestra el diálogo de permiso: queda ir a los ajustes. */
  ajustes?: boolean;
};

/** El nonce del QR `uniride://encuentro/<nonce>` (32 bytes en base64url); `null` si no es un código de UniRide. */
export function nonceDelQr(texto: string): string | null {
  const m = /^uniride:\/\/encuentro\/([A-Za-z0-9_-]{43})$/.exec(texto.trim());
  return m ? m[1] : null;
}

/** Sin ubicación usable no se pide nada al servidor (spec §4). `null` si la posición está. */
export function fallaDeUbicacion(
  lectura: PosicionParaEncuentro,
): FallaAbordaje | null {
  if (lectura.tipo === 'ok') return null;
  if (lectura.tipo === 'sin_permiso')
    return {
      texto: t('presencia.abordaje.permiso_ubicacion'),
      tono: 'peligro',
      ajustes: !lectura.puedePedir,
    };
  return { texto: t('presencia.abordaje.activa_ubicacion'), tono: 'peligro' };
}

/** Rechazos del encuentro que conductor y pasajero explican igual (spec §4); nunca un código técnico (CA-7). */
export function fallaDeAbordaje(
  error: unknown,
  accion: 'mostrar_codigo' | 'abordar',
): FallaAbordaje {
  if (
    accion === 'abordar' &&
    error instanceof ErrorApi &&
    error.codigo === 'SIN_CONEXION'
  )
    return { texto: t('presencia.abordaje.sin_conexion'), tono: 'peligro' };
  const deFirma = fallaDeFirma(error, accion);
  if (deFirma) return deFirma;
  const peligro = (clave: string): FallaAbordaje => ({
    texto: t(clave),
    tono: 'peligro',
  });
  if (!(error instanceof ErrorApi)) return peligro('presencia.abordaje.error');
  switch (error.codigo) {
    case 'CODIGO_INVALIDO':
      return peligro('presencia.abordaje.codigo_invalido');
    case 'DISTANCIA':
      return {
        texto: con('presencia.abordaje.distancia', {
          distancia: String(error.datos.distanciaM ?? '?'),
        }),
        tono: 'peligro',
      };
    case 'UBICACION_SIMULADA':
      return peligro('presencia.abordaje.ubicacion_simulada');
    case 'SENAL_GPS':
      return peligro('presencia.abordaje.senal_gps');
    case 'DISPOSITIVO_NO_INTEGRO':
      return peligro('presencia.abordaje.integridad');
    case 'SIN_RESERVA':
      return peligro('presencia.abordaje.sin_reserva');
    case 'SERVICIO_NO_DISPONIBLE':
      return peligro('presencia.abordaje.servicio_no_disponible');
    case 'FUERA_DE_VENTANA':
      return {
        texto: con('presencia.abordaje.fuera_de_ventana', {
          desde: formatearHora(error.datos.desde),
          hasta: formatearHora(error.datos.hasta),
        }),
        tono: 'info',
      };
    case 'SIN_RESERVAS':
      return { texto: t('presencia.abordaje.sin_reservas'), tono: 'info' };
    default:
      return peligro('presencia.abordaje.error');
  }
}

const formatearHora = (iso: unknown) =>
  typeof iso === 'string' ? formatearHoraLocal(iso) : '?';

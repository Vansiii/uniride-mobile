import { ErrorApi } from '@/api/cliente';
import { formatearHoraLocal } from '@/formato';
import { fallaDeFirma, type FallaFirma } from '@/hooks/useAccionSensible';
import { con, t } from '@/i18n';
import type { TipoEncuentro } from '@/api/cliente';
import type { PosicionParaEncuentro } from '@/servicios/ubicacion';

/** El código vive 30 s en el servidor; se pide el siguiente a los 25 para que nunca haya uno vencido en pantalla. */
export const RENOVAR_MS = 25_000;
/** Cada cuánto el conductor mira si alguien escaneó: un escaneo gasta el código y hay que mostrar otro (RN-1). */
export const SONDEO_MS = 3_000;

/** Reservas que ya pasaron el abordaje; `verificacion_fallida` (HU-23) no cuenta. */
const ABORDADAS = new Set(['abordada', 'verificada', 'pagada']);
export const yaAbordo = (estado: string) => ABORDADAS.has(estado);

/** HU-23: la bajada usa sus propios textos donde dicen otra cosa; el resto, los del abordaje. */
export function texto(tipo: TipoEncuentro, clave: string): string {
  const propia = `presencia.${tipo}.${clave}`;
  const valor = t(propia);
  return valor === propia ? t(`presencia.abordaje.${clave}`) : valor;
}

export type FallaAbordaje = FallaFirma & {
  /** Android ya no muestra el diálogo de permiso: queda ir a los ajustes. */
  ajustes?: boolean;
  /** El teléfono no está vinculado (o su firma ya no vale): la salida es «Mi teléfono». */
  vincular?: boolean;
};

/** El nonce del QR `uniride://encuentro/<nonce>` (32 bytes en base64url); `null` si no es un código de UniRide. */
export function nonceDelQr(texto: string): string | null {
  const m = /^uniride:\/\/encuentro\/([A-Za-z0-9_-]{43})$/.exec(texto.trim());
  return m ? m[1] : null;
}

/** Sin ubicación usable no se pide nada al servidor (spec §4). `null` si la posición está. */
export function fallaDeUbicacion(
  lectura: PosicionParaEncuentro,
  tipo: TipoEncuentro = 'abordaje',
): FallaAbordaje | null {
  if (lectura.tipo === 'ok') return null;
  if (lectura.tipo === 'sin_permiso')
    return {
      texto: texto(tipo, 'permiso_ubicacion'),
      tono: 'peligro',
      ajustes: !lectura.puedePedir,
    };
  return { texto: texto(tipo, 'activa_ubicacion'), tono: 'peligro' };
}

/** Rechazos del encuentro que conductor y pasajero explican igual (spec §4); nunca un código técnico (CA-7). */
export function fallaDeAbordaje(
  error: unknown,
  accion: 'mostrar_codigo' | 'abordar',
  tipo: TipoEncuentro = 'abordaje',
): FallaAbordaje {
  if (
    accion === 'abordar' &&
    error instanceof ErrorApi &&
    error.codigo === 'SIN_CONEXION'
  )
    return { texto: texto(tipo, 'sin_conexion'), tono: 'peligro' };
  const deFirma = fallaDeFirma(error, accion);
  if (deFirma) return deFirma;
  const peligro = (clave: string): FallaAbordaje => ({
    texto: texto(tipo, clave),
    tono: 'peligro',
  });
  if (!(error instanceof ErrorApi)) return peligro('error');
  switch (error.codigo) {
    case 'CODIGO_INVALIDO':
      return peligro('codigo_invalido');
    case 'DISTANCIA':
      return {
        texto: con('presencia.abordaje.distancia', {
          distancia: String(error.datos.distanciaM ?? '?'),
        }),
        tono: 'peligro',
      };
    case 'UBICACION_SIMULADA':
      return peligro('ubicacion_simulada');
    case 'SENAL_GPS':
      return peligro('senal_gps');
    case 'DISPOSITIVO_NO_INTEGRO':
      return peligro('integridad');
    case 'SIN_RESERVA':
      return peligro('sin_reserva');
    case 'SERVICIO_NO_DISPONIBLE':
      return peligro('servicio_no_disponible');
    case 'FUERA_DE_VENTANA':
      return {
        texto: con('presencia.abordaje.fuera_de_ventana', {
          desde: formatearHora(error.datos.desde),
          hasta: formatearHora(error.datos.hasta),
        }),
        tono: 'info',
      };
    case 'DISPOSITIVO_NO_VINCULADO':
    case 'FIRMA_DISPOSITIVO_INVALIDA':
      return {
        texto: texto(tipo, 'vincular_requerido'),
        tono: 'info',
        vincular: true,
      };
    case 'SIN_RESERVAS':
      return { texto: texto(tipo, 'sin_reservas'), tono: 'info' };
    case 'RESERVA_NO_ABORDADA':
      return { texto: texto(tipo, 'no_abordada'), tono: 'info' };
    case 'VIAJE_NO_EN_CURSO':
      return { texto: texto(tipo, 'viaje_no_en_curso'), tono: 'info' };
    default:
      return peligro('error');
  }
}

const formatearHora = (iso: unknown) =>
  typeof iso === 'string' ? formatearHoraLocal(iso) : '?';

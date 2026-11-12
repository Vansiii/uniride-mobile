import { requireOptionalNativeModule } from 'expo';
import { t } from '@/i18n';

export type CodigoErrorKeystore =
  | 'KEYSTORE_NO_DISPONIBLE'
  | 'BIOMETRIA_CANCELADA'
  | 'LLAVE_ANULADA'
  | 'SIN_LLAVE'
  | 'SIN_BIOMETRIA'
  | 'BIOMETRIA_BLOQUEADA';

/** Falla local del teléfono (no de la API): sin módulo nativo, sin biometría, anulada o cancelada por la persona. */
export class ErrorKeystore extends Error {
  constructor(readonly codigo: CodigoErrorKeystore) {
    super(codigo);
  }
}

export interface FirmaConMarca {
  /** Firma DER en Base64. */
  firma: string;
  /** Milisegundos del momento de firmar, tomados después de la huella. */
  marca: string;
}

interface ModuloLlave {
  crearLlave(): Promise<string>;
  confirmarLlave(): Promise<void>;
  firmar(
    antes: string,
    despues: string,
    textos: { titulo: string; subtitulo: string; cancelar: string },
  ): Promise<FirmaConMarca>;
  nonceAleatorio(): string;
}

/**
 * Frontera con lo nativo de Android (HU-09): la llave ECDSA P-256 vive en el Keystore (StrongBox o TEE), no es
 * exportable y exige la biometría del dueño en cada firma (RN-2, A-04). El módulo local `modules/llave-dispositivo`
 * solo existe en la app de Android: en web y en Jest todo falla de forma segura y la app no finge nada.
 */
const nativo = requireOptionalNativeModule<ModuloLlave>('LlaveDispositivo');

function modulo(): ModuloLlave {
  if (!nativo) throw new ErrorKeystore('KEYSTORE_NO_DISPONIBLE');
  return nativo;
}

/** Traduce la falla del módulo nativo conservando los códigos que la app sabe explicar (HU-10). */
const codigosValidos: Set<string> = new Set<CodigoErrorKeystore>([
  'KEYSTORE_NO_DISPONIBLE',
  'BIOMETRIA_CANCELADA',
  'LLAVE_ANULADA',
  'SIN_LLAVE',
  'SIN_BIOMETRIA',
  'BIOMETRIA_BLOQUEADA',
]);

const traducirFalla = (error: unknown) => {
  const code = (error as { code?: string }).code;
  return new ErrorKeystore(
    code && codigosValidos.has(code)
      ? (code as CodigoErrorKeystore)
      : 'KEYSTORE_NO_DISPONIBLE',
  );
};

/**
 * Qué se le dice a la persona cuando la llave no sirvió (CA-1 de HU-10: con huella nueva nunca «Actualiza la app»).
 * `revincular`: la salida es volver a vincular el teléfono desde «Mi teléfono». La cancelación la explica cada pantalla.
 */
export function fallaDeLlave(error: ErrorKeystore): {
  clave: string;
  revincular?: 'llave_anulada' | 'sin_llave';
} {
  switch (error.codigo) {
    case 'LLAVE_ANULADA':
      return {
        clave: 'dispositivo.llave_anulada.explicacion',
        revincular: 'llave_anulada',
      };
    case 'SIN_LLAVE':
      return {
        clave: 'dispositivo.revincular.telefono_nuevo',
        revincular: 'sin_llave',
      };
    case 'SIN_BIOMETRIA':
      return { clave: 'comun.biometria.sin_registrar' };
    case 'BIOMETRIA_BLOQUEADA':
      return { clave: 'comun.biometria.bloqueada' };
    default:
      return { clave: 'billetera.pantalla.keystore_no_disponible' };
  }
}

/**
 * Genera un par nuevo y devuelve la llave PÚBLICA en PEM (SPKI). La llave anterior sigue siendo la que firma hasta
 * `confirmarLlave()`: si el servidor rechaza la vinculación, el teléfono no se queda sin llave.
 */
export async function crearLlave(): Promise<string> {
  try {
    return await modulo().crearLlave();
  } catch (error) {
    throw traducirFalla(error);
  }
}

/** Llamar solo cuando el servidor aceptó la llave nueva (201): pasa a firmar con ella y borra la anterior. */
export async function confirmarLlave(): Promise<void> {
  try {
    await modulo().confirmarLlave();
  } catch (error) {
    throw traducirFalla(error);
  }
}

/** Tras pedir la biometría, firma `antes + marca + despues` (UTF-8) con la llave privada y devuelve firma y marca. */
export async function firmar(
  antes: string,
  despues: string,
): Promise<FirmaConMarca> {
  try {
    return await modulo().firmar(antes, despues, {
      titulo: t('dispositivo.autenticacion.titulo'),
      subtitulo: t('dispositivo.autenticacion.subtitulo'),
      cancelar: t('dispositivo.autenticacion.cancelar'),
    });
  } catch (error) {
    throw traducirFalla(error);
  }
}

/** 16 bytes aleatorios del sistema en hexadecimal (el servidor pide de 16 a 128 caracteres). */
export function nonceAleatorio(): string {
  return modulo().nonceAleatorio();
}

/**
 * Pide a Play Integrity un token cuyo nonce es `desafio`.
 * ponytail: Play Integrity real todavía no está conectado. Solo con `EXPO_PUBLIC_MODO_SIMULADO=true` en desarrollo se
 * devuelve el token que acepta el backend simulado (`MODO_EMULADOR_DEV`). En una build de producción nunca se simula:
 * sin token real no se puede vincular, y eso es lo correcto (la app no decide).
 */
export async function pedirTokenIntegridad(_desafio: string): Promise<string> {
  if (__DEV__ && process.env.EXPO_PUBLIC_MODO_SIMULADO === 'true')
    return 'simulado:integro';
  throw new ErrorKeystore('KEYSTORE_NO_DISPONIBLE');
}

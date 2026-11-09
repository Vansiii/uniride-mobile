import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
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

/** Traduce la falla del modulo nativo preservando codigos explicitos de seguridad (HU-10). */
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
  if (code && codigosValidos.has(code)) {
    return new ErrorKeystore(code as CodigoErrorKeystore);
  }
  return new ErrorKeystore('KEYSTORE_NO_DISPONIBLE');
};

/** Genera el par en el Keystore y devuelve la llave PÚBLICA en PEM (SPKI). */
export async function crearLlave(): Promise<string> {
  if (
    (__DEV__ || Platform.OS === 'web') &&
    process.env.EXPO_PUBLIC_MODO_SIMULADO === 'true' &&
    !nativo
  ) {
    return '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEqVwIfwjrugxJ579FsE9CPQn0kKmp\nX2PMrD9TnZobjcaQzMPkGgJGUSmRdKmrPnpNqLsWR/vwK94XG82/uuSm8g==\n-----END PUBLIC KEY-----\n';
  }
  try {
    return await modulo().crearLlave();
  } catch (error) {
    throw traducirFalla(error);
  }
}

/** Tras pedir la biometría, firma `antes + marca + despues` (UTF-8) con la llave privada y devuelve firma y marca. */
export async function firmar(
  antes: string,
  despues: string,
): Promise<FirmaConMarca> {
  if (
    (__DEV__ || Platform.OS === 'web') &&
    process.env.EXPO_PUBLIC_MODO_SIMULADO === 'true' &&
    !nativo
  ) {
    return {
      firma: 'MEQCID6v+4Y8G5xZ5z5z5z5z5z5z5z5z5z5z5z5z5z5z5z5zAkA+7w+4Y8G5xZ5z5z5z5z5z5z5z5z5z5z5z5z5z5z5z5z==',
      marca: Date.now().toString(),
    };
  }
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
  if (
    (__DEV__ || Platform.OS === 'web') &&
    process.env.EXPO_PUBLIC_MODO_SIMULADO === 'true' &&
    !nativo
  ) {
    return Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join('');
  }
  return modulo().nonceAleatorio();
}

/**
 * Pide a Play Integrity un token cuyo nonce es `desafio`.
 * ponytail: Play Integrity real todavía no está conectado. Solo con `EXPO_PUBLIC_MODO_SIMULADO=true` en desarrollo se
 * devuelve el token que acepta el backend simulado (`MODO_EMULADOR_DEV`). En una build de producción nunca se simula:
 * sin token real no se puede vincular, y eso es lo correcto (la app no decide).
 */
export async function pedirTokenIntegridad(_desafio: string): Promise<string> {
  if (
    (__DEV__ || Platform.OS === 'web') &&
    process.env.EXPO_PUBLIC_MODO_SIMULADO === 'true'
  )
    return 'simulado:integro';
  throw new ErrorKeystore('KEYSTORE_NO_DISPONIBLE');
}

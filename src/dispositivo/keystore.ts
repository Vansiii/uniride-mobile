import { requireOptionalNativeModule } from 'expo';
import { t } from '@/i18n';

/** Falla local del teléfono (no de la API): sin módulo nativo, sin biometría o cancelada por la persona. */
export class ErrorKeystore extends Error {
  constructor(
    readonly codigo: 'KEYSTORE_NO_DISPONIBLE' | 'BIOMETRIA_CANCELADA',
  ) {
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

/** Cualquier falla del Keystore se reduce a dos casos: la persona canceló o la llave no se pudo usar. */
const traducirFalla = (error: unknown) =>
  new ErrorKeystore(
    (error as { code?: string }).code === 'BIOMETRIA_CANCELADA'
      ? 'BIOMETRIA_CANCELADA'
      : 'KEYSTORE_NO_DISPONIBLE',
  );

/** Genera el par en el Keystore y devuelve la llave PÚBLICA en PEM (SPKI). */
export async function crearLlave(): Promise<string> {
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

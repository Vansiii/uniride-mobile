/** Falla local del teléfono (no de la API): sin módulo nativo, sin biometría o cancelada por la persona. */
export class ErrorKeystore extends Error {
  constructor(
    readonly codigo: 'KEYSTORE_NO_DISPONIBLE' | 'BIOMETRIA_CANCELADA',
  ) {
    super(codigo);
  }
}

/**
 * Frontera con lo nativo de Android (HU-09): la llave ECDSA P-256 vive en el Keystore (StrongBox o TEE), no es
 * exportable y exige la biometría del dueño en cada firma (RN-2, A-04).
 * ponytail: todavía no hay módulo nativo instalado (requiere dev build y confirmación de dependencia, AGENTS.md §14),
 * así que todo falla de forma segura: sin llave no hay vinculación ni firma y la app no finge nada. Al instalarlo,
 * solo cambian estas tres funciones; la pantalla, la firma canónica y sus pruebas no.
 */

/** Genera el par en el Keystore y devuelve la llave PÚBLICA en PEM (SPKI). */
export async function crearLlave(): Promise<string> {
  throw new ErrorKeystore('KEYSTORE_NO_DISPONIBLE');
}

/** Firma `mensaje` (UTF-8) con la llave privada, tras pedir la biometría; devuelve la firma DER en Base64. */
export async function firmar(_mensaje: string): Promise<string> {
  throw new ErrorKeystore('KEYSTORE_NO_DISPONIBLE');
}

/** Pide a Play Integrity un token cuyo nonce es `desafio`. */
export async function pedirTokenIntegridad(_desafio: string): Promise<string> {
  throw new ErrorKeystore('KEYSTORE_NO_DISPONIBLE');
}

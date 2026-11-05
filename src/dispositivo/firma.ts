import { firmar } from './keystore';
import { sha256Hex } from './sha256';

/**
 * Mensaje canónico que firma la app (HU-09 RN-4), idéntico al que reconstruye el servidor:
 * `METODO\nRUTA\nTIMESTAMP\nNONCE\nSHA256hex(CUERPO)`. RUTA es la ruta completa con `/api/v1` y la query,
 * sin host; el cuerpo vacío se hashea como cadena vacía.
 */
export function mensajeCanonico(
  metodo: string,
  ruta: string,
  marca: string,
  nonce: string,
  cuerpo: string,
): string {
  return `${metodo.toUpperCase()}\n${ruta}\n${marca}\n${nonce}\n${sha256Hex(cuerpo)}`;
}

/** 16 bytes aleatorios en hexadecimal (el servidor pide de 16 a 128 caracteres). */
function nuevoNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Encabezados de una petición sensible: la firma la hace el Keystore, con biometría del dueño (A-04, A-08). */
export async function cabecerasFirma(
  dispositivoId: string,
  metodo: string,
  ruta: string,
  cuerpo: string,
): Promise<Record<string, string>> {
  const marca = String(Date.now());
  const nonce = nuevoNonce();
  return {
    'X-Dispositivo-Id': dispositivoId,
    'X-Timestamp': marca,
    'X-Nonce': nonce,
    'X-Firma': await firmar(
      mensajeCanonico(metodo, ruta, marca, nonce, cuerpo),
    ),
  };
}

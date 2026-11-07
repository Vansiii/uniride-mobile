import { firmar, nonceAleatorio } from './keystore';
import { sha256Hex } from './sha256';

/** Lo que va antes y después de TIMESTAMP en el mensaje canónico. */
function partesDelMensaje(
  metodo: string,
  ruta: string,
  nonce: string,
  cuerpo: string,
): [string, string] {
  return [
    `${metodo.toUpperCase()}\n${ruta}\n`,
    `\n${nonce}\n${sha256Hex(cuerpo)}`,
  ];
}

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
  const [antes, despues] = partesDelMensaje(metodo, ruta, nonce, cuerpo);
  return antes + marca + despues;
}

/** Encabezados de una petición sensible: la firma la hace el Keystore, con biometría del dueño (A-04, A-08). */
export async function cabecerasFirma(
  dispositivoId: string,
  metodo: string,
  ruta: string,
  cuerpo: string,
): Promise<Record<string, string>> {
  const nonce = nonceAleatorio();
  const { firma, marca } = await firmar(
    ...partesDelMensaje(metodo, ruta, nonce, cuerpo),
  );
  return {
    'X-Dispositivo-Id': dispositivoId,
    'X-Timestamp': marca,
    'X-Nonce': nonce,
    'X-Firma': firma,
  };
}

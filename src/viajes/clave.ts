import { nonceAleatorio } from '@/dispositivo/keystore';
import { sha256Hex } from '@/dispositivo/sha256';

/**
 * Clave de idempotencia de una reserva (HU-19 CA-4): un UUID que la pantalla genera al confirmar y conserva mientras siga
 * abierta, así un reintento tras perder la respuesta devuelve la misma reserva y no cobra dos veces. El azar sale del módulo
 * nativo (`nonceAleatorio`), no de `crypto`, que Hermes no trae. Falla de forma segura sin el módulo nativo.
 */
export function nuevaClaveReserva(): string {
  const h = sha256Hex(`${nonceAleatorio()}:${Date.now()}`);
  const variante = '89ab'[parseInt(h[16], 16) % 4];
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variante}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

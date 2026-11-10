/** Falla de la prueba de vida en el teléfono (no de la API). */
export class ErrorLiveness extends Error {
  constructor() {
    super('LIVENESS_NO_DISPONIBLE');
  }
}

/**
 * Ejecuta la prueba de vida de Rekognition Face Liveness con `sesionId` (AGENTS.md §4).
 * ponytail: aquí se enchufará el módulo nativo (dev build) que abre el componente de AWS; todavía no hay uno
 * instalado. Solo con `EXPO_PUBLIC_MODO_SIMULADO=true` en desarrollo se omite, porque el backend simulado
 * (`REKOGNITION_SIMULADO`) acepta su propia sesión sin cámara. En una build de producción nunca se simula:
 * sin módulo nativo la verificación no se puede completar, y eso es lo correcto (la app no decide).
 */
export async function ejecutarLiveness(_sesionId: string): Promise<void> {
  if (__DEV__ && process.env.EXPO_PUBLIC_MODO_SIMULADO === 'true') return;
  throw new ErrorLiveness();
}

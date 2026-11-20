import { requireOptionalNativeModule } from 'expo';
import { pedirCredencialesLiveness } from '@/api/cliente';

/** Falla de la prueba de vida en el teléfono (no de la API). `codigo` solo sirve para depurar. */
export class ErrorLiveness extends Error {
  constructor(readonly codigo: string = 'LIVENESS_NO_DISPONIBLE') {
    super(codigo);
  }
}

interface ModuloLiveness {
  iniciar(
    sesionId: string,
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
    sessionToken: string,
    expiraEnSegundos: number,
  ): Promise<void>;
}

/** Módulo local `modules/liveness-rostro`: solo existe en Android; en web y en Jest no hay y todo falla seguro. */
const nativo = requireOptionalNativeModule<ModuloLiveness>('LivenessRostro');

/**
 * Ejecuta la prueba de vida de Rekognition Face Liveness con `sesionId` (AGENTS.md §4). La API entrega credenciales
 * temporales acotadas a abrir el video; el componente nativo de AWS hace la prueba y el servidor lee el resultado
 * con el `sesionId` (A-01: el teléfono no decide). Solo con `EXPO_PUBLIC_MODO_SIMULADO=true` en desarrollo se omite,
 * porque el backend simulado acepta su propia sesión sin cámara; en producción nunca se simula.
 */
export async function ejecutarLiveness(sesionId: string): Promise<void> {
  if (__DEV__ && process.env.EXPO_PUBLIC_MODO_SIMULADO === 'true') return;
  if (!nativo) throw new ErrorLiveness();
  // Si la API falla (503, sin conexión), el error de la API llega tal cual a la pantalla.
  const c = await pedirCredencialesLiveness();
  try {
    await nativo.iniciar(
      sesionId,
      c.region,
      c.accessKeyId,
      c.secretAccessKey,
      c.sessionToken,
      Math.floor(Date.parse(c.expiracion) / 1000),
    );
  } catch (error) {
    throw new ErrorLiveness((error as { code?: string }).code);
  }
}

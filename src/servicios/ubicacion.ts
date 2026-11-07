import * as Location from 'expo-location';

export type Ubicacion =
  | { tipo: 'ok'; lat: number; lng: number }
  /** `puedePedir: false`: Android ya no muestra el diálogo; queda ir a los ajustes. */
  | { tipo: 'sin_permiso'; puedePedir: boolean }
  | { tipo: 'fallo' };

const TOPE_MS = 15_000;
const VIGENCIA_MS = 60_000;
const PRECISION_METROS = 300;

/** La ubicación actual. Solo `pedir` abre el diálogo del sistema: al abrir la pantalla no se interrumpe a nadie. */
export async function obtenerUbicacion(pedir: boolean): Promise<Ubicacion> {
  try {
    const permiso = pedir
      ? await Location.requestForegroundPermissionsAsync()
      : await Location.getForegroundPermissionsAsync();
    if (!permiso.granted)
      return { tipo: 'sin_permiso', puedePedir: permiso.canAskAgain };
    const ultima = await Location.getLastKnownPositionAsync({
      maxAge: VIGENCIA_MS,
      requiredAccuracy: PRECISION_METROS,
    });
    // Con la ubicación apagada, pedir la posición abre la ventana de Google para activarla: solo si la persona tocó el botón.
    if (!ultima && !pedir && !(await Location.hasServicesEnabledAsync()))
      return { tipo: 'fallo' };
    // Bajo techo, Android puede no responder nunca: sin un tope la pantalla se quedaría esperando.
    const { coords } =
      ultima ??
      (await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise<never>((_, rechazar) =>
          setTimeout(() => rechazar(new Error('sin respuesta')), TOPE_MS),
        ),
      ]));
    return { tipo: 'ok', lat: coords.latitude, lng: coords.longitude };
  } catch {
    return { tipo: 'fallo' };
  }
}

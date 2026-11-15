import * as Location from 'expo-location';
import type { PosicionEncuentro } from '@/api/cliente';

export type Ubicacion =
  | { tipo: 'ok'; lat: number; lng: number }
  /** `puedePedir: false`: Android ya no muestra el diálogo; queda ir a los ajustes. */
  | { tipo: 'sin_permiso'; puedePedir: boolean }
  | { tipo: 'fallo' };

const TOPE_MS = 15_000;
const VIGENCIA_MS = 60_000;
const PRECISION_METROS = 300;

/** Sin abrir ningún diálogo. */
export async function tienePermisoUbicacion(): Promise<boolean> {
  try {
    return (await Location.getForegroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

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
    const { coords } =
      ultima ?? (await posicionConTope(Location.Accuracy.Balanced));
    return { tipo: 'ok', lat: coords.latitude, lng: coords.longitude };
  } catch {
    return { tipo: 'fallo' };
  }
}

/**
 * Bajo techo, Android puede no responder nunca: sin un tope la pantalla se quedaría esperando.
 * ponytail: la petición al GPS no se puede cancelar; al vencer el tope Android la termina por su cuenta.
 */
async function posicionConTope(
  accuracy: Location.Accuracy,
): Promise<Location.LocationObject> {
  let tope: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    Location.getCurrentPositionAsync({ accuracy }),
    new Promise<never>((_, rechazar) => {
      tope = setTimeout(() => rechazar(new Error('sin respuesta')), TOPE_MS);
    }),
  ]).finally(() => clearTimeout(tope));
}

export type PosicionParaEncuentro =
  | { tipo: 'ok'; posicion: PosicionEncuentro }
  | { tipo: 'sin_permiso'; puedePedir: boolean }
  | { tipo: 'fallo' };

/** Una posición de hace ≤ 10 s y ≤ 50 m ya sirve: así el escaneo no espera al GPS (< 3 s, HU-22). */
const ENCUENTRO_VIGENCIA_MS = 10_000;
const ENCUENTRO_PRECISION_M = 50;

/**
 * Posición para el encuentro (HU-22 RN-4): con su precisión, la hora del GPS y la marca de ubicación simulada, tal
 * cual. El servidor decide si sirve; la app no filtra. Se llama tras un toque: puede abrir el diálogo de permiso.
 */
export async function posicionParaEncuentro(): Promise<PosicionParaEncuentro> {
  try {
    const permiso = await Location.requestForegroundPermissionsAsync();
    if (!permiso.granted)
      return { tipo: 'sin_permiso', puedePedir: permiso.canAskAgain };
    if (!(await Location.hasServicesEnabledAsync())) return { tipo: 'fallo' };
    const lectura =
      (await Location.getLastKnownPositionAsync({
        maxAge: ENCUENTRO_VIGENCIA_MS,
        requiredAccuracy: ENCUENTRO_PRECISION_M,
      })) ?? (await posicionConTope(Location.Accuracy.High));
    return {
      tipo: 'ok',
      posicion: {
        lat: lectura.coords.latitude,
        lng: lectura.coords.longitude,
        // Sin precisión informada no hay cómo saber si sirve: el servidor la rechaza (CA-12).
        precisionM: lectura.coords.accuracy ?? 100_000,
        tomadaEn: Math.round(lectura.timestamp),
        simulada: lectura.mocked === true,
      },
    };
  } catch {
    return { tipo: 'fallo' };
  }
}

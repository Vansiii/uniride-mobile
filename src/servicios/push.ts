import * as Notificaciones from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { registrarTokenPush } from '@/api/cliente';

/** PB-09: con la app abierta el aviso también se muestra (si no, Android lo descarta en silencio). */
Notificaciones.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type EstadoPush = 'activas' | 'denegadas' | 'no_disponibles';

/** Solo pantallas de la app: un aviso nunca abre una ruta arbitraria. */
const RUTAS = /^\/(reserva|viajes)\/[\w-]+$|^\/movimientos$/;

/**
 * Pide permiso (Android 13+ lo exige), crea el canal `avisos` y registra el token FCM en la API.
 * Nunca lanza: un fallo de avisos no rompe el inicio de sesión. `no_disponibles` = sin Firebase o sin red.
 */
export async function activarPush(): Promise<EstadoPush> {
  try {
    if (Platform.OS === 'android')
      await Notificaciones.setNotificationChannelAsync('avisos', {
        name: 'Reservas, viajes y pagos',
        importance: AndroidImportance.HIGH,
      });
    let { status } = await Notificaciones.getPermissionsAsync();
    if (status !== 'granted')
      ({ status } = await Notificaciones.requestPermissionsAsync());
    if (status !== 'granted') return 'denegadas';
    const { data } = await Notificaciones.getDevicePushTokenAsync();
    await registrarTokenPush(String(data));
    return 'activas';
  } catch {
    return 'no_disponibles';
  }
}

/** La ruta del aviso: en `data` (FCM en primer plano) o en el mensaje remoto (tocado desde la bandeja). */
export function rutaDeAviso(
  respuesta: Notificaciones.NotificationResponse,
): string | null {
  const { content, trigger } = respuesta.notification.request;
  const remoto = (trigger as { remoteMessage?: { data?: { ruta?: unknown } } })
    ?.remoteMessage;
  const ruta = content.data?.ruta ?? remoto?.data?.ruta;
  return typeof ruta === 'string' && RUTAS.test(ruta) ? ruta : null;
}

/** Mientras hay sesión: abre la pantalla del aviso tocado (también si abrió la app) y re-registra el token si FCM lo rota. */
export function useAvisosPush(conSesion: boolean) {
  useEffect(() => {
    if (!conSesion) return;
    void activarPush();
    const abrir = (r: Notificaciones.NotificationResponse | null) => {
      const ruta = r && rutaDeAviso(r);
      // Se olvida al usarla: volver a iniciar sesión no reabre un aviso viejo.
      Notificaciones.clearLastNotificationResponse();
      if (ruta) router.push(ruta as never);
    };
    abrir(Notificaciones.getLastNotificationResponse());
    const toque = Notificaciones.addNotificationResponseReceivedListener(abrir);
    const rotacion = Notificaciones.addPushTokenListener(({ data }) => {
      void registrarTokenPush(String(data)).catch(() => undefined);
    });
    return () => {
      toque.remove();
      rotacion.remove();
    };
  }, [conSesion]);
}

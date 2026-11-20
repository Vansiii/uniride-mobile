import * as Notificaciones from 'expo-notifications';
import { registrarTokenPush } from '@/api/cliente';
import { activarPush, rutaDeAviso } from '@/servicios/push';

jest.mock('@/api/cliente', () => ({
  registrarTokenPush: jest.fn().mockResolvedValue(undefined),
}));

const n = Notificaciones as jest.Mocked<typeof Notificaciones>;
const respuesta = (data: object, remoto?: object) =>
  ({
    notification: {
      request: {
        content: { data },
        trigger: remoto ? { remoteMessage: { data: remoto } } : null,
      },
    },
  }) as unknown as Notificaciones.NotificationResponse;

beforeEach(() => jest.clearAllMocks());

describe('PB-09 · activarPush', () => {
  it('con permiso: registra el token FCM en la API', async () => {
    await expect(activarPush()).resolves.toBe('activas');
    expect(n.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(registrarTokenPush).toHaveBeenCalledWith('token-fcm');
  });

  it('pide permiso si no lo tiene; si lo niega no registra nada', async () => {
    n.getPermissionsAsync.mockResolvedValueOnce({
      status: 'undetermined',
    } as never);
    n.requestPermissionsAsync.mockResolvedValueOnce({
      status: 'denied',
    } as never);
    await expect(activarPush()).resolves.toBe('denegadas');
    expect(n.requestPermissionsAsync).toHaveBeenCalled();
    expect(registrarTokenPush).not.toHaveBeenCalled();
  });

  it('sin Firebase o sin red: no lanza (el inicio de sesión sigue)', async () => {
    n.getDevicePushTokenAsync.mockRejectedValueOnce(new Error('sin FCM'));
    await expect(activarPush()).resolves.toBe('no_disponibles');
  });
});

describe('PB-09 · rutaDeAviso', () => {
  it('lee la ruta de data o del mensaje remoto de FCM', () => {
    expect(rutaDeAviso(respuesta({ ruta: '/reserva/abc-1' }))).toBe(
      '/reserva/abc-1',
    );
    expect(rutaDeAviso(respuesta({}, { ruta: '/viajes/v-9' }))).toBe(
      '/viajes/v-9',
    );
    expect(rutaDeAviso(respuesta({ ruta: '/movimientos' }))).toBe(
      '/movimientos',
    );
  });

  it('un aviso no abre rutas fuera de la lista ni enlaces externos', () => {
    for (const ruta of [
      'https://malo.test',
      '/recargar',
      '/reserva/../recargar',
      '//malo.test/x',
      42,
    ])
      expect(rutaDeAviso(respuesta({ ruta }))).toBeNull();
  });
});

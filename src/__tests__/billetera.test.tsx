import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import * as Portapapeles from 'expo-clipboard';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import BilleteraPantalla from '@/app/(pestanas)/billetera';
import { cerrarSesion } from '@/api/cliente';
import { ProveedorSesion } from '@/contexto/sesion';
import { ErrorKeystore, firmar } from '@/dispositivo/keystore';
import {
  billeteraReal as b,
  dispositivoReal as d,
  identidadReal as i,
  respuestasReales as r,
  simularFetch,
} from '@/pruebas/respuestasApi';

jest.mock('expo-router', () => {
  const { Text: Texto } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) => (
      <Texto>{`redirige:${href}`}</Texto>
    ),
    router: { push: jest.fn(), back: jest.fn() },
  };
});
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => 'refresco-de-prueba'),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('@/dispositivo/keystore', () => ({
  firmar: jest.fn(),
  nonceAleatorio: () => 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
  ErrorKeystore: class ErrorKeystore extends Error {
    codigo: string;
    constructor(codigo: string) {
      super(codigo);
      this.codigo = codigo;
    }
  },
}));

const firma = jest.mocked(firmar);
const copiar = jest.mocked(Portapapeles.setStringAsync);
const CON_SESION = {
  'POST /autenticacion/refrescar': r.sesionAprobada,
  'GET /yo': r.yoAprobada,
  'GET /identidad/estado': i.verificada,
  'GET /dispositivos/mi-dispositivo': d.vinculado,
};

const abrir = async (rutas: Parameters<typeof simularFetch>[0] = {}) => {
  const simulado = simularFetch({ ...CON_SESION, ...rutas });
  const pantalla = await render(
    <ProveedorSesion>
      <BilleteraPantalla />
    </ProveedorSesion>,
  );
  return { ...simulado, ...pantalla };
};
const lecturas = (llamadas: { ruta: string }[]) =>
  llamadas.filter((l) => l.ruta === 'GET /billetera/mia').length;
const reintentar = () => screen.getByRole('button', { name: 'Reintentar' });

beforeEach(async () => {
  jest.clearAllMocks();
  // El dispositivo de la sesión anterior no debe quedar en memoria entre pruebas.
  await cerrarSesion().catch(() => undefined);
  firma.mockResolvedValue('firma-de-prueba');
  copiar.mockResolvedValue(true);
});

describe('Billetera · CA-5: saldo, dirección y enlace', () => {
  it('muestra el saldo tal cual lo envía la API y la dirección acortada, con una sola huella', async () => {
    const { llamadas } = await abrir({ 'GET /billetera/mia': b.conSaldo });
    expect(await screen.findByText('Saldo disponible')).toBeTruthy();
    expect(screen.getByText(/12\.34/)).toBeTruthy();
    expect(screen.getByText('0x3021…6805')).toBeTruthy();
    // La dirección completa no se muestra, solo se copia.
    expect(screen.queryByText(b.direccion)).toBeNull();
    expect(screen.getByText('Saldo de prueba · sin valor real')).toBeTruthy();
    expect(lecturas(llamadas)).toBe(1);
    expect(firma).toHaveBeenCalledTimes(1);
  });

  it('el saldo es texto: no se convierte a número ("12.30" no pasa a "12.3")', async () => {
    await abrir({ 'GET /billetera/mia': b.enAmoy });
    expect(await screen.findByText(/12\.30/)).toBeTruthy();
    expect(screen.queryByText(/12\.3(?!0)/)).toBeNull();
  });

  it('la petición lleva la sesión y la firma del dispositivo (A-08)', async () => {
    const { falso } = await abrir({ 'GET /billetera/mia': b.conSaldo });
    await screen.findByText('Saldo disponible');
    const llamada = falso.mock.calls.find(([url]) =>
      String(url).endsWith('/billetera/mia'),
    );
    expect(llamada?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer acceso-de-prueba',
      'X-Dispositivo-Id': '0b6f1d3a-7c2e-4a55-9d21-5f8e3b9c4a10',
      'X-Firma': 'firma-de-prueba',
    });
  });

  it('copia la dirección completa y lo confirma a la vista', async () => {
    await abrir({ 'GET /billetera/mia': b.conSaldo });
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Copiar dirección completa' }),
    );
    expect(copiar).toHaveBeenCalledWith(b.direccion);
    expect(await screen.findByText('Dirección copiada.')).toBeTruthy();
  });

  it('si el portapapeles falla, lo dice y no finge que copió', async () => {
    copiar.mockRejectedValue(new Error('sin portapapeles'));
    await abrir({ 'GET /billetera/mia': b.conSaldo });
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Copiar dirección completa' }),
    );
    expect(await screen.findByText(/No pudimos copiar/)).toBeTruthy();
    expect(screen.queryByText('Dirección copiada.')).toBeNull();
  });

  it('con exploradorUrl null oculta el enlace', async () => {
    await abrir({ 'GET /billetera/mia': b.conSaldo });
    await screen.findByText('Saldo disponible');
    expect(screen.queryByText('Ver en el explorador')).toBeNull();
    expect(screen.queryByText(/Polygonscan/)).toBeNull();
  });

  it('con exploradorUrl muestra el enlace y lo abre', async () => {
    const abrirUrl = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(undefined as never);
    await abrir({ 'GET /billetera/mia': b.enAmoy });
    await fireEvent.press(
      await screen.findByRole('link', { name: 'Ver en el explorador' }),
    );
    expect(screen.getByText('Polygonscan · red de prueba Amoy')).toBeTruthy();
    expect(abrirUrl).toHaveBeenCalledWith(
      `https://amoy.polygonscan.com/address/${b.direccion}`,
    );
  });

  it('solo abre enlaces https', async () => {
    const abrirUrl = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(undefined as never);
    await abrir({
      'GET /billetera/mia': {
        estado: 200,
        cuerpo: {
          ...(b.conSaldo.cuerpo as object),
          exploradorUrl: 'javascript:alert(1)',
        },
      },
    });
    await fireEvent.press(
      await screen.findByRole('link', { name: 'Ver en el explorador' }),
    );
    expect(abrirUrl).not.toHaveBeenCalled();
  });
});

describe('Billetera · creación y lectura firmada', () => {
  it('sin billetera (404) la crea una sola vez con POST y la muestra', async () => {
    const { llamadas } = await abrir({
      'GET /billetera/mia': b.noEncontrada,
      'POST /billetera': b.creada,
    });
    expect(await screen.findByText('Saldo disponible')).toBeTruthy();
    expect(screen.getByText(/0\.00/)).toBeTruthy();
    expect(llamadas.filter((l) => l.ruta === 'POST /billetera')).toHaveLength(
      1,
    );
    // Dos huellas: la lectura y la creación; aceptable una sola vez.
    expect(firma).toHaveBeenCalledTimes(2);
  });

  it('carga al entrar y no vuelve a leer por cambios de foco o de pantalla', async () => {
    const { llamadas, rerender } = await abrir({
      'GET /billetera/mia': b.conSaldo,
    });
    await screen.findByText('Saldo disponible');
    await rerender(
      <ProveedorSesion>
        <BilleteraPantalla />
      </ProveedorSesion>,
    );
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 50));
    });
    expect(lecturas(llamadas)).toBe(1);
    expect(firma).toHaveBeenCalledTimes(1);
  });

  it('actualizar vuelve a leer y consulta la billetera otra vez', async () => {
    const { llamadas } = await abrir({ 'GET /billetera/mia': b.conSaldo });
    await screen.findByText('Saldo disponible');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Actualizar saldo' }),
    );
    await waitFor(() => expect(lecturas(llamadas)).toBe(2));
    expect(await screen.findByText('Saldo disponible')).toBeTruthy();
    expect(firma).toHaveBeenCalledTimes(2);
  });

  it('un toque en actualizar mientras la huella está en curso no abre una segunda lectura', async () => {
    // La huella tarda: la primera lectura sigue en curso cuando la persona toca actualizar.
    firma.mockImplementation(
      () => new Promise((resolver) => setTimeout(() => resolver('firma'), 150)),
    );
    const { llamadas } = await abrir({ 'GET /billetera/mia': b.conSaldo });
    await fireEvent.press(
      screen.getByRole('button', { name: 'Actualizar saldo' }),
    );
    expect(await screen.findByText('Saldo disponible')).toBeTruthy();
    expect(lecturas(llamadas)).toBe(1);
    expect(firma).toHaveBeenCalledTimes(1);
  });
});
describe('Billetera · estados', () => {
  it('identidad sin verificar: vista sin billetera con acceso a verificar, sin gastar una huella', async () => {
    await abrir({ 'GET /identidad/estado': i.sinVerificar });
    expect(
      await screen.findByText('Tu billetera se crea al verificar tu identidad'),
    ).toBeTruthy();
    expect(firma).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Verificar identidad' }),
    );
    expect(router.push).toHaveBeenCalledWith('/identidad');
    expect(screen.queryByText('Saldo disponible')).toBeNull();
  });

  it('403 IDENTIDAD_NO_VERIFICADA del servidor: la misma vista sin billetera', async () => {
    await abrir({ 'GET /billetera/mia': b.identidadNoVerificada });
    expect(
      await screen.findByText('Tu billetera se crea al verificar tu identidad'),
    ).toBeTruthy();
    expect(screen.queryByText('Saldo disponible')).toBeNull();
  });

  it('teléfono sin vincular: lleva a vincular sin pedir huella', async () => {
    await abrir({ 'GET /dispositivos/mi-dispositivo': d.sinDispositivo });
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Vincular mi teléfono' }),
    );
    expect(router.push).toHaveBeenCalledWith('/dispositivo');
    expect(firma).not.toHaveBeenCalled();
  });

  it('401 FIRMA_DISPOSITIVO_INVALIDA: lleva a vincular', async () => {
    await abrir({ 'GET /billetera/mia': b.firmaInvalida });
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Vincular mi teléfono' }),
    );
    expect(router.push).toHaveBeenCalledWith('/dispositivo');
    expect(screen.queryByText('Saldo disponible')).toBeNull();
  });

  it('403 CUENTA_SUSPENDIDA: su mensaje, sin datos y sin reintentar', async () => {
    await abrir({ 'GET /billetera/mia': b.cuentaSuspendida });
    expect(await screen.findByText(/cuenta está suspendida/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    expect(screen.queryByText('Saldo disponible')).toBeNull();
  });

  it('503: avisa y al reintentar vuelve a leer', async () => {
    const { llamadas } = await abrir({
      'GET /billetera/mia': [b.cadenaCaida, b.conSaldo],
    });
    expect(
      await screen.findByText(/No pudimos consultar tu saldo/),
    ).toBeTruthy();
    expect(screen.queryByText('Saldo disponible')).toBeNull();
    await fireEvent.press(reintentar());
    expect(await screen.findByText('Saldo disponible')).toBeTruthy();
    expect(screen.getByText(/12\.34/)).toBeTruthy();
    expect(lecturas(llamadas)).toBe(2);
  });

  it('PETICION_EXPIRADA: mensaje y, al reintentar, la lectura se firma de nuevo', async () => {
    const { llamadas } = await abrir({
      // El cliente reintenta una vez ante un 401 (renueva la sesión y firma otra vez): las dos primeras fallan.
      'GET /billetera/mia': [
        b.peticionExpirada,
        b.peticionExpirada,
        b.conSaldo,
      ],
    });
    expect(
      await screen.findByText(/comprobación de tu teléfono venció/),
    ).toBeTruthy();
    await fireEvent.press(reintentar());
    expect(await screen.findByText('Saldo disponible')).toBeTruthy();
    expect(lecturas(llamadas)).toBe(3);
  });
  it('huella cancelada: aviso tranquilo (no alarmante) con reintentar', async () => {
    firma.mockRejectedValueOnce(new ErrorKeystore('BIOMETRIA_CANCELADA'));
    await abrir({ 'GET /billetera/mia': b.conSaldo });
    expect(await screen.findByText(/Cancelaste la confirmación/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Saldo disponible')).toBeNull();
    await fireEvent.press(reintentar());
    expect(await screen.findByText('Saldo disponible')).toBeTruthy();
  });

  it('Keystore no disponible: su mensaje', async () => {
    firma.mockRejectedValue(new ErrorKeystore('KEYSTORE_NO_DISPONIBLE'));
    await abrir({ 'GET /billetera/mia': b.conSaldo });
    expect(
      await screen.findByText(/no puede usar la llave de seguridad/),
    ).toBeTruthy();
    expect(screen.queryByText('Saldo disponible')).toBeNull();
  });

  it('sin conexión: mensaje común y reintentar', async () => {
    // Sin respuesta simulada para la ruta, etch falla como una caída de red.
    await abrir();
    expect(await screen.findByText(/No hay conexión/)).toBeTruthy();
    expect(reintentar()).toBeTruthy();
  });

  it('sin sesión no pide nada de la billetera ni muestra datos', async () => {
    const { llamadas } = await abrir({
      'POST /autenticacion/refrescar': { estado: 401, cuerpo: {} },
    });
    expect(await screen.findByText('redirige:/iniciar-sesion')).toBeTruthy();
    expect(llamadas.filter((l) => l.ruta.includes('billetera'))).toHaveLength(
      0,
    );
    expect(llamadas.filter((l) => l.ruta.includes('identidad'))).toHaveLength(
      0,
    );
    expect(firma).not.toHaveBeenCalled();
  });
});

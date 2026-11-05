import { fireEvent, render, screen } from '@testing-library/react-native';
import DispositivoPantalla from '@/app/dispositivo';
import { ProveedorSesion } from '@/contexto/sesion';
import {
  crearLlave,
  ErrorKeystore,
  pedirTokenIntegridad,
} from '@/dispositivo/keystore';
import {
  dispositivoReal as d,
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
jest.mock('expo-device', () => ({ modelName: 'Pixel 8' }));
jest.mock('@/dispositivo/keystore', () => ({
  crearLlave: jest.fn(),
  pedirTokenIntegridad: jest.fn(),
  ErrorKeystore: class ErrorKeystore extends Error {
    codigo: string;
    constructor(codigo: string) {
      super(codigo);
      this.codigo = codigo;
    }
  },
}));

const llave = jest.mocked(crearLlave);
const integridad = jest.mocked(pedirTokenIntegridad);
const PEM = '-----BEGIN PUBLIC KEY-----\nMFkw\n-----END PUBLIC KEY-----';
const CON_SESION = {
  'POST /autenticacion/refrescar': r.sesionAprobada,
  'GET /yo': r.yoAprobada,
};

const abrir = async (rutas: Parameters<typeof simularFetch>[0]) => {
  const simulado = simularFetch({
    ...CON_SESION,
    'GET /dispositivos/mi-dispositivo': d.sinDispositivo,
    ...rutas,
  });
  await render(
    <ProveedorSesion>
      <DispositivoPantalla />
    </ProveedorSesion>,
  );
  return simulado;
};
const vincular = async () => {
  await screen.findByRole('button', { name: 'Vincular este teléfono' });
  await fireEvent.press(
    screen.getByRole('button', { name: 'Vincular este teléfono' }),
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  llave.mockResolvedValue(PEM);
  integridad.mockResolvedValue('token-de-play-integrity');
});

describe('Vinculación de dispositivo', () => {
  it('CA-1: pide el desafío, crea la llave, atesta con ese desafío y envía solo la llave pública', async () => {
    const { llamadas } = await abrir({
      'POST /dispositivos/desafio-atestacion': d.desafio,
      'POST /dispositivos/vincular': d.vinculadoOk,
      'GET /dispositivos/mi-dispositivo': [d.sinDispositivo, d.vinculado],
    });
    await vincular();
    expect(
      await screen.findByText('Tu teléfono quedó vinculado.'),
    ).toBeTruthy();
    expect(screen.getByText('Pixel 8')).toBeTruthy();
    expect(integridad).toHaveBeenCalledWith('ZGVzYWZpby1kZS1wcnVlYmE');
    const envio = llamadas.find(
      (l) => l.ruta === 'POST /dispositivos/vincular',
    );
    expect(envio?.cuerpo).toEqual({
      desafio: 'ZGVzYWZpby1kZS1wcnVlYmE',
      tokenIntegridad: 'token-de-play-integrity',
      llavePublicaPem: PEM,
      modelo: 'Pixel 8',
    });
    // Ya vinculado no se ofrece vincular de nuevo (CA-6).
    expect(
      screen.queryByRole('button', { name: 'Vincular este teléfono' }),
    ).toBeNull();
  });

  it('CA-2: un teléfono no íntegro se rechaza con un mensaje claro y no queda vinculado', async () => {
    await abrir({
      'POST /dispositivos/desafio-atestacion': d.desafio,
      'POST /dispositivos/vincular': d.noIntegro,
    });
    await vincular();
    expect(
      await screen.findByText(
        /no pudimos comprobar que este teléfono es original/i,
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Tu teléfono quedó vinculado.')).toBeNull();
  });

  it('CA-6: si la cuenta ya tiene un teléfono, muestra el existente y no deja vincular otro', async () => {
    await abrir({ 'GET /dispositivos/mi-dispositivo': d.vinculado });
    expect(await screen.findByText('Pixel 8')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Vincular este teléfono' }),
    ).toBeNull();
  });

  it('CA-6: si otra sesión lo vinculó antes, avisa y muestra el que quedó', async () => {
    await abrir({
      'POST /dispositivos/desafio-atestacion': d.desafio,
      'POST /dispositivos/vincular': d.yaVinculado,
      'GET /dispositivos/mi-dispositivo': [d.sinDispositivo, d.vinculado],
    });
    await vincular();
    expect(
      await screen.findByText('Tu cuenta ya tiene un teléfono vinculado.'),
    ).toBeTruthy();
    expect(await screen.findByText('Pixel 8')).toBeTruthy();
  });

  it('CA-7: si la persona cancela la biometría no se envía nada al servidor', async () => {
    llave.mockRejectedValue(new ErrorKeystore('BIOMETRIA_CANCELADA'));
    const { llamadas } = await abrir({
      'POST /dispositivos/desafio-atestacion': d.desafio,
    });
    await vincular();
    expect(
      await screen.findByText(/Cancelaste la verificación biométrica/),
    ).toBeTruthy();
    expect(llamadas.some((l) => l.ruta === 'POST /dispositivos/vincular')).toBe(
      false,
    );
  });

  it('sin módulo de Keystore falla de forma segura, sin enviar nada', async () => {
    llave.mockRejectedValue(new ErrorKeystore('KEYSTORE_NO_DISPONIBLE'));
    const { llamadas } = await abrir({
      'POST /dispositivos/desafio-atestacion': d.desafio,
    });
    await vincular();
    expect(
      await screen.findByText(/todavía no puede vincular el teléfono/),
    ).toBeTruthy();
    expect(llamadas.some((l) => l.ruta === 'POST /dispositivos/vincular')).toBe(
      false,
    );
  });

  it('si no puede consultar el estado ofrece reintentar y no vincular a ciegas', async () => {
    simularFetch({ ...CON_SESION });
    await render(
      <ProveedorSesion>
        <DispositivoPantalla />
      </ProveedorSesion>,
    );
    expect(
      await screen.findByRole('button', { name: 'Reintentar' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Vincular este teléfono' }),
    ).toBeNull();
  });
});

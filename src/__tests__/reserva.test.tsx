import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Linking } from 'react-native';
import ReservaPantalla from '@/app/reserva/[id]';
import { cerrarSesion } from '@/api/cliente';
import { ProveedorSesion } from '@/contexto/sesion';
import {
  reservaReal as rr,
  respuestasReales as r,
  simularFetch,
} from '@/pruebas/respuestasApi';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

jest.mock('expo-router', () => {
  const { Text: Texto } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) => (
      <Texto>{`redirige:${href}`}</Texto>
    ),
    router: {
      push: (...a: unknown[]) => mockRouter.push(...a),
      replace: (...a: unknown[]) => mockRouter.replace(...a),
      back: () => mockRouter.back(),
    },
    useLocalSearchParams: () => ({
      id: '0a48bcec-9aa1-4dbf-a192-be3d560e148a',
    }),
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

const CONSULTAR = `GET /reservas/${rr.reservaId}`;
const veces = (llamadas: { ruta: string }[], ruta: string) =>
  llamadas.filter((l) => l.ruta === ruta).length;
const boton = (name: string | RegExp) => screen.getByRole('button', { name });

async function abrir(rutas: Parameters<typeof simularFetch>[0]) {
  const simulado = simularFetch({
    'POST /autenticacion/refrescar': r.sesionAprobada,
    'GET /yo': r.yoAprobada,
    ...rutas,
  });
  await render(
    <ProveedorSesion>
      <ReservaPantalla />
    </ProveedorSesion>,
  );
  return simulado;
}

/** Hace correr el reloj y los `fetch` que dispare. */
const avanzar = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

beforeEach(async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  jest.clearAllMocks();
  await cerrarSesion().catch(() => undefined);
  jest.useFakeTimers({
    doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
    now: Date.parse('2099-03-10T09:00:00.000Z'),
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('HU-19 · resultado de la reserva', () => {
  it('pendiente: dice que el asiento ya está apartado y consulta hasta que se confirma', async () => {
    const { llamadas } = await abrir({
      [CONSULTAR]: [rr.pendiente, rr.confirmada],
    });
    expect(
      await screen.findByText('Dejando tu pasaje en garantía'),
    ).toBeTruthy();
    expect(screen.getByText('Pendiente')).toBeTruthy();
    expect(screen.getByText(/Tu asiento ya está apartado/)).toBeTruthy();
    expect(screen.getAllByText(/10,50 URC/).length).toBeGreaterThan(0);

    await avanzar(3000);
    expect(await screen.findByText('Reserva confirmada')).toBeTruthy();
    expect(screen.getByText('Confirmada')).toBeTruthy();
    expect(
      screen.getByText(/quedó en garantía\. Se le paga al conductor solo/),
    ).toBeTruthy();
    const consultas = veces(llamadas, CONSULTAR);
    // Confirmada: ya no se vuelve a preguntar.
    await avanzar(10_000);
    expect(veces(llamadas, CONSULTAR)).toBe(consultas);
  });

  it('muestra el viaje, el conductor y lo que quedó en garantía', async () => {
    await abrir({ [CONSULTAR]: rr.confirmada });
    expect(await screen.findByText('Reserva confirmada')).toBeTruthy();
    expect(screen.getByText('Av. Busch')).toBeTruthy();
    expect(screen.getByText('UAGRM, Módulos')).toBeTruthy();
    expect(screen.getByText('Carlos')).toBeTruthy();
    expect(screen.getByText('En garantía')).toBeTruthy();
    expect(screen.getByText('10,50 URC')).toBeTruthy();
  });

  it('con el nodo lento avisa que seguimos intentando, sin pedir nada a la persona', async () => {
    await abrir({ [CONSULTAR]: rr.pendiente });
    await screen.findByText('Dejando tu pasaje en garantía');
    expect(screen.queryByText(/La red de pagos tarda/)).toBeNull();
    await avanzar(31_000);
    expect(
      screen.getByText(/La red de pagos tarda más de lo normal/),
    ).toBeTruthy();
  });

  it('CA-12: no se completó: no se descontó nada, el asiento quedó libre y se puede intentar otra vez', async () => {
    await abrir({ [CONSULTAR]: rr.fallida });
    expect(await screen.findByText('No se completó tu reserva')).toBeTruthy();
    expect(screen.getByText('No se completó')).toBeTruthy();
    expect(screen.getByText(/No se descontó nada de tu saldo/)).toBeTruthy();
    await fireEvent.press(boton('Intentar otra vez'));
    expect(mockRouter.replace).toHaveBeenCalledWith(`/viajes/${rr.viajeId}`);
  });

  it('con una reserva confirmada ofrece ver la transacción solo si hay explorador', async () => {
    const abrirUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue();
    await abrir({
      [CONSULTAR]: {
        ...rr.confirmada,
        cuerpo: {
          ...(rr.confirmada.cuerpo as object),
          exploradorUrl: `https://amoy.polygonscan.com/tx/${rr.hashTx}`,
        },
      },
    });
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Ver la transacción' }),
    );
    expect(abrirUrl).toHaveBeenCalledWith(
      `https://amoy.polygonscan.com/tx/${rr.hashTx}`,
    );
  });

  it('sin explorador (Hardhat) no ofrece el enlace', async () => {
    await abrir({ [CONSULTAR]: rr.confirmada });
    await screen.findByText('Reserva confirmada');
    expect(
      screen.queryByRole('button', { name: 'Ver la transacción' }),
    ).toBeNull();
  });

  it('Ver mis viajes y cerrar llevan a la pestaña', async () => {
    await abrir({ [CONSULTAR]: rr.confirmada });
    await screen.findByText('Reserva confirmada');
    await fireEvent.press(boton('Ver mis viajes'));
    await fireEvent.press(boton('Cerrar'));
    expect(mockRouter.replace).toHaveBeenNthCalledWith(1, '/viajes');
    expect(mockRouter.replace).toHaveBeenNthCalledWith(2, '/viajes');
  });

  it('HU-22: confirmada, ofrece escanear el código del conductor', async () => {
    await abrir({ [CONSULTAR]: rr.confirmada });
    await screen.findByText('Reserva confirmada');
    await fireEvent.press(boton('Escanear código del conductor'));
    expect(mockRouter.push).toHaveBeenCalledWith(
      `/abordaje/escanear/${rr.reservaId}`,
    );
  });

  it('una reserva que no es tuya o no existe se dice sin códigos, con reintentar', async () => {
    await abrir({ [CONSULTAR]: rr.noEncontrada });
    expect(
      await screen.findByText('No encontramos esta reserva.'),
    ).toBeTruthy();
    expect(boton('Reintentar')).toBeTruthy();
  });

  it('sin conexión lo dice y vuelve a preguntar solo: la reserva no se pierde', async () => {
    const { llamadas } = await abrir({});
    expect(await screen.findByText(/No hay conexión/)).toBeTruthy();
    const antes = veces(llamadas, CONSULTAR);
    await avanzar(3000);
    expect(veces(llamadas, CONSULTAR)).toBeGreaterThan(antes);
  });

  it('sin sesión lleva a iniciar sesión', async () => {
    simularFetch({
      'POST /autenticacion/refrescar': {
        estado: 401,
        cuerpo: { codigo: 'SESION_EXPIRADA' },
      },
    });
    await render(
      <ProveedorSesion>
        <ReservaPantalla />
      </ProveedorSesion>,
    );
    expect(await screen.findByText('redirige:/iniciar-sesion')).toBeTruthy();
  });
});

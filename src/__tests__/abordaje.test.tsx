import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { AccessibilityInfo } from 'react-native';
import MostrarCodigoPantalla from '@/app/abordaje/mostrar/[viajeId]';
import { cerrarSesion } from '@/api/cliente';
import { ProveedorSesion } from '@/contexto/sesion';
import {
  crearLlaveTrayecto,
  firmar,
  firmarTrayecto,
  pedirTokenIntegridad,
} from '@/dispositivo/keystore';
import {
  dispositivoReal as d,
  presenciaReal as p,
  reservaReal as rr,
  respuestasReales as r,
  simularFetch,
} from '@/pruebas/respuestasApi';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockParametros: { valor: Record<string, string> } = { valor: {} };

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
    useLocalSearchParams: () => mockParametros.valor,
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
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3, High: 4 },
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock('@/dispositivo/keystore', () => ({
  firmar: jest.fn(),
  firmarTrayecto: jest.fn(),
  crearLlaveTrayecto: jest.fn(),
  pedirTokenIntegridad: jest.fn(),
  fallaDeLlave: jest.requireActual('@/dispositivo/keystore').fallaDeLlave,
  nonceAleatorio: () => 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
  ErrorKeystore: class ErrorKeystore extends Error {
    codigo: string;
    constructor(codigo: string) {
      super(codigo);
      this.codigo = codigo;
    }
  },
}));

const VIAJE = rr.viajeId;
const LLAVE = `POST /viajes/${VIAJE}/llave-trayecto`;
const DESAFIO = `POST /viajes/${VIAJE}/desafios`;
const PASAJEROS = `GET /viajes/${VIAJE}/pasajeros`;
const BASE = {
  'POST /autenticacion/refrescar': r.sesionAprobada,
  'GET /yo': r.yoAprobada,
  'GET /dispositivos/mi-dispositivo': d.vinculado,
  [LLAVE]: p.llave,
  [DESAFIO]: p.desafio,
  [PASAJEROS]: rr.pasajeros,
};
const MOSTRAR = 'Mostrar código';
const ubicacion = jest.mocked(Location);
const POSICION = {
  coords: { latitude: -17.7833, longitude: -63.1821, accuracy: 9 },
  timestamp: 1_763_130_000_000,
  mocked: false,
};
const veces = (llamadas: { ruta: string }[], ruta: string) =>
  llamadas.filter((l) => l.ruta === ruta).length;
const boton = (name: string | RegExp) => screen.getByRole('button', { name });

async function abrirConductor(rutas: Parameters<typeof simularFetch>[0] = {}) {
  mockParametros.valor = { viajeId: VIAJE };
  const simulado = simularFetch({ ...BASE, ...rutas });
  await render(
    <ProveedorSesion>
      <MostrarCodigoPantalla />
    </ProveedorSesion>,
  );
  await screen.findByText(/Tus pasajeros escanean este código/);
  return simulado;
}

beforeEach(async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  jest.clearAllMocks();
  await cerrarSesion().catch(() => undefined);
  jest.mocked(firmar).mockResolvedValue({ firma: 'firma-huella', marca: '1' });
  jest
    .mocked(firmarTrayecto)
    .mockResolvedValue({ firma: 'firma-trayecto', marca: '2' });
  jest.mocked(crearLlaveTrayecto).mockResolvedValue('PEM-TRAYECTO');
  jest
    .mocked(pedirTokenIntegridad)
    .mockImplementation(async (n) => `simulado:${n}`);
  ubicacion.requestForegroundPermissionsAsync.mockResolvedValue({
    granted: true,
    canAskAgain: true,
  } as never);
  ubicacion.hasServicesEnabledAsync.mockResolvedValue(true);
  ubicacion.getLastKnownPositionAsync.mockResolvedValue(POSICION as never);
});

describe('HU-22 · «Mostrar código» del conductor (CA-1)', () => {
  it('una huella registra la llave de trayecto con integridad atada al X-Nonce, y muestra QR, cuenta y pasajeros', async () => {
    const { llamadas, falso } = await abrirConductor();
    expect(firmar).not.toHaveBeenCalled();
    await fireEvent.press(boton(MOSTRAR));
    expect(await screen.findByLabelText('Código QR de abordaje')).toBeTruthy();

    expect(firmar).toHaveBeenCalledTimes(1);
    expect(jest.mocked(firmar).mock.calls[0][2]).toEqual({
      titulo: 'Confirma que eres el conductor',
      subtitulo: 'Para mostrar el código de abordaje',
    });
    const [, init] = falso.mock.calls.find(([u]) =>
      String(u).endsWith('/llave-trayecto'),
    ) as [string, RequestInit];
    const nonce = (init.headers as Record<string, string>)['X-Nonce'];
    expect(llamadas.find((l) => l.ruta === LLAVE)?.cuerpo).toEqual({
      llavePublicaPem: 'PEM-TRAYECTO',
      tokenIntegridad: `simulado:${nonce}`,
    });
    // RN-8: el código lo pide la llave de trayecto, con la posición tal cual la dio el GPS.
    expect(llamadas.find((l) => l.ruta === DESAFIO)?.cuerpo).toEqual({
      tipo: 'abordaje',
      posicion: {
        lat: -17.7833,
        lng: -63.1821,
        precisionM: 9,
        tomadaEn: 1_763_130_000_000,
        simulada: false,
      },
    });
    const [, envioDesafio] = falso.mock.calls.find(([u]) =>
      String(u).endsWith('/desafios'),
    ) as [string, RequestInit];
    expect(
      (envioDesafio.headers as Record<string, string>)['X-Llave-Trayecto-Id'],
    ).toBe(p.llaveTrayectoId);
    expect(screen.getByText('Nuevo código en 25 s')).toBeTruthy();
    expect(screen.getByText('Prueba')).toBeTruthy();
    expect(screen.getByText('Esperando')).toBeTruthy();
    expect(screen.queryByRole('button', { name: MOSTRAR })).toBeNull();
  });

  it('el código se renueva solo a los 25 s, sin otra huella (RN-6), y deja de pedir al salir', async () => {
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
    });
    try {
      const { llamadas } = await abrirConductor({
        [DESAFIO]: [p.desafio, p.otroDesafio],
      });
      await fireEvent.press(boton(MOSTRAR));
      await screen.findByLabelText('Código QR de abordaje');
      await act(async () => {
        await jest.advanceTimersByTimeAsync(10_000);
      });
      expect(screen.getByText('Nuevo código en 15 s')).toBeTruthy();
      expect(veces(llamadas, DESAFIO)).toBe(1);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(15_000);
      });
      expect(veces(llamadas, DESAFIO)).toBe(2);
      expect(firmar).toHaveBeenCalledTimes(1);
      expect(firmarTrayecto).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Nuevo código en 25 s')).toBeTruthy();

      await screen.unmount();
      const antes = llamadas.length;
      await act(async () => {
        await jest.advanceTimersByTimeAsync(60_000);
      });
      expect(llamadas).toHaveLength(antes);
    } finally {
      jest.useRealTimers();
    }
  });

  it('un escaneo aceptado gasta el código: se ve «Verificado ✓» y sale otro enseguida (RN-1)', async () => {
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
    });
    try {
      const { llamadas } = await abrirConductor({
        [DESAFIO]: [p.desafio, p.desafioAbordado],
        [PASAJEROS]: p.pasajerosAbordados,
      });
      await fireEvent.press(boton(MOSTRAR));
      await screen.findByLabelText('Código QR de abordaje');
      await act(async () => {
        await jest.advanceTimersByTimeAsync(3_000);
      });
      expect(veces(llamadas, DESAFIO)).toBe(2);
      expect(screen.getByText('Verificado ✓')).toBeTruthy();
      expect(firmar).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('fuera de la ventana no hay código y dice desde y hasta cuándo (CA-11)', async () => {
    const { llamadas } = await abrirConductor({ [LLAVE]: p.fueraDeVentana });
    await fireEvent.press(boton(MOSTRAR));
    expect(
      await screen.findByText(/^El código se puede mostrar de .+ a .+\.$/),
    ).toBeTruthy();
    expect(veces(llamadas, DESAFIO)).toBe(0);
    expect(boton(MOSTRAR)).toBeTruthy();
  });

  it('sin permiso de ubicación no pide huella ni llama al servidor, y lleva a los ajustes', async () => {
    ubicacion.requestForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    } as never);
    const { llamadas } = await abrirConductor();
    await fireEvent.press(boton(MOSTRAR));
    expect(
      await screen.findByText(/necesita tu ubicación para verificar/),
    ).toBeTruthy();
    expect(boton('Abrir ajustes')).toBeTruthy();
    expect(firmar).not.toHaveBeenCalled();
    expect(veces(llamadas, LLAVE)).toBe(0);
  });

  it('con la ubicación apagada, el aviso reemplaza el QR (spec §4)', async () => {
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
    });
    try {
      await abrirConductor();
      await fireEvent.press(boton(MOSTRAR));
      await screen.findByLabelText('Código QR de abordaje');
      ubicacion.hasServicesEnabledAsync.mockResolvedValue(false);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(25_000);
      });
      expect(
        screen.getByText('Activa tu ubicación para verificar el abordaje.'),
      ).toBeTruthy();
      expect(screen.queryByLabelText('Código QR de abordaje')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('si la llave de trayecto dejó de valer, pide otra huella (HU-10 CA-9)', async () => {
    await abrirConductor({ [DESAFIO]: p.firmaTrayecto });
    await fireEvent.press(boton(MOSTRAR));
    expect(
      await screen.findByText(/dejó de renovarse. Confirma otra vez/),
    ).toBeTruthy();
    expect(boton(MOSTRAR)).toBeTruthy();
  });

  it('un GPS simulado del conductor no muestra código (CA-6)', async () => {
    await abrirConductor({ [DESAFIO]: p.simulada });
    await fireEvent.press(boton(MOSTRAR));
    expect(
      await screen.findByText(/No pudimos confirmar tu ubicación/),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Código QR de abordaje')).toBeNull();
    expect(boton('Reintentar')).toBeTruthy();
  });
});

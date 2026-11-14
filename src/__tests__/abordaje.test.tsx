import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { AccessibilityInfo } from 'react-native';
import EscanearCodigoPantalla from '@/app/abordaje/escanear/[reservaId]';
import MostrarCodigoPantalla from '@/app/abordaje/mostrar/[viajeId]';
import { cerrarSesion } from '@/api/cliente';
import { ProveedorSesion } from '@/contexto/sesion';
import {
  crearLlaveTrayecto,
  firmar,
  firmarTrayecto,
  pedirTokenIntegridad,
} from '@/dispositivo/keystore';
import { yaAbordo } from '@/viajes/abordaje';
import {
  dispositivoReal as d,
  presenciaReal as p,
  reservaReal as rr,
  respuestasReales as r,
  simularFetch,
  viajeReal as vj,
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
// La cámara: la prueba «lee» un código llamando a lo que la pantalla le pasó.
const mockCamara: {
  permiso: { granted: boolean; canAskAgain: boolean } | null;
  pedir: jest.Mock;
  leer?: (r: { data: string }) => void;
} = { permiso: null, pedir: jest.fn() };
jest.mock('expo-camera', () => ({
  useCameraPermissions: () => [mockCamara.permiso, mockCamara.pedir],
  CameraView: ({
    onBarcodeScanned,
  }: {
    onBarcodeScanned?: (r: { data: string }) => void;
  }) => {
    mockCamara.leer = onBarcodeScanned;
    return null;
  },
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
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

  it('sin teléfono vinculado pide vincularlo y lleva a «Mi teléfono», sin registrar llave', async () => {
    const { llamadas } = await abrirConductor({
      'GET /dispositivos/mi-dispositivo': d.sinDispositivo,
    });
    await fireEvent.press(boton(MOSTRAR));
    expect(
      await screen.findByText(
        /^Vincula este teléfono para verificar el abordaje/,
      ),
    ).toBeTruthy();
    await fireEvent.press(boton('Vincular mi teléfono'));
    expect(mockRouter.push).toHaveBeenCalledWith('/dispositivo');
    expect(veces(llamadas, LLAVE)).toBe(0);
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

const RESERVA = rr.reservaId;
const ABORDAJE = `POST /reservas/${RESERVA}/abordaje`;
const BASE_PASAJERO = {
  'POST /autenticacion/refrescar': r.sesionAprobada,
  'GET /yo': r.yoAprobada,
  'GET /dispositivos/mi-dispositivo': d.vinculado,
  [`GET /reservas/${RESERVA}`]: rr.confirmada,
  [`GET /viajes/${VIAJE}`]: vj.detalle,
  [ABORDAJE]: p.abordada,
};
const QR = `uniride://encuentro/${p.nonce}`;

async function abrirPasajero(rutas: Parameters<typeof simularFetch>[0] = {}) {
  mockParametros.valor = { reservaId: RESERVA };
  const simulado = simularFetch({ ...BASE_PASAJERO, ...rutas });
  await render(
    <ProveedorSesion>
      <EscanearCodigoPantalla />
    </ProveedorSesion>,
  );
  await screen.findByText('Vehículo con placa 3021 KLM');
  return simulado;
}

const leer = async (data: string) => {
  await act(async () => {
    mockCamara.leer?.({ data });
  });
};

describe('HU-22 · «Escanear QR» del pasajero (CA-2)', () => {
  beforeEach(() => {
    mockCamara.permiso = { granted: true, canAskAgain: true };
    mockCamara.leer = undefined;
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  });

  it('dice a quién apuntar y la placa; al leer el código pide una huella y envía código, posición, integridad y llave', async () => {
    const { llamadas, falso } = await abrirPasajero();
    expect(
      screen.getByText('Apunta al código del teléfono de Carlos'),
    ).toBeTruthy();
    expect(firmar).not.toHaveBeenCalled();

    await leer(QR);
    expect(await screen.findByText('Abordaje verificado')).toBeTruthy();
    expect(screen.getByText(/Tu viaje está en curso/)).toBeTruthy();

    expect(firmar).toHaveBeenCalledTimes(1);
    expect(jest.mocked(firmar).mock.calls[0][2]).toEqual({
      titulo: 'Confirma tu abordaje',
      subtitulo: 'Verificamos que estás junto al conductor',
    });
    const [, init] = falso.mock.calls.find(([u]) =>
      String(u).endsWith('/abordaje'),
    ) as [string, RequestInit];
    const nonceFirma = (init.headers as Record<string, string>)['X-Nonce'];
    // RN-8: nunca viaja un estado; el servidor lo decide.
    expect(llamadas.find((l) => l.ruta === ABORDAJE)?.cuerpo).toEqual({
      nonce: p.nonce,
      posicion: {
        lat: -17.7833,
        lng: -63.1821,
        precisionM: 9,
        tomadaEn: 1_763_130_000_000,
        simulada: false,
      },
      tokenIntegridad: `simulado:${nonceFirma}`,
      llavePublicaTrayectoPem: 'PEM-TRAYECTO',
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Abordaje verificado',
    );
    await fireEvent.press(boton('Ver mis viajes'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/viajes');
  });

  it('sin teléfono vinculado pide vincularlo y lleva a «Mi teléfono»', async () => {
    await abrirPasajero({
      'GET /dispositivos/mi-dispositivo': d.sinDispositivo,
    });
    await leer(QR);
    expect(
      await screen.findByText(
        /^Vincula este teléfono para verificar el abordaje/,
      ),
    ).toBeTruthy();
    await fireEvent.press(boton('Vincular mi teléfono'));
    expect(mockRouter.push).toHaveBeenCalledWith('/dispositivo');
  });

  it('la cámara entrega el mismo código muchas veces: se envía una sola vez', async () => {
    const { llamadas } = await abrirPasajero();
    const lectura = mockCamara.leer;
    await act(async () => {
      lectura?.({ data: QR });
      lectura?.({ data: QR });
      lectura?.({ data: QR });
    });
    await screen.findByText('Abordaje verificado');
    expect(veces(llamadas, ABORDAJE)).toBe(1);
    expect(firmar).toHaveBeenCalledTimes(1);
  });

  it('un QR que no es de UniRide no pide huella ni llama al servidor', async () => {
    const { llamadas } = await abrirPasajero();
    await leer('https://ejemplo.com/uniride://encuentro/x');
    expect(
      screen.getByText('Ese no es un código de abordaje de UniRide.'),
    ).toBeTruthy();
    expect(firmar).not.toHaveBeenCalled();
    expect(veces(llamadas, ABORDAJE)).toBe(0);
  });

  it.each([
    [
      'CA-3/CA-4 código usado o vencido',
      p.codigoInvalido,
      /^Ese código ya no sirve/,
    ],
    ['CA-5 lejos', p.distancia, /más de 50 m del conductor \(a 61 m\)/],
    ['CA-6 GPS simulado', p.simulada, /^No pudimos confirmar tu ubicación/],
    [
      'CA-7 integridad, sin detalle técnico',
      p.noIntegro,
      /^Este teléfono no puede verificar viajes\.$/,
    ],
    [
      'CA-9 sin reserva',
      p.sinReserva,
      /^No tienes una reserva en este viaje\.$/,
    ],
  ])(
    '%s: dice qué pasó, vibra y deja volver a escanear',
    async (_, respuesta, texto) => {
      await abrirPasajero({ [ABORDAJE]: respuesta });
      await leer(QR);
      expect(await screen.findByText(texto)).toBeTruthy();
      expect(screen.queryByText('Abordaje verificado')).toBeNull();
      expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');
      mockCamara.leer = undefined;
      await fireEvent.press(boton('Volver a escanear'));
      expect(mockCamara.leer).toBeDefined();
    },
  );

  it('CA-14: si ya estaba abordada lo dice, sin otro resultado', async () => {
    await abrirPasajero({ [ABORDAJE]: p.yaAbordada });
    await leer(QR);
    expect(
      await screen.findByText('Tu abordaje ya estaba verificado.'),
    ).toBeTruthy();
  });

  it('sin conexión nada se da por verificado y se puede reintentar', async () => {
    const { falso } = await abrirPasajero();
    falso.mockImplementationOnce(async () => {
      throw new TypeError('Network request failed');
    });
    await leer(QR);
    expect(
      await screen.findByText(/^Sin conexión\. El código sigue/),
    ).toBeTruthy();
    expect(screen.queryByText('Abordaje verificado')).toBeNull();
    expect(boton('Volver a escanear')).toBeTruthy();
  });

  it('cancelar la huella no envía nada', async () => {
    const { ErrorKeystore } = jest.requireMock('@/dispositivo/keystore');
    jest
      .mocked(firmar)
      .mockRejectedValueOnce(new ErrorKeystore('BIOMETRIA_CANCELADA'));
    const { llamadas } = await abrirPasajero();
    await leer(QR);
    expect(await screen.findByText('No se confirmó tu abordaje.')).toBeTruthy();
    expect(veces(llamadas, ABORDAJE)).toBe(0);
  });

  it('sin permiso de cámara lo explica y lo pide; si Android ya no pregunta, lleva a los ajustes', async () => {
    mockCamara.permiso = { granted: false, canAskAgain: true };
    await abrirPasajero();
    expect(
      screen.getByText(/necesita la cámara para leer el código/),
    ).toBeTruthy();
    expect(mockCamara.leer).toBeUndefined();
    await fireEvent.press(boton('Permitir cámara'));
    expect(mockCamara.pedir).toHaveBeenCalled();

    mockCamara.permiso = { granted: false, canAskAgain: false };
    await screen.rerender(
      <ProveedorSesion>
        <EscanearCodigoPantalla />
      </ProveedorSesion>,
    );
    expect(boton('Abrir ajustes')).toBeTruthy();
  });

  it('sin ubicación no pide huella (spec §4)', async () => {
    ubicacion.hasServicesEnabledAsync.mockResolvedValue(false);
    const { llamadas } = await abrirPasajero();
    await leer(QR);
    expect(
      await screen.findByText(
        'Activa tu ubicación para verificar el abordaje.',
      ),
    ).toBeTruthy();
    expect(firmar).not.toHaveBeenCalled();
    expect(veces(llamadas, ABORDAJE)).toBe(0);
    await waitFor(() => expect(boton('Volver a escanear')).toBeTruthy());
  });
});

describe('HU-22 · estado de cada pasajero en «Mostrar código»', () => {
  it('solo cuentan como verificados los que pasaron el abordaje, no una verificación fallida', () => {
    expect(['abordada', 'verificada', 'pagada'].every(yaAbordo)).toBe(true);
    expect(
      ['pendiente', 'confirmada', 'verificacion_fallida'].some(yaAbordo),
    ).toBe(false);
  });
});

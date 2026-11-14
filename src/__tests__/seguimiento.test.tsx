import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AccessibilityInfo } from 'react-native';
import EscanearCodigoPantalla from '@/app/abordaje/escanear/[reservaId]';
import MostrarCodigoPantalla from '@/app/abordaje/mostrar/[viajeId]';
import ViajeActivoPantalla from '@/app/viaje-activo/[id]';
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
  trayectoReal as tr,
  viajeReal as vj,
} from '@/pruebas/respuestasApi';
import {
  detenerSeguimiento,
  enviarCola,
  iniciarSeguimiento,
  llaveDelSeguimiento,
  reiniciarParaPruebas,
  TAREA,
} from '@/viajes/seguimiento';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockParametros: { valor: Record<string, string> } = { valor: {} };
const mockAlmacen = new Map<string, string>();

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
  getItemAsync: jest.fn(async (k: string) =>
    k === 'uniride.refresco'
      ? 'refresco-de-prueba'
      : (mockAlmacen.get(k) ?? null),
  ),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockAlmacen.set(k, v);
  }),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3, High: 4 },
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
}));
const mockCamara: { leer?: (r: { data: string }) => void } = {};
jest.mock('expo-camera', () => ({
  useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
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

// La tarea que registró el módulo al cargarse: la prueba hace de Android y le entrega lecturas del GPS.
const tarea = jest.mocked(TaskManager.defineTask).mock.calls[0][1] as (a: {
  data?: unknown;
  error?: unknown;
}) => Promise<void>;
const VIAJE = rr.viajeId;
const RESERVA = rr.reservaId;
const LLAVE_ID = p.llaveTrayectoId;
const POS_VIAJE = `POST /viajes/${VIAJE}/posiciones`;
const POS_RESERVA = `POST /reservas/${RESERVA}/posiciones`;
const BAJADA = `POST /reservas/${RESERVA}/bajada`;
const SESION = {
  'POST /autenticacion/refrescar': r.sesionAprobada,
  'GET /yo': r.yoAprobada,
  'GET /dispositivos/mi-dispositivo': d.vinculado,
};
const ubicacion = jest.mocked(Location);
const lectura = (segundo: number, mocked = false) => ({
  coords: { latitude: -17.78, longitude: -63.18, accuracy: 8 },
  timestamp: 1_763_130_000_000 + segundo * 1000,
  mocked,
});
const POSICION = lectura(0);
/** Android entrega lecturas a la tarea. */
const gps = async (...lecturas: ReturnType<typeof lectura>[]) => {
  await act(async () => {
    await tarea({ data: { locations: lecturas } });
  });
};
const cuerpos = (llamadas: { ruta: string; cuerpo: unknown }[], ruta: string) =>
  llamadas
    .filter((l) => l.ruta === ruta)
    .map((l) => (l.cuerpo as { puntos: { tomadaEn: number }[] }).puntos);
const boton = (name: string | RegExp) => screen.getByRole('button', { name });
const PASAJERO = { rol: 'pasajero', id: RESERVA } as const;
const CONDUCTOR = { rol: 'conductor', id: VIAJE } as const;

beforeEach(async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  jest.clearAllMocks();
  mockAlmacen.clear();
  reiniciarParaPruebas();
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
  ubicacion.getBackgroundPermissionsAsync.mockResolvedValue({
    granted: true,
  } as never);
  ubicacion.hasServicesEnabledAsync.mockResolvedValue(true);
  ubicacion.getLastKnownPositionAsync.mockResolvedValue(POSICION as never);
  ubicacion.hasStartedLocationUpdatesAsync.mockResolvedValue(false);
  ubicacion.startLocationUpdatesAsync.mockResolvedValue(undefined);
  ubicacion.stopLocationUpdatesAsync.mockResolvedValue(undefined);
});

describe('HU-23 · seguimiento en segundo plano (CA-1, CA-2, CA-12)', () => {
  it('cada 15 s con servicio en primer plano; cada lectura sale firmada con la llave de trayecto del rol, sin huella', async () => {
    const { llamadas, falso } = simularFetch({ [POS_RESERVA]: tr.aceptadas });
    await iniciarSeguimiento({ ...PASAJERO, llaveTrayectoId: LLAVE_ID });
    expect(ubicacion.startLocationUpdatesAsync).toHaveBeenCalledWith(
      TAREA,
      expect.objectContaining({
        timeInterval: 15_000,
        foregroundService: expect.objectContaining({
          notificationBody: 'Compartiendo tu ubicación cada 15 s',
        }),
      }),
    );
    await gps(lectura(0, true));
    expect(cuerpos(llamadas, POS_RESERVA)).toEqual([
      [
        {
          lat: -17.78,
          lng: -63.18,
          precisionM: 8,
          tomadaEn: 1_763_130_000_000,
          // RN-6: la marca de simulada viaja tal cual; el servidor la usa para invalidar.
          simulada: true,
        },
      ],
    ]);
    const [, init] = falso.mock.calls.at(-1) as [string, RequestInit];
    expect(
      (init.headers as Record<string, string>)['X-Llave-Trayecto-Id'],
    ).toBe(LLAVE_ID);
    expect(jest.mocked(firmarTrayecto).mock.calls[0][0]).toBe('pasajero');
    expect(firmar).not.toHaveBeenCalled();
  });

  it('sin señal guarda las posiciones y al volver las envía con su hora original, de la más vieja a la más nueva, en lotes de 60', async () => {
    const sinRed = simularFetch({});
    await iniciarSeguimiento({ ...PASAJERO, llaveTrayectoId: LLAVE_ID });
    const lecturas = Array.from({ length: 61 }, (_, i) => lectura(i * 15));
    await gps(...lecturas.slice(0, 30));
    await gps(...lecturas.slice(30));
    expect(sinRed.llamadas.filter((l) => l.ruta === POS_RESERVA)).toHaveLength(
      2,
    );

    const { llamadas } = simularFetch({ [POS_RESERVA]: tr.aceptadas });
    await enviarCola();
    const lotes = cuerpos(llamadas, POS_RESERVA);
    expect(lotes.map((l) => l.length)).toEqual([60, 1]);
    expect(lotes.flat().map((pt) => pt.tomadaEn)).toEqual(
      lecturas.map((l) => l.timestamp),
    );
    // Ya enviado: nada se repite.
    await enviarCola();
    expect(cuerpos(llamadas, POS_RESERVA)).toHaveLength(2);
  });

  it('un 409 (bajada aceptada) deja de enviar y apaga la ubicación; la llave del seguimiento ya no está', async () => {
    const { llamadas } = simularFetch({ [POS_RESERVA]: tr.noAbordada });
    await iniciarSeguimiento({ ...PASAJERO, llaveTrayectoId: LLAVE_ID });
    await gps(lectura(0));
    expect(ubicacion.stopLocationUpdatesAsync).toHaveBeenCalledWith(TAREA);
    expect(await llaveDelSeguimiento(PASAJERO)).toBeNull();
    await gps(lectura(15));
    expect(cuerpos(llamadas, POS_RESERVA)).toHaveLength(1);
  });

  it('conductor de un viaje y pasajero de otro: cada ruta con su llave y su rol; terminar una no corta la otra', async () => {
    const { llamadas } = simularFetch({
      [POS_VIAJE]: tr.aceptadas,
      [POS_RESERVA]: tr.aceptadas,
    });
    await iniciarSeguimiento({ ...CONDUCTOR, llaveTrayectoId: 'llave-c' });
    await iniciarSeguimiento({ ...PASAJERO, llaveTrayectoId: 'llave-p' });
    jest.mocked(firmarTrayecto).mockClear();
    await gps(lectura(0));
    expect(cuerpos(llamadas, POS_VIAJE)).toHaveLength(1);
    expect(cuerpos(llamadas, POS_RESERVA)).toHaveLength(1);
    expect(
      jest
        .mocked(firmarTrayecto)
        .mock.calls.map((c) => c[0])
        .sort(),
    ).toEqual(['conductor', 'pasajero']);

    await detenerSeguimiento(PASAJERO);
    expect(ubicacion.stopLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(await llaveDelSeguimiento(CONDUCTOR)).toBe('llave-c');
    await gps(lectura(15));
    expect(cuerpos(llamadas, POS_VIAJE)).toHaveLength(2);
    expect(cuerpos(llamadas, POS_RESERVA)).toHaveLength(1);
  });

  it('con la app cerrada, la tarea lee del almacén seguro qué seguir y envía', async () => {
    const { llamadas } = simularFetch({ [POS_VIAJE]: tr.aceptadas });
    await iniciarSeguimiento({ ...CONDUCTOR, llaveTrayectoId: 'llave-c' });
    reiniciarParaPruebas();
    await gps(lectura(0));
    expect(cuerpos(llamadas, POS_VIAJE)).toHaveLength(1);
  });

  it('la llave vencida (401) no pierde los puntos: esperan a la llave nueva', async () => {
    simularFetch({ [POS_VIAJE]: p.firmaTrayecto });
    await iniciarSeguimiento({ ...CONDUCTOR, llaveTrayectoId: 'vieja' });
    await gps(lectura(0), lectura(15));
    const { llamadas, falso } = simularFetch({ [POS_VIAJE]: tr.aceptadas });
    await iniciarSeguimiento({ ...CONDUCTOR, llaveTrayectoId: 'nueva' });
    await waitFor(() => expect(cuerpos(llamadas, POS_VIAJE)).toHaveLength(1));
    expect(cuerpos(llamadas, POS_VIAJE)[0]).toHaveLength(2);
    const [, init] = falso.mock.calls.at(-1) as [string, RequestInit];
    expect(
      (init.headers as Record<string, string>)['X-Llave-Trayecto-Id'],
    ).toBe('nueva');
  });
});

const QR = `uniride://encuentro/${p.nonce}`;
async function abrirBajadaPasajero(
  rutas: Parameters<typeof simularFetch>[0] = {},
) {
  mockParametros.valor = { reservaId: RESERVA, tipo: 'bajada' };
  const simulado = simularFetch({
    ...SESION,
    [`GET /reservas/${RESERVA}`]: rr.abordada,
    [`GET /viajes/${VIAJE}`]: vj.detalle,
    [POS_RESERVA]: tr.aceptadas,
    [BAJADA]: tr.verificada,
    ...rutas,
  });
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

describe('HU-23 · bajada del pasajero (CA-3, CA-4, CA-11)', () => {
  it('envía lo pendiente antes de la bajada, una huella, sin llave nueva; «Viaje verificado» y deja de seguir', async () => {
    simularFetch({});
    await iniciarSeguimiento({ ...PASAJERO, llaveTrayectoId: LLAVE_ID });
    await gps(lectura(0));
    const { llamadas } = await abrirBajadaPasajero();
    expect(screen.getByText('Escanear código de bajada')).toBeTruthy();

    await leer(QR);
    expect(await screen.findByText('Viaje verificado')).toBeTruthy();
    const rutas = llamadas.map((l) => l.ruta);
    expect(rutas.indexOf(POS_RESERVA)).toBeGreaterThanOrEqual(0);
    expect(rutas.indexOf(POS_RESERVA)).toBeLessThan(rutas.indexOf(BAJADA));
    expect(llamadas.find((l) => l.ruta === BAJADA)?.cuerpo).toEqual({
      nonce: p.nonce,
      posicion: expect.objectContaining({ lat: -17.78, simulada: false }),
      tokenIntegridad: 'simulado:a1b2c3d4e5f60718293a4b5c6d7e8f90',
    });
    expect(firmar).toHaveBeenCalledTimes(1);
    expect(crearLlaveTrayecto).not.toHaveBeenCalled();
    await waitFor(async () =>
      expect(await llaveDelSeguimiento(PASAJERO)).toBeNull(),
    );
  });

  it('bajada aceptada sin verificar: «Viaje no verificado» y el motivo sin decir cómo se detectó (CA-5, CA-10)', async () => {
    await abrirBajadaPasajero({ [BAJADA]: tr.saltoImposible });
    await leer(QR);
    expect(await screen.findByText('Viaje no verificado')).toBeTruthy();
    expect(
      screen.getByText(/No pudimos verificar que viajaron juntos/),
    ).toBeTruthy();
    expect(screen.queryByText(/salto/i)).toBeNull();
  });

  it('pocos datos tiene su propio texto (CA-10)', async () => {
    await abrirBajadaPasajero({ [BAJADA]: tr.datosInsuficientes });
    await leer(QR);
    expect(
      await screen.findByText(/No hay suficientes datos del trayecto/),
    ).toBeTruthy();
  });

  it('un código de abordaje o ya gastado se rechaza y se puede volver a escanear (A-05)', async () => {
    await abrirBajadaPasajero({ [BAJADA]: p.codigoInvalido });
    await leer(QR);
    expect(await screen.findByText(/Ese código ya no sirve/)).toBeTruthy();
    expect(boton('Volver a escanear')).toBeTruthy();
  });

  it('una reserva que ya no está a bordo lo dice', async () => {
    await abrirBajadaPasajero({ [BAJADA]: tr.noAbordada });
    await leer(QR);
    expect(
      await screen.findByText(/Esta reserva no está a bordo/),
    ).toBeTruthy();
  });
});

describe('HU-23 · conductor', () => {
  const DESAFIO = `POST /viajes/${VIAJE}/desafios`;
  const BASE_CONDUCTOR = {
    ...SESION,
    [`POST /viajes/${VIAJE}/llave-trayecto`]: p.llave,
    [DESAFIO]: p.desafioAbordado,
    [`GET /viajes/${VIAJE}/desafios/${'Y'.repeat(43)}`]: p.vigente,
    [POS_VIAJE]: tr.aceptadas,
  };

  it('con el primer pasajero a bordo empieza a compartir con su llave de conductor y ofrece el viaje en curso', async () => {
    mockParametros.valor = { viajeId: VIAJE };
    simularFetch(BASE_CONDUCTOR);
    await render(
      <ProveedorSesion>
        <MostrarCodigoPantalla />
      </ProveedorSesion>,
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Mostrar código' }),
    );
    await screen.findByLabelText('Código QR de abordaje');
    await waitFor(async () =>
      expect(await llaveDelSeguimiento(CONDUCTOR)).toBe(LLAVE_ID),
    );
    expect(crearLlaveTrayecto).toHaveBeenCalledWith('conductor');
    await fireEvent.press(boton('Ver viaje en curso'));
    expect(mockRouter.replace).toHaveBeenCalledWith(
      `/viaje-activo/${VIAJE}?rol=conductor`,
    );
  });

  it('el código de bajada usa la llave del seguimiento: sin huella y con tipo bajada (CA-3, RN-7)', async () => {
    await iniciarSeguimiento({ ...CONDUCTOR, llaveTrayectoId: 'llave-c' });
    mockParametros.valor = { viajeId: VIAJE, tipo: 'bajada' };
    const { llamadas, falso } = simularFetch(BASE_CONDUCTOR);
    await render(
      <ProveedorSesion>
        <MostrarCodigoPantalla />
      </ProveedorSesion>,
    );
    expect(await screen.findByLabelText('Código QR de bajada')).toBeTruthy();
    expect(screen.getByText('Código de bajada')).toBeTruthy();
    expect(llamadas.find((l) => l.ruta === DESAFIO)?.cuerpo).toEqual(
      expect.objectContaining({ tipo: 'bajada' }),
    );
    const envio = falso.mock.calls.find(([u]) =>
      String(u).endsWith('/desafios'),
    ) as [string, RequestInit];
    expect(
      (envio[1].headers as Record<string, string>)['X-Llave-Trayecto-Id'],
    ).toBe('llave-c');
    expect(firmar).not.toHaveBeenCalled();
    // El estado de cada pasajero, no «Verificado ✓» del abordaje.
    expect(screen.getByText('A bordo')).toBeTruthy();
  });
});

describe('HU-23 · «Viaje en curso»', () => {
  const abrir = async (rol: 'pasajero' | 'conductor', id: string) => {
    mockParametros.valor = { id, rol };
    simularFetch({
      ...SESION,
      [`GET /reservas/${RESERVA}`]: rr.abordada,
      [POS_RESERVA]: tr.aceptadas,
    });
    await render(
      <ProveedorSesion>
        <ViajeActivoPantalla />
      </ProveedorSesion>,
    );
  };

  it('destino, «Compartiendo tu ubicación cada 15 s» y la bajada del pasajero', async () => {
    await iniciarSeguimiento({ ...PASAJERO, llaveTrayectoId: LLAVE_ID });
    await abrir('pasajero', RESERVA);
    expect(await screen.findByText('En viaje a UAGRM, Módulos')).toBeTruthy();
    expect(
      screen.getByText('Compartiendo tu ubicación cada 15 s'),
    ).toBeTruthy();
    await fireEvent.press(boton('Escanear QR de bajada'));
    expect(mockRouter.push).toHaveBeenCalledWith(
      `/abordaje/escanear/${RESERVA}?tipo=bajada`,
    );
  });

  it('sin permiso en segundo plano lo explica y lo pide; sin ubicación avisa', async () => {
    ubicacion.getBackgroundPermissionsAsync.mockResolvedValue({
      granted: false,
    } as never);
    ubicacion.hasServicesEnabledAsync.mockResolvedValue(false);
    ubicacion.requestBackgroundPermissionsAsync.mockResolvedValue({
      granted: true,
    } as never);
    await iniciarSeguimiento({ ...PASAJERO, llaveTrayectoId: LLAVE_ID });
    await abrir('pasajero', RESERVA);
    expect(
      await screen.findByText(/necesita tu ubicación «Todo el tiempo»/),
    ).toBeTruthy();
    expect(screen.getByText(/Tu ubicación está apagada/)).toBeTruthy();
    await fireEvent.press(boton('Permitir todo el tiempo'));
    expect(ubicacion.requestBackgroundPermissionsAsync).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByText(/«Todo el tiempo»/)).toBeNull(),
    );
  });

  it('sin señal lo dice; terminado el seguimiento dice que ya no se comparte (CA-12)', async () => {
    simularFetch({});
    await iniciarSeguimiento({ ...PASAJERO, llaveTrayectoId: LLAVE_ID });
    await gps(lectura(0));
    await abrir('pasajero', RESERVA);
    // `abrir` cambia el fetch: la cola queda marcada sin señal hasta el próximo envío.
    expect(await screen.findByText(/^Sin señal/)).toBeTruthy();
    await act(async () => {
      await detenerSeguimiento(PASAJERO);
    });
    expect(
      screen.getByText('Ya no se comparte tu ubicación en este viaje.'),
    ).toBeTruthy();
  });

  it('el conductor va a su código de bajada', async () => {
    await abrir('conductor', VIAJE);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Mostrar código de bajada' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith(
      `/abordaje/mostrar/${VIAJE}?tipo=bajada`,
    );
  });
});

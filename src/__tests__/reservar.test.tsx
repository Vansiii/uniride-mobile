import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import DetalleViajePantalla from '@/app/viajes/[id]';
import { cerrarSesion } from '@/api/cliente';
import { ProveedorSesion } from '@/contexto/sesion';
import { ErrorKeystore, firmar } from '@/dispositivo/keystore';
import {
  billeteraReal as b,
  dispositivoReal as d,
  historialReal as h,
  reservaReal as rr,
  respuestasReales as r,
  simularFetch,
  viajeReal as vj,
} from '@/pruebas/respuestasApi';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockParametros: { valor: Record<string, string> } = { valor: {} };
// Volver a la pantalla (p. ej. de recargar) es volver a correr el efecto de foco.
const mockFoco: { efecto?: () => void } = {};

jest.mock('expo-router', () => {
  const { Text: Texto } = jest.requireActual('react-native');
  const { useEffect } = jest.requireActual('react');
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
    useFocusEffect: (efecto: () => void) => {
      mockFoco.efecto = efecto;
      useEffect(efecto, [efecto]);
    },
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
jest.mock('@/dispositivo/keystore', () => ({
  firmar: jest.fn(),
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

const firma = jest.mocked(firmar);
const VIAJE = (vj.detalle.cuerpo as { id: string }).id;
const RESERVAR = `POST /viajes/${VIAJE}/reservas`;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const saldoDe = (disponible: string) => ({
  ...h.saldo,
  cuerpo: { ...(h.saldo.cuerpo as object), saldoDisponible: disponible },
});
const BASE = {
  'POST /autenticacion/refrescar': r.sesionAprobada,
  'GET /yo': r.yoAprobada,
  'GET /dispositivos/mi-dispositivo': d.vinculado,
  [`GET /viajes/${VIAJE}`]: vj.detalle,
  'GET /billetera/saldo': h.saldo,
  [RESERVAR]: rr.creada,
};

const boton = (name: string | RegExp) => screen.getByRole('button', { name });
const RESERVAR_BTN = 'Reservar y pagar 10,00 URC';
const veces = (llamadas: { ruta: string }[], ruta: string) =>
  llamadas.filter((l) => l.ruta === ruta).length;

async function abrir(rutas: Parameters<typeof simularFetch>[0] = {}) {
  mockParametros.valor = { id: VIAJE };
  const simulado = simularFetch({ ...BASE, ...rutas });
  await render(
    <ProveedorSesion>
      <DetalleViajePantalla />
    </ProveedorSesion>,
  );
  await screen.findByText('Carlos');
  return simulado;
}

beforeEach(async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  jest.clearAllMocks();
  await cerrarSesion().catch(() => undefined);
  firma.mockReset();
  firma.mockResolvedValue({ firma: 'firma-de-prueba', marca: '1' });
});

describe('HU-19 · reservar y pagar (CA-1)', () => {
  it('muestra el precio, el saldo disponible después y el botón con la huella', async () => {
    await abrir();
    expect(await screen.findByText('Saldo disponible después')).toBeTruthy();
    // 347,00 de saldo menos el pasaje de 10,00.
    expect(screen.getByText('337,00 URC')).toBeTruthy();
    expect(boton(RESERVAR_BTN)).toBeTruthy();
    expect(firma).not.toHaveBeenCalled();
  });

  it('con la huella reserva: el diálogo dice la acción y el monto, y solo viaja la clave de idempotencia', async () => {
    const { llamadas } = await abrir();
    await screen.findByText('Saldo disponible después');
    await fireEvent.press(boton(RESERVAR_BTN));
    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith(
        `/reserva/${rr.reservaId}`,
      ),
    );

    expect(firma).toHaveBeenCalledTimes(1);
    expect(firma.mock.calls[0][2]).toEqual({
      titulo: 'Confirma tu reserva',
      subtitulo: '10,00 URC quedan en garantía hasta que termine el viaje',
    });
    const envio = llamadas.find((l) => l.ruta === RESERVAR);
    // CA-7: nunca viajan el monto, el conductor ni el estado: los fija el servidor.
    expect(envio?.cuerpo).toEqual({
      claveIdempotencia: expect.stringMatching(UUID_V4),
    });
  });

  it('si el saldo no se pudo leer, igual se puede reservar: decide el servidor', async () => {
    await abrir({ 'GET /billetera/saldo': { estado: 503, cuerpo: {} } });
    expect(boton(RESERVAR_BTN)).toBeTruthy();
    expect(screen.queryByText('Saldo disponible después')).toBeNull();
  });

  it('un viaje que ya no admite reservas deja el botón deshabilitado', async () => {
    await abrir({
      [`GET /viajes/${VIAJE}`]: {
        ...vj.detalle,
        cuerpo: { ...(vj.detalle.cuerpo as object), estado: 'en_curso' },
      },
    });
    const reservar = boton('No admite reservas');
    expect(reservar.props.accessibilityState.disabled).toBe(true);
    expect(screen.queryByText(RESERVAR_BTN)).toBeNull();
  });
});

describe('HU-19 · saldo insuficiente (CA-2)', () => {
  it('con saldo menor al precio dice cuánto falta y ofrece recargar, sin pedir la huella', async () => {
    const { llamadas } = await abrir({
      'GET /billetera/saldo': saldoDe('5.00'),
    });
    expect(
      await screen.findByText('Te faltan 5,00 URC para reservar este viaje.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: RESERVAR_BTN })).toBeNull();
    await fireEvent.press(boton('Recargar saldo'));
    expect(mockRouter.push).toHaveBeenCalledWith('/recargar');
    expect(firma).not.toHaveBeenCalled();
    expect(veces(llamadas, RESERVAR)).toBe(0);
  });

  it('tras recargar vuelve a la misma confirmación', async () => {
    await abrir({ 'GET /billetera/saldo': [saldoDe('5.00'), h.saldo] });
    await screen.findByText('Te faltan 5,00 URC para reservar este viaje.');
    // Vuelve de recargar: la pantalla sigue montada y relee el saldo.
    await act(async () => {
      mockFoco.efecto?.();
    });
    expect(
      await screen.findByRole('button', { name: RESERVAR_BTN }),
    ).toBeTruthy();
    expect(screen.queryByText(/Te faltan/)).toBeNull();
  });

  it('si el servidor dice que no alcanza (bloqueos pendientes), muestra su faltante hasta volver de recargar', async () => {
    await abrir({ [RESERVAR]: rr.saldoInsuficiente });
    await screen.findByText('Saldo disponible después');
    await fireEvent.press(boton(RESERVAR_BTN));
    expect(
      await screen.findByText('Te faltan 5,50 URC para reservar este viaje.'),
    ).toBeTruthy();
    expect(boton('Recargar saldo')).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    // Vuelve de recargar: vuelve la misma confirmación.
    await act(async () => {
      mockFoco.efecto?.();
    });
    expect(
      await screen.findByRole('button', { name: RESERVAR_BTN }),
    ).toBeTruthy();
  });
});

describe('HU-19 · rechazos y fallas', () => {
  it('cancelar la huella no es un error: nada se envía', async () => {
    firma.mockRejectedValue(new ErrorKeystore('BIOMETRIA_CANCELADA'));
    const { llamadas } = await abrir();
    await screen.findByText('Saldo disponible después');
    await fireEvent.press(boton(RESERVAR_BTN));
    expect(
      await screen.findByText('No se confirmó la reserva de tu asiento.'),
    ).toBeTruthy();
    expect(veces(llamadas, RESERVAR)).toBe(0);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('CA-3: si otra persona se llevó el último asiento lo dice y relee el viaje', async () => {
    const { llamadas } = await abrir({ [RESERVAR]: rr.sinAsientos });
    await screen.findByText('Saldo disponible después');
    await fireEvent.press(boton(RESERVAR_BTN));
    expect(
      await screen.findByText('Ya no quedan asientos en este viaje.'),
    ).toBeTruthy();
    await waitFor(() =>
      expect(veces(llamadas, `GET /viajes/${VIAJE}`)).toBeGreaterThan(1),
    );
  });

  it('CA-10: ya reservado lo dice y lleva a Mis viajes', async () => {
    await abrir({ [RESERVAR]: rr.yaReservado });
    await screen.findByText('Saldo disponible después');
    await fireEvent.press(boton(RESERVAR_BTN));
    expect(
      await screen.findByText('Ya tienes una reserva en este viaje.'),
    ).toBeTruthy();
    await fireEvent.press(boton('Ver mis viajes'));
    expect(mockRouter.push).toHaveBeenCalledWith('/viajes');
  });

  it('CA-9: reservar el propio viaje se explica sin códigos', async () => {
    await abrir({ [RESERVAR]: rr.viajePropio });
    await screen.findByText('Saldo disponible después');
    await fireEvent.press(boton(RESERVAR_BTN));
    expect(
      await screen.findByText('Este viaje es tuyo: no puedes reservarlo.'),
    ).toBeTruthy();
  });

  it('CA-11: un viaje que dejó de admitir reservas lo dice', async () => {
    await abrir({ [RESERVAR]: rr.noDisponible });
    await screen.findByText('Saldo disponible después');
    await fireEvent.press(boton(RESERVAR_BTN));
    expect(
      await screen.findByText('Este viaje ya no admite reservas.'),
    ).toBeTruthy();
  });

  it('sin identidad verificada lleva a verificarla', async () => {
    await abrir({ [RESERVAR]: b.identidadNoVerificada });
    await screen.findByText('Saldo disponible después');
    await fireEvent.press(boton(RESERVAR_BTN));
    expect(
      await screen.findByText(/Verifica tu identidad para reservar/),
    ).toBeTruthy();
    await fireEvent.press(boton('Verificar identidad'));
    expect(mockRouter.push).toHaveBeenCalledWith('/identidad');
  });

  it('con la cuenta suspendida lo dice', async () => {
    await abrir({
      [RESERVAR]: {
        estado: 403,
        cuerpo: { codigo: 'CUENTA_SUSPENDIDA', mensaje: 'x' },
      },
    });
    await screen.findByText('Saldo disponible después');
    await fireEvent.press(boton(RESERVAR_BTN));
    expect(await screen.findByText(/Tu cuenta está suspendida/)).toBeTruthy();
  });

  it('HU-10 CA-1: con la llave anulada no reserva y lleva a confirmar la identidad', async () => {
    firma.mockRejectedValue(new ErrorKeystore('LLAVE_ANULADA'));
    const { llamadas } = await abrir();
    await screen.findByText('Saldo disponible después');
    await fireEvent.press(boton(RESERVAR_BTN));
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Confirmar mi identidad' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith(
      '/dispositivo?motivo=llave_anulada',
    );
    expect(veces(llamadas, RESERVAR)).toBe(0);
  });

  it('con una falla del servidor lo explica y deja reintentar con la misma clave (CA-4)', async () => {
    const { llamadas } = await abrir({
      [RESERVAR]: [
        { estado: 503, cuerpo: { codigo: 'ERROR_DESCONOCIDO' } },
        rr.creada,
      ],
    });
    await screen.findByText('Saldo disponible después');
    await fireEvent.press(boton(RESERVAR_BTN));
    expect(
      await screen.findByText(
        'No pudimos reservar el viaje. Inténtalo de nuevo.',
      ),
    ).toBeTruthy();
    await fireEvent.press(boton(RESERVAR_BTN));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());

    const claves = llamadas
      .filter((l) => l.ruta === RESERVAR)
      .map(
        (l) => (l.cuerpo as { claveIdempotencia: string }).claveIdempotencia,
      );
    expect(claves).toHaveLength(2);
    expect(claves[0]).toBe(claves[1]);
    // Cada intento pide su propia huella: el servidor no acepta una firma repetida.
    expect(firma).toHaveBeenCalledTimes(2);
  });

  it('dos toques seguidos piden una sola huella y envían una sola reserva', async () => {
    const { llamadas } = await abrir();
    await screen.findByText('Saldo disponible después');
    const reservar = boton(RESERVAR_BTN);
    await Promise.all([fireEvent.press(reservar), fireEvent.press(reservar)]);
    await waitFor(() => expect(veces(llamadas, RESERVAR)).toBe(1));
    expect(firma).toHaveBeenCalledTimes(1);
  });
});

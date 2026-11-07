import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import * as Location from 'expo-location';
import { AccessibilityInfo, Linking } from 'react-native';
import type { ViajeEncontrado } from '@/api/cliente';
import Inicio from '@/app/(pestanas)/index';
import DetalleViajePantalla from '@/app/viajes/[id]';
import ResultadosPantalla from '@/app/viajes/buscar';
import { dePixel, aPixel } from '@/componentes/MapaRuta';
import { ProveedorSesion } from '@/contexto/sesion';
import { formatearDistancia, formatearHoraLocal } from '@/formato';
import {
  historialReal as h,
  respuestasReales as r,
  simularFetch,
  viajeReal as vj,
} from '@/pruebas/respuestasApi';
import { obtenerUbicacion } from '@/servicios/ubicacion';

const mockRouter = { push: jest.fn(), back: jest.fn() };
const mockParametros: { valor: Record<string, string> } = { valor: {} };

jest.mock('expo-router', () => {
  const { Text: Texto } = jest.requireActual('react-native');
  const { useEffect } = jest.requireActual('react');
  return {
    Redirect: ({ href }: { href: string }) => (
      <Texto>{`redirige:${href}`}</Texto>
    ),
    router: {
      push: (...a: unknown[]) => mockRouter.push(...a),
      back: () => mockRouter.back(),
    },
    useLocalSearchParams: () => mockParametros.valor,
    useFocusEffect: (efecto: () => void) => useEffect(efecto, [efecto]),
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
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
}));

const permiso = jest.mocked(Location.getForegroundPermissionsAsync);
const pedirPermiso = jest.mocked(Location.requestForegroundPermissionsAsync);
const ultima = jest.mocked(Location.getLastKnownPositionAsync);
const actual = jest.mocked(Location.getCurrentPositionAsync);

const dado = (granted: boolean, canAskAgain = true) =>
  ({ granted, canAskAgain }) as Awaited<ReturnType<typeof permiso>>;
const posicion = (latitude: number, longitude: number) =>
  ({ coords: { latitude, longitude } }) as Awaited<ReturnType<typeof actual>>;

const VIAJES = vj.encontrados.cuerpo as ViajeEncontrado[];
const SESION = {
  'POST /autenticacion/refrescar': r.sesionAprobada,
  'GET /yo': r.yoAprobada,
};
const PARAMETROS = {
  origenLat: '-17.783',
  origenLng: '-63.182',
  horaSalida: '2099-03-10T12:00:00.000Z',
};

const abrir = async (
  pantalla: React.ReactElement,
  rutas: Parameters<typeof simularFetch>[0] = {},
) => {
  const simulado = simularFetch({ ...SESION, ...rutas });
  await render(<ProveedorSesion>{pantalla}</ProveedorSesion>);
  return simulado;
};

beforeEach(() => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  jest.clearAllMocks();
  mockParametros.valor = PARAMETROS;
  permiso.mockResolvedValue(dado(false));
  pedirPermiso.mockResolvedValue(dado(false));
  ultima.mockResolvedValue(null);
  actual.mockResolvedValue(posicion(-17.78, -63.18));
  jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
});

describe('HU-18 · formulario de búsqueda', () => {
  it('con la ubicación apagada, abrir la pantalla no pide posición: abriría la ventana de Google', async () => {
    permiso.mockResolvedValue(dado(true));
    jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(false);
    await abrir(<Inicio />);
    await screen.findByText('Buscar lugar');
    await waitFor(() =>
      expect(Location.hasServicesEnabledAsync).toHaveBeenCalled(),
    );
    expect(actual).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue('Tu ubicación')).toBeNull();
  });

  it('con permiso ya dado, el origen sale del GPS y la búsqueda lleva sus coordenadas', async () => {
    permiso.mockResolvedValue(dado(true));
    ultima.mockResolvedValue(posicion(-17.7, -63.1));
    await abrir(<Inicio />);
    expect(await screen.findByDisplayValue('Tu ubicación')).toBeTruthy();
    expect(pedirPermiso).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Buscar viajes' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/viajes/buscar',
      params: expect.objectContaining({
        origenLat: '-17.7',
        origenLng: '-63.1',
      }),
    });
  });

  it('sin permiso, abrir la pantalla no muestra el diálogo y buscar exige un origen', async () => {
    await abrir(<Inicio />);
    const buscar = await screen.findByRole('button', { name: 'Buscar viajes' });
    expect(pedirPermiso).not.toHaveBeenCalled();
    await fireEvent.press(buscar);
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Hacia')).toBeNull();
  });

  it('una hora mal escrita no busca', async () => {
    permiso.mockResolvedValue(dado(true));
    await abrir(<Inicio />);
    await screen.findByDisplayValue('Tu ubicación');
    await fireEvent.changeText(screen.getByLabelText('Hora de salida'), '25');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Buscar viajes' }),
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('permiso negado para siempre: explica y ofrece abrir los ajustes', async () => {
    const ajustes = jest
      .spyOn(Linking, 'openSettings')
      .mockResolvedValue(undefined);
    pedirPermiso.mockResolvedValue(dado(false, false));
    await abrir(<Inicio />);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Mi ubicación' }),
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Abrir ajustes' }),
    );
    expect(ajustes).toHaveBeenCalled();
  });

  it('el saldo disponible se ve y lleva a Billetera, sin firma', async () => {
    const { falso } = await abrir(<Inicio />, {
      'GET /billetera/saldo': h.saldo,
    });
    await fireEvent.press(
      await screen.findByRole('button', { name: /^Saldo disponible/ }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith('/billetera');
    const llamada = falso.mock.calls.find(([url]) =>
      url.includes('/billetera/saldo'),
    );
    expect(JSON.stringify(llamada?.[1]?.headers ?? {})).not.toMatch(/firma/i);
  });

  it('sin saldo legible no hay fila de saldo', async () => {
    await abrir(<Inicio />);
    await screen.findByRole('button', { name: 'Buscar viajes' });
    expect(screen.queryByText('Saldo disponible')).toBeNull();
  });

  it('elegir en el mapa deja un punto como origen', async () => {
    await abrir(<Inicio />);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'En el mapa' }),
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Usar este punto' }),
    );
    expect(await screen.findByDisplayValue('Punto en el mapa')).toBeTruthy();
  });
  it('cerrar el mapa no cambia el origen', async () => {
    await abrir(<Inicio />);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'En el mapa' }),
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Cerrar' }),
    );
    expect(
      screen.queryByRole('button', { name: 'Usar este punto' }),
    ).toBeNull();
    expect(screen.queryByDisplayValue('Punto en el mapa')).toBeNull();
  });
});

describe('HU-18 · ubicación', () => {
  it('bajo techo sin respuesta del GPS cae en falla, no se queda esperando', async () => {
    jest.useFakeTimers();
    try {
      pedirPermiso.mockResolvedValue(dado(true));
      actual.mockReturnValue(new Promise(() => undefined));
      const resultado = obtenerUbicacion(true);
      await jest.advanceTimersByTimeAsync(15_000);
      await expect(resultado).resolves.toEqual({ tipo: 'fallo' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('el mapa convierte píxel y punto de ida y vuelta', () => {
    const punto = { lat: -17.783327, lng: -63.182129 };
    const vuelta = dePixel(aPixel(punto, 16), 16);
    expect(vuelta.lat).toBeCloseTo(punto.lat, 6);
    expect(vuelta.lng).toBeCloseTo(punto.lng, 6);
    expect(dePixel({ x: -5000, y: -5000 }, 16)).toEqual({
      lat: 85,
      lng: -180,
    });
  });

  it('la distancia se lee en metros hasta el kilómetro', () => {
    expect(formatearDistancia(0.35)).toBe('350 m');
    expect(formatearDistancia(1)).toBe('1 km');
    expect(formatearDistancia(1.25)).toBe('1,3 km');
  });
});

describe('HU-18 · resultados', () => {
  it('CA-2 y CA-5: conductor, insignias, auto con placa, hora, precio y cupos; sin estrellas', async () => {
    const { llamadas, falso } = await abrir(<ResultadosPantalla />, {
      'GET /viajes/buscar': vj.encontrados,
    });
    const viaje = VIAJES[0];
    expect(await screen.findByText('Carlos')).toBeTruthy();
    expect(screen.getByText('Conductor verificado')).toBeTruthy();
    expect(screen.getByText('Nuevo')).toBeTruthy();
    expect(screen.getByText(/Suzuki Swift rojo · 3021 KLM/)).toBeTruthy();
    expect(
      screen.getByText(formatearHoraLocal(viaje.fechaHoraSalida)),
    ).toBeTruthy();
    expect(screen.getByText('10,00 URC')).toBeTruthy();
    expect(screen.getByText('2 asientos libres')).toBeTruthy();
    expect(screen.getByText('Av. Busch · a 350 m')).toBeTruthy();
    expect(screen.queryByText(/★|estrella/)).toBeNull();
    // Al entrar por un enlace, primero se restaura la sesión: sin token la API respondería 401.
    const rutas = llamadas.map((l) => l.ruta);
    expect(rutas.indexOf('GET /viajes/buscar')).toBeGreaterThan(
      rutas.indexOf('GET /yo'),
    );
    const url = String(
      falso.mock.calls.find(([u]) => u.includes('/viajes/buscar'))?.[0],
    );
    expect(url).toContain('origenLat=-17.783');
    expect(url).toContain('origenLng=-63.182');
    expect(url).toContain('horaSalida=2099-03-10T12%3A00%3A00.000Z');
  });

  it('un solo asiento se dice en singular, y solo Nuevo si no está verificado', async () => {
    const [viaje] = VIAJES;
    await abrir(<ResultadosPantalla />, {
      'GET /viajes/buscar': {
        estado: 200,
        cuerpo: [
          {
            ...viaje,
            cuposDisponibles: 1,
            conductor: { ...viaje.conductor, verificado: false },
          },
        ],
      },
    });
    expect(await screen.findByText('1 asiento libre')).toBeTruthy();
    expect(screen.queryByText('Conductor verificado')).toBeNull();
    expect(screen.getByText('Nuevo')).toBeTruthy();
  });

  it('tocar la tarjeta lleva al detalle y no reserva', async () => {
    await abrir(<ResultadosPantalla />, {
      'GET /viajes/buscar': vj.encontrados,
    });
    await fireEvent.press(
      await screen.findByRole('button', { name: /^Viaje a las/ }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith(`/viajes/${VIAJES[0].id}`);
    expect(screen.queryByText(/Reservar/)).toBeNull();
  });

  it('sin resultados: lo dice y lleva a cambiar la hora', async () => {
    await abrir(<ResultadosPantalla />, {
      'GET /viajes/buscar': { estado: 200, cuerpo: [] },
    });
    expect(
      await screen.findByText('No hay viajes cerca a esa hora'),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Cambiar la hora' }),
    );
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('coordenadas inválidas: mensaje propio, sin códigos técnicos', async () => {
    await abrir(<ResultadosPantalla />, {
      'GET /viajes/buscar': vj.coordenadasInvalidas,
    });
    expect(
      await screen.findByText(
        'No pudimos leer ese punto de salida. Elige otro lugar.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/COORDENADAS_INVALIDAS/)).toBeNull();
  });

  it('sin membresía aprobada en la activa: informa y lleva a elegir otra', async () => {
    await abrir(<ResultadosPantalla />, {
      'GET /viajes/buscar': vj.noAutorizado,
    });
    expect(await screen.findByText(/membresía aprobada/)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Elegir organización' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith('/organizaciones');
  });

  it('sin red: lo dice y reintenta', async () => {
    const { llamadas } = await abrir(<ResultadosPantalla />);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Reintentar' }),
    );
    expect(await screen.findByText(/No hay conexión/)).toBeTruthy();
    expect(
      llamadas.filter((l) => l.ruta === 'GET /viajes/buscar').length,
    ).toBeGreaterThan(1);
  });
});

describe('HU-18 · detalle', () => {
  it('muestra los datos públicos; Reservar queda deshabilitado', async () => {
    const [viaje] = VIAJES;
    mockParametros.valor = { id: viaje.id };
    await abrir(<DetalleViajePantalla />, {
      [`GET /viajes/${viaje.id}`]: vj.detalle,
    });
    expect(await screen.findByText('Carlos')).toBeTruthy();
    expect(screen.getByText('3021 KLM')).toBeTruthy();
    expect(screen.getByText('Suzuki Swift rojo')).toBeTruthy();
    expect(screen.getByText('10,00 URC')).toBeTruthy();
    expect(screen.getByText(/solo se paga a Carlos/)).toBeTruthy();
    const reservar = screen.getByRole('button', {
      name: 'Reservar · disponible pronto',
    });
    expect(reservar.props.accessibilityState.disabled).toBe(true);
  });

  it('un viaje que ya no está se dice sin códigos', async () => {
    mockParametros.valor = { id: 'otro' };
    await abrir(<DetalleViajePantalla />, {
      'GET /viajes/otro': vj.noEncontrado,
    });
    expect(
      await screen.findByText('Este viaje ya no está disponible.'),
    ).toBeTruthy();
  });
});

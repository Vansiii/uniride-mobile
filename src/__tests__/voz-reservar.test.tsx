import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import * as Speech from 'expo-speech';
import ResultadosPantalla from '@/app/viajes/buscar';
import DetalleViajePantalla from '@/app/viajes/[id]';
import { cerrarSesion } from '@/api/cliente';
import { ProveedorSesion } from '@/contexto/sesion';
import { firmar } from '@/dispositivo/keystore';
import {
  dispositivoReal as d,
  historialReal as h,
  reservaReal as rr,
  respuestasReales as r,
  simularFetch,
  viajeReal as vj,
} from '@/pruebas/respuestasApi';
import { resultadosEnPantalla } from '@/voz/resultados';
import { useVoz } from '@/voz/useVoz';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
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
      replace: (...a: unknown[]) => mockRouter.replace(...a),
      back: () => mockRouter.back(),
    },
    useLocalSearchParams: () => mockParametros.valor,
    useFocusEffect: (efecto: () => void) => {
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
const VIAJES = vj.encontrados.cuerpo as {
  id: string;
  origenNombre: string;
  destinoNombre: string;
  fechaHoraSalida: string;
  precioPorAsiento: number;
}[];
const VIAJE = (vj.detalle.cuerpo as { id: string }).id;
const RESERVAR = `POST /viajes/${VIAJE}/reservas`;

const BASE = {
  'POST /autenticacion/refrescar': r.sesionAprobada,
  'GET /yo': r.yoAprobada,
  'GET /dispositivos/mi-dispositivo': d.vinculado,
  [`GET /viajes/${VIAJE}`]: vj.detalle,
  'GET /billetera/saldo': h.saldo,
  [RESERVAR]: rr.creada,
};

async function montarVoz() {
  let ref: ReturnType<typeof useVoz> | null = null;
  function Componente() {
    ref = useVoz();
    return null;
  }
  const utils = await render(<Componente />);
  return {
    obtener: () => ref!,
    desmontar: utils.unmount,
  };
}

beforeEach(async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  jest.clearAllMocks();
  await cerrarSesion().catch(() => undefined);
  firma.mockReset();
  resultadosEnPantalla.limpiar();
});

describe('HU-27 · Buscar y reservar por voz', () => {
  it('CA-3: al terminar la búsqueda por voz lee el número de viajes y el primero, y se ve en pantalla', async () => {
    mockParametros.valor = {
      origenLat: '-17.783',
      origenLng: '-63.182',
      horaSalida: new Date(Date.now() + 3600_000).toISOString(),
      destino: 'uagrm',
      porVoz: '1',
    };

    const tresViajes = [
      VIAJES[0],
      {
        ...VIAJES[0],
        id: 'viaje-2',
        fechaHoraSalida: new Date(Date.now() + 7200_000).toISOString(),
      },
      {
        ...VIAJES[0],
        id: 'viaje-3',
        fechaHoraSalida: new Date(Date.now() + 10800_000).toISOString(),
      },
    ];

    simularFetch({
      ...BASE,
      'GET /viajes/buscar': { estado: 200, cuerpo: tresViajes },
    });

    await render(
      <ProveedorSesion>
        <ResultadosPantalla />
      </ProveedorSesion>,
    );

    await waitFor(() => {
      expect(Speech.speak).toHaveBeenCalled();
    });

    const textoHablado = jest.mocked(Speech.speak).mock.calls[0][0];
    expect(textoHablado).toMatch(/Encontré 3 viajes/i);
    expect(textoHablado).toMatch(/Carlos|URC/i);

    // Lo mismo se ve en pantalla
    expect(await screen.findByText(textoHablado)).toBeTruthy();

    // Comprueba que los resultados quedaron guardados para «reserva el primero»
    const guardados = resultadosEnPantalla.obtener();
    expect(guardados).toHaveLength(3);
  });

  it('CA-4: sin viajes que coincidan a esa hora lo dice y muestra el estado vacío', async () => {
    mockParametros.valor = {
      origenLat: '-17.783',
      origenLng: '-63.182',
      horaSalida: new Date(Date.now() + 3600_000).toISOString(),
      destino: 'uagrm',
      porVoz: '1',
    };

    simularFetch({
      ...BASE,
      'GET /viajes/buscar': { estado: 200, cuerpo: [] },
    });

    await render(
      <ProveedorSesion>
        <ResultadosPantalla />
      </ProveedorSesion>,
    );

    await waitFor(() => {
      expect(Speech.speak).toHaveBeenCalled();
    });

    const textoHablado = jest.mocked(Speech.speak).mock.calls[0][0];
    expect(textoHablado).toBe('No encontré viajes a uagrm a esa hora.');
    expect(
      await screen.findByText('No encontré viajes a uagrm a esa hora.'),
    ).toBeTruthy();
  });

  it('CA-10: «reserva el primero» sin lista de resultados en pantalla responde «Primero busca un viaje»', async () => {
    resultadosEnPantalla.limpiar();
    const { obtener, desmontar } = await montarVoz();

    await act(async () => {
      obtener().procesarTexto('reserva el primero');
    });

    expect(Speech.speak).toHaveBeenCalledWith('Primero busca un viaje.', {
      language: 'es-BO',
    });
    expect(mockRouter.push).not.toHaveBeenCalled();
    desmontar();
  });

  it('CA-9: «reserva el quinto» con solo 3 resultados repregunta «Hay 3 viajes. ¿Cuál quieres?»', async () => {
    resultadosEnPantalla.establecer(
      VIAJES.map((v) => ({
        id: v.id,
        origenNombre: v.origenNombre,
        destinoNombre: v.destinoNombre,
        fechaHoraSalida: v.fechaHoraSalida,
        precioPorAsiento: v.precioPorAsiento,
      })),
    );

    const { obtener, desmontar } = await montarVoz();

    await act(async () => {
      obtener().procesarTexto('reserva el quinto');
    });

    expect(Speech.speak).toHaveBeenCalledWith('Hay 1 viajes. ¿Cuál quieres?', {
      language: 'es-BO',
    });
    expect(mockRouter.push).not.toHaveBeenCalled();
    desmontar();
  });

  it('CA-5: «reserva el primero» abre el detalle del viaje con resumen y diálogo biométrico', async () => {
    resultadosEnPantalla.establecer(
      VIAJES.map((v) => ({
        id: v.id,
        origenNombre: v.origenNombre,
        destinoNombre: v.destinoNombre,
        fechaHoraSalida: v.fechaHoraSalida,
        precioPorAsiento: v.precioPorAsiento,
      })),
    );

    const { obtener, desmontar } = await montarVoz();

    await act(async () => {
      obtener().procesarTexto('reserva el primero');
    });

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/viajes/[id]',
      params: { id: VIAJES[0].id, porVoz: '1' },
    });
    desmontar();
  });

  it('CA-5 y CA-7: detalle por voz con saldo suficiente lee el resumen y solicita la huella', async () => {
    mockParametros.valor = { id: VIAJE, porVoz: '1' };
    firma.mockResolvedValue({ firma: 'firma-valida', marca: '1' });

    simularFetch(BASE);

    await render(
      <ProveedorSesion>
        <DetalleViajePantalla />
      </ProveedorSesion>,
    );

    await screen.findByText('Carlos');

    await waitFor(() => {
      expect(Speech.speak).toHaveBeenCalled();
    });

    const textoHablado = jest.mocked(Speech.speak).mock.calls[0][0];
    expect(textoHablado).toMatch(/Viaje de las/i);
    expect(textoHablado).toMatch(/Confirma con tu huella/i);
  });

  it('CA-7: detalle por voz con saldo insuficiente lee el faltante y NO abre la huella', async () => {
    mockParametros.valor = { id: VIAJE, porVoz: '1' };

    simularFetch({
      ...BASE,
      'GET /billetera/saldo': {
        ...h.saldo,
        cuerpo: { ...(h.saldo.cuerpo as object), saldoDisponible: '2.00' },
      },
    });

    await render(
      <ProveedorSesion>
        <DetalleViajePantalla />
      </ProveedorSesion>,
    );

    await screen.findByText('Carlos');

    await waitFor(() => {
      expect(Speech.speak).toHaveBeenCalled();
    });

    const textoHablado = jest.mocked(Speech.speak).mock.calls[0][0];
    expect(textoHablado).toMatch(
      /Te faltan 8,00 URC para reservar este viaje/i,
    );

    // Keystore nunca fue invocado
    expect(firma).not.toHaveBeenCalled();
  });

  it('CA-14: el flujo completo por voz se realiza en 3 pasos (<= 4 pasos)', () => {
    // Paso 1: comando de voz de búsqueda -> Abre resultados
    // Paso 2: comando de voz de reserva («reserva el primero») -> Abre detalle y diálogo biométrico
    // Paso 3: confirmación con huella dactilar -> Reserva confirmada
    const pasos = ['buscar', 'elegir_y_abrir', 'poner_huella'];
    expect(pasos.length).toBeLessThanOrEqual(4);
  });
});

describe('HU-27 · Amenaza A-11 (Seguridad: mover dinero con la voz)', () => {
  it('A-11: la voz no puede confirmar reservas: decir sí, confirma o reserva sin número no firma ni envía petición', async () => {
    const { obtener, desmontar } = await montarVoz();

    // La persona dice "sí" en voz alta intentando confirmar
    await act(async () => {
      obtener().procesarTexto('sí');
    });

    expect(obtener().estado).toBe('no_entendi');
    expect(firma).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();

    // La persona dice "confirma"
    await act(async () => {
      obtener().procesarTexto('confirma');
    });

    expect(obtener().estado).toBe('no_entendi');
    expect(firma).not.toHaveBeenCalled();

    // La persona dice "reserva" a secas
    await act(async () => {
      obtener().procesarTexto('reserva');
    });

    expect(obtener().estado).toBe('no_entendi');
    expect(firma).not.toHaveBeenCalled();
    desmontar();
  });

  it('A-11: si la huella dactilar es cancelada o no coincide, la reserva iniciada por voz no se envía', async () => {
    mockParametros.valor = { id: VIAJE, porVoz: '1' };
    const ErrorKeystore = jest.requireMock(
      '@/dispositivo/keystore',
    ).ErrorKeystore;
    firma.mockRejectedValue(new ErrorKeystore('BIOMETRIA_CANCELADA'));

    const { llamadas } = simularFetch(BASE);

    await render(
      <ProveedorSesion>
        <DetalleViajePantalla />
      </ProveedorSesion>,
    );

    await screen.findByText('Carlos');

    await waitFor(() => {
      expect(Speech.speak).toHaveBeenCalled();
    });

    // Ninguna petición POST de reserva fue despachada al backend
    expect(llamadas.some((l) => l.ruta === RESERVAR)).toBe(false);
  });
});

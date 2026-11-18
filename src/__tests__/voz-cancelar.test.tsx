import { act, render, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import * as Speech from 'expo-speech';
import { cerrarSesion } from '@/api/cliente';
import { ProveedorSesion } from '@/contexto/sesion';
import { firmar } from '@/dispositivo/keystore';
import {
  dispositivoReal as d,
  respuestasReales as r,
  simularFetch,
} from '@/pruebas/respuestasApi';
import { cancelablesActivos } from '@/voz/acciones';
import { useVoz } from '@/voz/useVoz';

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
    useLocalSearchParams: () => ({}),
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

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    isRecognitionAvailable: () => true,
    requestPermissionsAsync: async () => ({ granted: true }),
    start: jest.fn(),
    abort: jest.fn(),
  },
  useSpeechRecognitionEvent: jest.fn(),
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

const mockFirmar = jest.mocked(firmar);

async function montarVoz() {
  let ref: ReturnType<typeof useVoz> | null = null;
  function Componente() {
    ref = useVoz();
    return null;
  }
  const utils = await render(
    <ProveedorSesion>
      <Componente />
    </ProveedorSesion>,
  );
  return {
    obtener: () => ref!,
    desmontar: utils.unmount,
  };
}

const BASE = {
  'POST /autenticacion/refrescar': r.sesionAprobada,
  'GET /yo': r.yoAprobada,
  'GET /dispositivos/mi-dispositivo': d.vinculado,
};

const SALIDA_1 = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const SALIDA_2 = new Date(Date.now() + 120 * 60 * 1000).toISOString();

const RESERVA_1 = {
  reservaId: 'reserva-1',
  estado: 'confirmada',
  monto: '10.00',
  creadoEn: new Date().toISOString(),
  viaje: {
    id: 'viaje-1',
    origenNombre: 'Campus UAGRM',
    destinoNombre: 'Monseñor Rivero',
    fechaHoraSalida: SALIDA_1,
    estado: 'reservado',
    conductor: 'Carlos Conductor',
  },
  cancelacion: {
    cancelable: true,
    montoDevolucion: '10.00',
    porcentajeDevolucion: 100,
  },
};

const RESERVA_2 = {
  reservaId: 'reserva-2',
  estado: 'confirmada',
  monto: '15.00',
  creadoEn: new Date().toISOString(),
  viaje: {
    id: 'viaje-2',
    origenNombre: 'Campus UAGRM',
    destinoNombre: 'Plan 3000',
    fechaHoraSalida: SALIDA_2,
    estado: 'reservado',
    conductor: 'Ana Conductora',
  },
  cancelacion: {
    cancelable: true,
    montoDevolucion: '15.00',
    porcentajeDevolucion: 100,
  },
};

beforeEach(async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  jest.clearAllMocks();
  cancelablesActivos.limpiar();
  await cerrarSesion().catch(() => undefined);
  mockFirmar.mockReset();
});

describe('HU-28 · Cancelación por voz (voz-cancelar)', () => {
  describe('CA-10: Sin viajes cancelables', () => {
    it('informa que no hay viajes cancelables y no navega', async () => {
      simularFetch({
        ...BASE,
        'GET /reservas/mias': { estado: 200, cuerpo: { reservas: [] } },
        'GET /viajes/mis-viajes': { estado: 200, cuerpo: [] },
      });

      const { obtener, desmontar } = await montarVoz();

      await act(async () => {
        obtener().procesarTexto('cancela mi viaje');
      });

      await waitFor(() => {
        expect(Speech.speak).toHaveBeenCalledWith(
          'No tienes viajes que se puedan cancelar.',
          { language: 'es-BO' },
        );
      });

      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(cancelablesActivos.obtener()).toHaveLength(0);

      desmontar();
    });
  });

  describe('CA-8: Exactamente un viaje cancelable', () => {
    it('lee monto a devolver, pide huella y navega a la pantalla de cancelación', async () => {
      simularFetch({
        ...BASE,
        'GET /reservas/mias': {
          estado: 200,
          cuerpo: { reservas: [RESERVA_1] },
        },
        'GET /viajes/mis-viajes': { estado: 200, cuerpo: [] },
        'GET /reservas/reserva-1': {
          estado: 200,
          cuerpo: RESERVA_1,
        },
      });

      const { obtener, desmontar } = await montarVoz();

      await act(async () => {
        obtener().procesarTexto('cancela mi viaje');
      });

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith({
          pathname: '/cancelar',
          params: { reservaId: 'reserva-1' },
        });
        expect(Speech.speak).toHaveBeenCalledWith(
          'Si cancelas ahora te devolvemos 10,00 URC. Confirma con tu huella.',
          { language: 'es-BO' },
        );
      });

      desmontar();
    });
  });

  describe('CA-9: Dos o más viajes cancelables', () => {
    it('lista los viajes cancelables y espera elección', async () => {
      simularFetch({
        ...BASE,
        'GET /reservas/mias': {
          estado: 200,
          cuerpo: { reservas: [RESERVA_1, RESERVA_2] },
        },
        'GET /viajes/mis-viajes': { estado: 200, cuerpo: [] },
      });

      const { obtener, desmontar } = await montarVoz();

      await act(async () => {
        obtener().procesarTexto('cancela mi viaje');
      });

      await waitFor(() => {
        expect(Speech.speak).toHaveBeenCalledWith(
          expect.stringMatching(
            /Tienes 2 viajes: el primero a las .*, el segundo a las .*\. ¿Cuál cancelo\?/,
          ),
          { language: 'es-BO' },
        );
      });

      // Aún no navega a /cancelar porque debe elegir
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(cancelablesActivos.obtener()).toHaveLength(2);

      desmontar();
    });

    it('«el primero» tras listar cancelables navega a la reserva seleccionada', async () => {
      simularFetch({
        ...BASE,
        'GET /reservas/mias': {
          estado: 200,
          cuerpo: { reservas: [RESERVA_1, RESERVA_2] },
        },
        'GET /viajes/mis-viajes': { estado: 200, cuerpo: [] },
        'GET /reservas/reserva-1': {
          estado: 200,
          cuerpo: RESERVA_1,
        },
      });

      const { obtener, desmontar } = await montarVoz();

      // Primero listar
      await act(async () => {
        obtener().procesarTexto('cancela mi viaje');
      });

      // Luego elegir el primero
      await act(async () => {
        obtener().procesarTexto('el primero');
      });

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith({
          pathname: '/cancelar',
          params: { reservaId: 'reserva-1' },
        });
        expect(Speech.speak).toHaveBeenCalledWith(
          'Si cancelas ahora te devolvemos 10,00 URC. Confirma con tu huella.',
          { language: 'es-BO' },
        );
      });

      desmontar();
    });

    it('«cancela el segundo» directamente navega al segundo cancelable', async () => {
      simularFetch({
        ...BASE,
        'GET /reservas/mias': {
          estado: 200,
          cuerpo: { reservas: [RESERVA_1, RESERVA_2] },
        },
        'GET /viajes/mis-viajes': { estado: 200, cuerpo: [] },
        'GET /reservas/reserva-2': {
          estado: 200,
          cuerpo: RESERVA_2,
        },
      });

      const { obtener, desmontar } = await montarVoz();

      await act(async () => {
        obtener().procesarTexto('cancela el segundo viaje');
      });

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith({
          pathname: '/cancelar',
          params: { reservaId: 'reserva-2' },
        });
        expect(Speech.speak).toHaveBeenCalledWith(
          'Si cancelas ahora te devolvemos 15,00 URC. Confirma con tu huella.',
          { language: 'es-BO' },
        );
      });

      desmontar();
    });

    it('número fuera de rango («cancela el quinto») repregunta sin navegar', async () => {
      simularFetch({
        ...BASE,
        'GET /reservas/mias': {
          estado: 200,
          cuerpo: { reservas: [RESERVA_1, RESERVA_2] },
        },
        'GET /viajes/mis-viajes': { estado: 200, cuerpo: [] },
      });

      const { obtener, desmontar } = await montarVoz();

      await act(async () => {
        obtener().procesarTexto('cancela el quinto');
      });

      await waitFor(() => {
        expect(Speech.speak).toHaveBeenCalledWith(
          'Tienes 2 viajes cancelables. ¿Cuál cancelo?',
          { language: 'es-BO' },
        );
      });

      expect(mockRouter.push).not.toHaveBeenCalled();

      desmontar();
    });
  });

  describe('Amenaza A-11 / CA-11: La voz nunca autoriza cancelación sin biometría', () => {
    it('A-11: «cancela mi viaje» NUNCA envía una firma de dispositivo ni petición mutating', async () => {
      const spyFetch = jest.spyOn(globalThis, 'fetch');

      simularFetch({
        ...BASE,
        'GET /reservas/mias': {
          estado: 200,
          cuerpo: { reservas: [RESERVA_1] },
        },
        'GET /viajes/mis-viajes': { estado: 200, cuerpo: [] },
        'GET /reservas/reserva-1': {
          estado: 200,
          cuerpo: RESERVA_1,
        },
        'POST /reservas/reserva-1/cancelar': {
          estado: 200,
          cuerpo: { cancelada: true },
        },
        'POST /viajes/viaje-1/cancelar': {
          estado: 200,
          cuerpo: { cancelada: true },
        },
      });

      const { obtener, desmontar } = await montarVoz();

      await act(async () => {
        obtener().procesarTexto('cancela mi viaje');
      });

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith({
          pathname: '/cancelar',
          params: { reservaId: 'reserva-1' },
        });
      });

      // REGLA FUNDAMENTAL DE SEGURIDAD A-11:
      // 1. La función firmar() del Keystore NUNCA fue llamada por el comando de voz
      expect(mockFirmar).not.toHaveBeenCalled();

      // 2. NINGUNA petición mutating de cancelación llegó al backend
      const llamadasCancelacion = spyFetch.mock.calls.filter(
        (call: unknown[]) => {
          const url = String(call[0]);
          const init = call[1] as RequestInit | undefined;
          return (
            url.includes('/cancelar') && init?.method && init.method === 'POST'
          );
        },
      );
      expect(llamadasCancelacion).toHaveLength(0);

      // 3. El usuario solo fue redirigido a la pantalla de confirmación biométrica
      expect(mockRouter.push).toHaveBeenCalledTimes(1);

      desmontar();
    });
  });
});

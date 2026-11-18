import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import * as Speech from 'expo-speech';
import AyudaPantalla from '@/app/ayuda';
import { cerrarSesion } from '@/api/cliente';
import { ProveedorSesion } from '@/contexto/sesion';
import {
  dispositivoReal as d,
  respuestasReales as r,
  simularFetch,
} from '@/pruebas/respuestasApi';
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

// 10 minutos en el futuro: cómodamente dentro de la ventana de 30 min de viajeAnclado
const fechaSalidaProxima = () =>
  new Date(Date.now() + 10 * 60 * 1000).toISOString();

beforeEach(async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  jest.clearAllMocks();
  await cerrarSesion().catch(() => undefined);
});

describe('HU-28 · Consultas por voz (voz-consultas)', () => {
  describe('Saldo por voz (CA-1, CA-2, CA-15)', () => {
    it('CA-1 y CA-15: «cuál es mi saldo» lee disponible y en garantía, navega a Billetera y muestra el mismo texto', async () => {
      simularFetch({
        ...BASE,
        'GET /billetera/saldo': {
          estado: 200,
          cuerpo: {
            saldoDisponible: '25.00',
            saldoBloqueadoEscrow: '10.00',
          },
        },
      });

      const { obtener, desmontar } = await montarVoz();

      await act(async () => {
        obtener().procesarTexto('cuál es mi saldo');
      });

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/(pestanas)/billetera');
        expect(Speech.speak).toHaveBeenCalledWith(
          'Tienes 25,00 URC disponibles y 10,00 en garantía.',
          { language: 'es-BO' },
        );
        expect(obtener().mensaje).toBe(
          'Tienes 25,00 URC disponibles y 10,00 en garantía.',
        );
      });

      desmontar();
    });

    it('CA-2: «cuánto saldo tengo» con garantía en 0 lee ambos montos formateados', async () => {
      simularFetch({
        ...BASE,
        'GET /billetera/saldo': {
          estado: 200,
          cuerpo: {
            saldoDisponible: '15.50',
            saldoBloqueadoEscrow: '0.00',
          },
        },
      });

      const { obtener, desmontar } = await montarVoz();

      await act(async () => {
        obtener().procesarTexto('cuánto saldo tengo');
      });

      await waitFor(() => {
        expect(Speech.speak).toHaveBeenCalledWith(
          'Tienes 15,50 URC disponibles y 0,00 en garantía.',
          { language: 'es-BO' },
        );
      });

      desmontar();
    });

    it('sin billetera activa lee que aún no tiene billetera', async () => {
      simularFetch({
        ...BASE,
        'GET /billetera/saldo': {
          estado: 404,
          cuerpo: { codigo: 'BILLETERA_NO_ENCONTRADA' },
        },
      });

      const { obtener, desmontar } = await montarVoz();

      await act(async () => {
        obtener().procesarTexto('saldo');
      });

      await waitFor(() => {
        expect(Speech.speak).toHaveBeenCalledWith('Aún no tienes billetera.', {
          language: 'es-BO',
        });
      });

      desmontar();
    });
  });

  describe('Ubicación del conductor (CA-3, CA-4, CA-5, CA-6)', () => {
    it('CA-3: «dónde viene mi conductor» lee la distancia en metros y navega al detalle de la reserva', async () => {
      const salida = fechaSalidaProxima();
      const reservaMock = {
        reservaId: 'res-123',
        estado: 'confirmada',
        monto: '10.00',
        creadoEn: new Date().toISOString(),
        viaje: {
          id: 'viaje-abc',
          origenNombre: 'Campus UAGRM',
          destinoNombre: 'Monseñor Rivero',
          fechaHoraSalida: salida,
          estado: 'reservado',
          conductor: 'Carlos Conductor',
        },
      };

      simularFetch({
        ...BASE,
        'GET /reservas/mias': {
          estado: 200,
          cuerpo: { reservas: [reservaMock] },
        },
        'GET /viajes/mis-viajes': { estado: 200, cuerpo: [] },
        'GET /reservas/res-123/conductor': {
          estado: 200,
          cuerpo: {
            disponible: true,
            distanciaM: 300,
            enPuntoDeEncuentro: false,
            haceSegundos: 20,
          },
        },
      });

      const { obtener, desmontar } = await montarVoz();

      await act(async () => {
        obtener().procesarTexto('dónde viene mi conductor');
      });

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith({
          pathname: '/reserva/[id]',
          params: { id: 'res-123', porVoz: '1' },
        });
        expect(Speech.speak).toHaveBeenCalledWith(
          'Tu conductor está a 300 metros del punto de encuentro.',
          { language: 'es-BO' },
        );
      });

      desmontar();
    });

    it('CA-3: distancia >= 1000 m se formatea en kilómetros', async () => {
      const salida = fechaSalidaProxima();
      const reservaMock = {
        reservaId: 'res-123',
        estado: 'confirmada',
        monto: '10.00',
        creadoEn: new Date().toISOString(),
        viaje: {
          id: 'viaje-abc',
          origenNombre: 'Campus UAGRM',
          destinoNombre: 'Monseñor Rivero',
          fechaHoraSalida: salida,
          estado: 'reservado',
          conductor: 'Carlos Conductor',
        },
      };

      simularFetch({
        ...BASE,
        'GET /reservas/mias': {
          estado: 200,
          cuerpo: { reservas: [reservaMock] },
        },
        'GET /viajes/mis-viajes': { estado: 200, cuerpo: [] },
        'GET /reservas/res-123/conductor': {
          estado: 200,
          cuerpo: {
            disponible: true,
            distanciaM: 1500,
            enPuntoDeEncuentro: false,
            haceSegundos: 15,
          },
        },
      });

      const { obtener, desmontar } = await montarVoz();

      await act(async () => {
        obtener().procesarTexto('dónde está el conductor');
      });

      await waitFor(() => {
        expect(Speech.speak).toHaveBeenCalledWith(
          'Tu conductor está a 1,5 km del punto de encuentro.',
          { language: 'es-BO' },
        );
      });

      desmontar();
    });

    it('CA-5: conductor a <= 50 m o enPuntoDeEncuentro lee «ya está en el punto de encuentro»', async () => {
      const salida = fechaSalidaProxima();
      const reservaMock = {
        reservaId: 'res-123',
        estado: 'confirmada',
        monto: '10.00',
        creadoEn: new Date().toISOString(),
        viaje: {
          id: 'viaje-abc',
          origenNombre: 'Campus UAGRM',
          destinoNombre: 'Monseñor Rivero',
          fechaHoraSalida: salida,
          estado: 'reservado',
          conductor: 'Carlos Conductor',
        },
      };

      simularFetch({
        ...BASE,
        'GET /reservas/mias': {
          estado: 200,
          cuerpo: { reservas: [reservaMock] },
        },
        'GET /viajes/mis-viajes': { estado: 200, cuerpo: [] },
        'GET /reservas/res-123/conductor': {
          estado: 200,
          cuerpo: {
            disponible: true,
            distanciaM: 30,
            enPuntoDeEncuentro: true,
            haceSegundos: 10,
          },
        },
      });

      const { obtener, desmontar } = await montarVoz();

      await act(async () => {
        obtener().procesarTexto('dónde está mi conductor');
      });

      await waitFor(() => {
        expect(Speech.speak).toHaveBeenCalledWith(
          'Tu conductor ya está en el punto de encuentro.',
          { language: 'es-BO' },
        );
      });

      desmontar();
    });

    it('CA-4: última posición > 60 s informa hora y punto de encuentro', async () => {
      const salida = fechaSalidaProxima();
      const reservaMock = {
        reservaId: 'res-123',
        estado: 'confirmada',
        monto: '10.00',
        creadoEn: new Date().toISOString(),
        viaje: {
          id: 'viaje-abc',
          origenNombre: 'Campus UAGRM',
          destinoNombre: 'Monseñor Rivero',
          fechaHoraSalida: salida,
          estado: 'reservado',
          conductor: 'Carlos Conductor',
        },
      };

      simularFetch({
        ...BASE,
        'GET /reservas/mias': {
          estado: 200,
          cuerpo: { reservas: [reservaMock] },
        },
        'GET /viajes/mis-viajes': { estado: 200, cuerpo: [] },
        'GET /reservas/res-123/conductor': {
          estado: 200,
          cuerpo: {
            disponible: false,
            distanciaM: null,
            enPuntoDeEncuentro: false,
            haceSegundos: 95,
          },
        },
      });

      const { obtener, desmontar } = await montarVoz();

      await act(async () => {
        obtener().procesarTexto('dónde está mi conductor');
      });

      await waitFor(() => {
        expect(Speech.speak).toHaveBeenCalledWith(
          expect.stringMatching(
            /Aún no tenemos la ubicación de tu conductor.*Campus UAGRM/,
          ),
          { language: 'es-BO' },
        );
      });

      desmontar();
    });

    it('CA-6: sin reservas activas ni viajes informa que no tiene viajes próximos', async () => {
      simularFetch({
        ...BASE,
        'GET /reservas/mias': { estado: 200, cuerpo: { reservas: [] } },
        'GET /viajes/mis-viajes': { estado: 200, cuerpo: [] },
      });

      const { obtener, desmontar } = await montarVoz();

      await act(async () => {
        obtener().procesarTexto('dónde está mi conductor');
      });

      await waitFor(() => {
        expect(Speech.speak).toHaveBeenCalledWith(
          'No tienes viajes próximos.',
          { language: 'es-BO' },
        );
      });

      desmontar();
    });
  });

  describe('Estado del viaje (CA-7)', () => {
    it('como pasajero con reserva confirmada informa el estado y la hora', async () => {
      const salida = fechaSalidaProxima();
      const reservaMock = {
        reservaId: 'res-123',
        estado: 'confirmada',
        monto: '10.00',
        creadoEn: new Date().toISOString(),
        viaje: {
          id: 'viaje-abc',
          origenNombre: 'Campus UAGRM',
          destinoNombre: 'Monseñor Rivero',
          fechaHoraSalida: salida,
          estado: 'reservado',
          conductor: 'Carlos Conductor',
        },
      };

      simularFetch({
        ...BASE,
        'GET /reservas/mias': {
          estado: 200,
          cuerpo: { reservas: [reservaMock] },
        },
        'GET /viajes/mis-viajes': { estado: 200, cuerpo: [] },
      });

      const { obtener, desmontar } = await montarVoz();

      await act(async () => {
        obtener().procesarTexto('cómo va mi viaje');
      });

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith({
          pathname: '/reserva/[id]',
          params: { id: 'res-123', porVoz: '1' },
        });
        expect(Speech.speak).toHaveBeenCalledWith(
          expect.stringMatching(/Tu reserva está confirmada para las/),
          { language: 'es-BO' },
        );
      });

      desmontar();
    });

    it('como pasajero con reserva a bordo informa que está a bordo', async () => {
      const salida = fechaSalidaProxima();
      const reservaMock = {
        reservaId: 'res-123',
        estado: 'abordada',
        monto: '10.00',
        creadoEn: new Date().toISOString(),
        viaje: {
          id: 'viaje-abc',
          origenNombre: 'Campus UAGRM',
          destinoNombre: 'Monseñor Rivero',
          fechaHoraSalida: salida,
          estado: 'en_curso',
          conductor: 'Carlos Conductor',
        },
      };

      simularFetch({
        ...BASE,
        'GET /reservas/mias': {
          estado: 200,
          cuerpo: { reservas: [reservaMock] },
        },
        'GET /viajes/mis-viajes': { estado: 200, cuerpo: [] },
      });

      const { obtener, desmontar } = await montarVoz();

      await act(async () => {
        obtener().procesarTexto('estado de mi viaje');
      });

      await waitFor(() => {
        expect(Speech.speak).toHaveBeenCalledWith(
          'Estás a bordo. Tu ubicación se comparte cada 15 s.',
          { language: 'es-BO' },
        );
      });

      desmontar();
    });

    it('como conductor informa pasajeros confirmados y a bordo', async () => {
      const salida = fechaSalidaProxima();
      const viajeMock = {
        id: 'viaje-propio',
        origenNombre: 'Campus UAGRM',
        destinoNombre: 'Plan 3000',
        fechaHoraSalida: salida,
        precioPorAsiento: 5,
        cuposTotales: 3,
        cuposDisponibles: 1,
        estado: 'reservado',
      };

      simularFetch({
        ...BASE,
        'GET /reservas/mias': { estado: 200, cuerpo: { reservas: [] } },
        'GET /viajes/mis-viajes': {
          estado: 200,
          cuerpo: [viajeMock],
        },
        'GET /viajes/viaje-propio/pasajeros': {
          estado: 200,
          cuerpo: [
            { reservaId: 'r-1', nombre: 'Ana', estado: 'confirmada' },
            { reservaId: 'r-2', nombre: 'Luis', estado: 'confirmada' },
            { reservaId: 'r-3', nombre: 'Pedro', estado: 'abordada' },
          ],
        },
      });

      const { obtener, desmontar } = await montarVoz();

      await act(async () => {
        obtener().procesarTexto('cómo va el viaje');
      });

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith({
          pathname: '/viajes/[id]',
          params: { id: 'viaje-propio', porVoz: '1' },
        });
        expect(Speech.speak).toHaveBeenCalledWith(
          expect.stringMatching(/tiene 2 pasajeros confirmados y 1 a bordo/),
          { language: 'es-BO' },
        );
      });

      desmontar();
    });
  });

  describe('Ayuda por voz y pantalla (CA-12)', () => {
    it('«ayúdame» navega a /ayuda y habla el resumen de comandos', async () => {
      const { obtener, desmontar } = await montarVoz();

      await act(async () => {
        obtener().procesarTexto('ayúdame');
      });

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/ayuda');
        expect(Speech.speak).toHaveBeenCalledWith(
          'Puedes pedirme: buscar un viaje, reservar, tu saldo, dónde está tu conductor, cómo va tu viaje o cancelar tu viaje.',
          { language: 'es-BO' },
        );
      });

      desmontar();
    });

    it('pantalla Ayuda renderiza comandos disponibles y alternativas táctiles', async () => {
      await render(
        <ProveedorSesion>
          <AyudaPantalla />
        </ProveedorSesion>,
      );

      expect(screen.getByText('Comandos de voz y ayuda')).toBeTruthy();
      expect(screen.getByText('Buscar viajes')).toBeTruthy();
      expect(screen.getByText('Reservar viaje')).toBeTruthy();
      expect(screen.getByText('Consultar saldo')).toBeTruthy();
      expect(screen.getByText('Ubicación del conductor')).toBeTruthy();
      expect(screen.getByText('Estado de tu viaje')).toBeTruthy();
      expect(screen.getByText('Cancelar viaje o reserva')).toBeTruthy();
    });
  });
});

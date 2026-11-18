import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import CancelarPantalla from '@/app/cancelar';
import { cerrarSesion } from '@/api/cliente';
import { ProveedorSesion } from '@/contexto/sesion';
import { ErrorKeystore } from '@/dispositivo/keystore';
import {
  dispositivoReal as d,
  respuestasReales as r,
  simularFetch,
} from '@/pruebas/respuestasApi';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockParams: { valor: Record<string, string> } = { valor: {} };
const mockFirmar = jest.fn();

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
    useLocalSearchParams: () => mockParams.valor,
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

jest.mock('@/dispositivo/firma', () => ({
  cabecerasFirma: (...a: unknown[]) => mockFirmar(...a),
}));

const reservaDetalleMock = {
  reservaId: 'reserva-1',
  estado: 'confirmada',
  monto: '10.00',
  creadoEn: '2026-11-15T10:00:00.000Z',
  viaje: {
    id: 'viaje-1',
    origenNombre: 'Campus UAGRM',
    destinoNombre: 'Monseñor Rivero',
    fechaHoraSalida: '2026-11-15T12:00:00.000Z',
    estado: 'reservado',
    conductor: 'Carlos',
  },
  hashTx: '0x123',
  exploradorUrl: null,
  pago: null,
  cancelacion: {
    cancelable: true,
    porcentajePasajero: 100,
    montoPasajero: '10.00',
    montoConductor: '0.00',
    motivo: 'mas_de_30_min',
  },
};

const viajeDetalleMock = {
  id: 'viaje-1',
  origen: { nombre: 'Campus UAGRM', lat: -17.77, lng: -63.19 },
  destino: { nombre: 'Monseñor Rivero', lat: -17.78, lng: -63.18 },
  fechaHoraSalida: '2026-11-15T12:00:00.000Z',
  cuposDisponibles: 1,
  cuposTotales: 3,
  precioPorAsiento: 10,
  estado: 'reservado',
  conductor: { nombre: 'Carlos' },
  vehiculo: {
    placa: '1234-ABC',
    marca: 'Toyota',
    modelo: 'Corolla',
    color: 'Blanco',
    capacidad: 4,
  },
};

const pasajerosMock = [
  { reservaId: 'res-1', nombre: 'Ana', estado: 'confirmada' },
  { reservaId: 'res-2', nombre: 'Luis', estado: 'confirmada' },
];

async function abrir(rutas: Parameters<typeof simularFetch>[0]) {
  const simulado = simularFetch({
    'POST /autenticacion/refrescar': r.sesionAprobada,
    'GET /yo': r.yoAprobada,
    'GET /dispositivos/mi-dispositivo': d.vinculado,
    ...rutas,
  });
  await render(
    <ProveedorSesion>
      <CancelarPantalla />
    </ProveedorSesion>,
  );
  return simulado;
}

beforeEach(async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  jest.clearAllMocks();
  await cerrarSesion().catch(() => undefined);
  mockFirmar.mockResolvedValue({
    'x-firma-dispositivo': 'firma-valida-base64',
    'x-timestamp': '2026-11-15T11:00:00.000Z',
    'x-nonce': 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
  });
});

describe('CancelarPantalla · HU-20 Mobile', () => {
  describe('1. Cancelación de reserva por pasajero', () => {
    beforeEach(() => {
      mockParams.valor = { reservaId: 'reserva-1' };
    });

    it('muestra vista previa con 100 % de devolución y política de cancelación', async () => {
      await abrir({
        'GET /reservas/reserva-1': { estado: 200, cuerpo: reservaDetalleMock },
      });

      await waitFor(() => {
        expect(
          screen.getByRole('header', { name: 'Cancelar reserva' }),
        ).toBeTruthy();
        expect(screen.getByText('Te devolvemos 10,00 URC')).toBeTruthy();
        expect(
          screen.getByText(
            'Si cancelas con más de 30 minutos de anticipación recibes el 100 %; con menos, el 50 %.',
          ),
        ).toBeTruthy();
      });
    });

    it('muestra compensación al conductor si la política dicta 50/50', async () => {
      const mock50 = {
        ...reservaDetalleMock,
        cancelacion: {
          cancelable: true,
          porcentajePasajero: 50,
          montoPasajero: '5.00',
          montoConductor: '5.00',
          motivo: '30_min_o_menos',
        },
      };

      await abrir({
        'GET /reservas/reserva-1': { estado: 200, cuerpo: mock50 },
      });

      await waitFor(() => {
        expect(screen.getByText('Te devolvemos 5,00 URC')).toBeTruthy();
        expect(screen.getByText('El conductor recibe 5,00 URC')).toBeTruthy();
      });
    });

    it('cancela la reserva con biometría y muestra la pantalla de éxito con reembolso', async () => {
      await abrir({
        'GET /reservas/reserva-1': { estado: 200, cuerpo: reservaDetalleMock },
        'POST /reservas/reserva-1/cancelar': {
          estado: 200,
          cuerpo: {
            estado: 'cancelada',
            reembolso: {
              estado: 'pendiente',
              montoPasajero: '10.00',
              montoConductor: '0.00',
              hashTx: null,
              exploradorUrl: null,
            },
          },
        },
      });

      await waitFor(() => {
        expect(
          screen.getByRole('header', { name: 'Cancelar reserva' }),
        ).toBeTruthy();
      });

      const botonConfirmar = screen.getByRole('button', {
        name: 'Cancelar reserva',
      });
      await act(async () => {
        fireEvent.press(botonConfirmar);
      });

      await waitFor(() => {
        expect(
          screen.getByText(
            'Cancelaste tu reserva con éxito. El reembolso se está procesando en tu billetera.',
          ),
        ).toBeTruthy();
        expect(screen.getByText('+10,00 URC')).toBeTruthy();
      });
    });

    it('maneja POLITICA_CAMBIO (409) actualizando la vista previa y mostrando aviso', async () => {
      await abrir({
        'GET /reservas/reserva-1': { estado: 200, cuerpo: reservaDetalleMock },
        'POST /reservas/reserva-1/cancelar': {
          estado: 409,
          cuerpo: {
            error: 'POLITICA_CAMBIO',
            codigo: 'POLITICA_CAMBIO',
            detalles: {
              cancelacion: {
                porcentajePasajero: 50,
                montoPasajero: '5.00',
                montoConductor: '5.00',
              },
            },
          },
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Te devolvemos 10,00 URC')).toBeTruthy();
      });

      const botonConfirmar = screen.getByRole('button', {
        name: 'Cancelar reserva',
      });
      await act(async () => {
        fireEvent.press(botonConfirmar);
      });

      await waitFor(() => {
        expect(
          screen.getByText(
            'Cambió el tiempo para la salida. La política actualizada ahora devuelve el 50 %.',
          ),
        ).toBeTruthy();
        expect(screen.getByText('Te devolvemos 5,00 URC')).toBeTruthy();
      });
    });

    it('maneja biometría cancelada por el usuario sin romper la pantalla', async () => {
      mockFirmar.mockRejectedValueOnce(
        new ErrorKeystore('BIOMETRIA_CANCELADA'),
      );

      await abrir({
        'GET /reservas/reserva-1': { estado: 200, cuerpo: reservaDetalleMock },
      });

      await waitFor(() => {
        expect(screen.getByText('Te devolvemos 10,00 URC')).toBeTruthy();
      });

      const botonConfirmar = screen.getByRole('button', {
        name: 'Cancelar reserva',
      });
      await act(async () => {
        fireEvent.press(botonConfirmar);
      });

      await waitFor(() => {
        expect(
          screen.getByText('No se confirmó la cancelación de tu reserva.'),
        ).toBeTruthy();
      });
    });
  });

  describe('2. Cancelación de viaje por conductor', () => {
    beforeEach(() => {
      mockParams.valor = { viajeId: 'viaje-1' };
    });

    it('muestra resumen de pasajeros a reembolsar y cancela el viaje con biometría', async () => {
      await abrir({
        'GET /viajes/viaje-1': { estado: 200, cuerpo: viajeDetalleMock },
        'GET /viajes/viaje-1/pasajeros': { estado: 200, cuerpo: pasajerosMock },
        'POST /viajes/viaje-1/cancelar': {
          estado: 200,
          cuerpo: {
            estado: 'cancelado',
            reservasCanceladas: 2,
          },
        },
      });

      await waitFor(() => {
        expect(
          screen.getByRole('header', { name: 'Cancelar viaje' }),
        ).toBeTruthy();
        expect(
          screen.getByText('Se devuelve el 100 % a 2 pasajeros'),
        ).toBeTruthy();
        expect(screen.getByText('Ana')).toBeTruthy();
        expect(screen.getByText('Luis')).toBeTruthy();
      });

      const botonConfirmar = screen.getByRole('button', {
        name: 'Cancelar viaje',
      });
      await act(async () => {
        fireEvent.press(botonConfirmar);
      });

      await waitFor(() => {
        expect(screen.getByText('Viaje cancelado')).toBeTruthy();
        expect(
          screen.getByText(
            'Tu viaje fue cancelado. Cada pasajero recibirá un correo con el aviso de reembolso.',
          ),
        ).toBeTruthy();
      });
    });
  });
});

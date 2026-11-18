import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import CalificarPantalla from '@/app/calificar/[reservaId]';
import { InsigniasConductor } from '@/componentes/TarjetaViaje';
import { ProveedorSesion } from '@/contexto/sesion';
import { respuestasReales as r, simularFetch } from '@/pruebas/respuestasApi';

const mockRouter = { push: jest.fn(), back: jest.fn() };

jest.mock('expo-router', () => {
  const { Text: Texto } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) => (
      <Texto>{`redirige:${href}`}</Texto>
    ),
    router: {
      push: (...a: unknown[]) => mockRouter.push(...a),
      back: () => mockRouter.back(),
    },
    useLocalSearchParams: () => ({ reservaId: 'res-1' }),
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

const SESION = {
  'POST /autenticacion/refrescar': r.sesionAprobada,
  'GET /yo': r.yoAprobada,
};
const dentroDePlazo = new Date(Date.now() + 3 * 86_400_000).toISOString();
const estado = (extra: object = {}) => ({
  estado: 200,
  cuerpo: {
    puedoCalificar: true,
    plazoHasta: dentroDePlazo,
    destinatario: 'Carlos',
    ...extra,
  },
});

const abrir = async (rutas: Parameters<typeof simularFetch>[0]) => {
  const simulado = simularFetch({ ...SESION, ...rutas });
  await render(
    <ProveedorSesion>
      <CalificarPantalla />
    </ProveedorSesion>,
  );
  return simulado;
};

beforeEach(() => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  jest.clearAllMocks();
});

describe('HU-21 · calificar', () => {
  it('CA-1, CA-2: elige estrellas, escribe un comentario, envía y ve «Gracias por calificar»', async () => {
    const { llamadas } = await abrir({
      'GET /reservas/res-1/calificaciones': estado(),
      'POST /reservas/res-1/calificaciones': {
        estado: 201,
        cuerpo: { id: 'c-1' },
      },
    });
    expect(await screen.findByText('Calificar a Carlos')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: '4 estrellas' }));
    await fireEvent.changeText(
      screen.getByLabelText('Comentario (opcional)'),
      'Puntual',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Gracias por calificar')).toBeTruthy();
    expect(
      llamadas.find((l) => l.ruta === 'POST /reservas/res-1/calificaciones')
        ?.cuerpo,
    ).toEqual({ estrellas: 4, comentario: 'Puntual' });
  });

  it('sin elegir estrellas no envía y lo dice', async () => {
    const { llamadas } = await abrir({
      'GET /reservas/res-1/calificaciones': estado(),
    });
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Enviar' }),
    );
    expect(await screen.findByText('Elige de 1 a 5 estrellas.')).toBeTruthy();
    expect(llamadas.some((l) => l.ruta.startsWith('POST /reservas'))).toBe(
      false,
    );
  });

  it('CA-3: si el servidor dice que ya calificaste, lo muestra', async () => {
    await abrir({
      'GET /reservas/res-1/calificaciones': estado(),
      'POST /reservas/res-1/calificaciones': {
        estado: 409,
        cuerpo: { codigo: 'YA_CALIFICADA' },
      },
    });
    await fireEvent.press(
      await screen.findByRole('radio', { name: '5 estrellas' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Ya calificaste este viaje.')).toBeTruthy();
  });

  it('CA-4: con el plazo vencido no hay formulario, solo el aviso', async () => {
    await abrir({
      'GET /reservas/res-1/calificaciones': estado({
        puedoCalificar: false,
        plazoHasta: new Date(Date.now() - 86_400_000).toISOString(),
      }),
    });
    expect(
      await screen.findByText('Ya pasó el plazo para calificar.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enviar' })).toBeNull();
  });

  it('CA-5: sin pago no se califica', async () => {
    await abrir({
      'GET /reservas/res-1/calificaciones': estado({
        puedoCalificar: false,
        plazoHasta: null,
      }),
    });
    expect(
      await screen.findByText('Solo puedes calificar un viaje ya pagado.'),
    ).toBeTruthy();
  });

  it('CA-7: muestra lo que te puso la otra parte solo cuando el servidor lo envía', async () => {
    await abrir({
      'GET /reservas/res-1/calificaciones': estado({
        puedoCalificar: false,
        recibida: { estrellas: 4, comentario: 'Buen pasajero' },
      }),
    });
    await waitFor(() =>
      expect(screen.getByText(/Carlos te calificó con 4 de 5/)).toBeTruthy(),
    );
    expect(screen.getByText(/Buen pasajero/)).toBeTruthy();
  });
});

describe('HU-21 CA-6 · insignia del conductor', () => {
  const conductor = (extra: object) => ({
    verificado: false,
    esNuevo: true,
    calificacionPromedio: null,
    calificaciones: 0,
    ...extra,
  });

  it('con menos de 3 calificaciones dice «Nuevo»', async () => {
    await render(<InsigniasConductor conductor={conductor({})} />);
    expect(screen.getByText('Nuevo')).toBeTruthy();
    expect(screen.queryByText(/★/)).toBeNull();
  });

  it('desde 3, el promedio con 1 decimal y la cantidad; sin «Nuevo»', async () => {
    await render(
      <InsigniasConductor
        conductor={conductor({
          esNuevo: false,
          calificacionPromedio: 4.6,
          calificaciones: 12,
        })}
      />,
    );
    expect(screen.getByText('★ 4,6 · 12 calificaciones')).toBeTruthy();
    expect(screen.queryByText('Nuevo')).toBeNull();
  });
});

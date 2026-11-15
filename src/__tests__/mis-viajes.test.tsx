import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import MisViajesPantalla from '@/app/(pestanas)/viajes';
import { Reserva, cerrarSesion } from '@/api/cliente';
import {
  proximaReserva,
  ViajeActivo,
  viajeAnclado,
} from '@/componentes/ViajeActivo';
import { MiViaje } from '@/api/cliente';
import { ProveedorSesion } from '@/contexto/sesion';
import {
  reservaReal as rr,
  respuestasReales as r,
  simularFetch,
} from '@/pruebas/respuestasApi';

const mockRouter = { push: jest.fn(), replace: jest.fn() };
// Volver a la pestaña es volver a correr el efecto de foco.
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
    },
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

const MIAS = (rr.mias.cuerpo as { reservas: Reserva[] }).reservas;
const SIN_RESERVAS = { estado: 200, cuerpo: { reservas: [] } };
const SIN_VIAJES = { estado: 200, cuerpo: [] };
const BASE = {
  'POST /autenticacion/refrescar': r.sesionAprobada,
  'GET /yo': r.yoAprobada,
  'GET /reservas/mias': rr.mias,
  'GET /viajes/mis-viajes': rr.misViajes,
};
const PASAJEROS = `GET /viajes/${rr.viajeId}/pasajeros`;

async function abrir(rutas: Parameters<typeof simularFetch>[0] = {}) {
  const simulado = simularFetch({ ...BASE, ...rutas });
  await render(
    <ProveedorSesion>
      <MisViajesPantalla />
    </ProveedorSesion>,
  );
  return simulado;
}

const veces = (llamadas: { ruta: string }[], ruta: string) =>
  llamadas.filter((l) => l.ruta === ruta).length;

beforeEach(async () => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  jest.clearAllMocks();
  await cerrarSesion().catch(() => undefined);
});

describe('HU-19 CA-14 · Mis viajes', () => {
  it('el pasajero ve su reserva con estado, monto en garantía y datos del viaje; tocarla la abre', async () => {
    await abrir();
    expect(await screen.findByText('Mis reservas')).toBeTruthy();
    expect(screen.getByText('Confirmada')).toBeTruthy();
    // En garantía en la reserva y como precio en el viaje que ofrece el mismo usuario de prueba.
    expect(screen.getAllByText('10,50 URC').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Av. Busch').length).toBeGreaterThan(0);
    expect(screen.getByText('Carlos')).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: /Reserva con Carlos, de Av. Busch/ }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith(`/reserva/${rr.reservaId}`);
  });

  it('el conductor ve sus viajes y, a pedido, el nombre de pila y el estado de cada pasajero', async () => {
    const { llamadas } = await abrir({ [PASAJEROS]: rr.pasajeros });
    expect(await screen.findByText('Viajes que ofrezco')).toBeTruthy();
    expect(screen.getByText('Reservado')).toBeTruthy();
    expect(screen.getByText('2 asientos libres')).toBeTruthy();
    // La lista de pasajeros no se pide hasta que el conductor la abre.
    expect(veces(llamadas, PASAJEROS)).toBe(0);

    await fireEvent.press(
      screen.getByRole('button', { name: 'Ver pasajeros' }),
    );
    expect(await screen.findByText('Prueba')).toBeTruthy();
    expect(screen.getAllByText('Confirmada').length).toBeGreaterThan(0);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Ocultar pasajeros' }),
    );
    expect(screen.queryByText('Prueba')).toBeNull();
  });

  it('HU-22: con un viaje reservado, el conductor abre «Mostrar código»', async () => {
    await abrir();
    await fireEvent.press(
      await screen.findByRole('button', {
        name: 'Mostrar código de abordaje',
      }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith(
      `/abordaje/mostrar/${rr.viajeId}`,
    );
  });

  it('un viaje sin pasajeros lo dice', async () => {
    await abrir({ [PASAJEROS]: { estado: 200, cuerpo: [] } });
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Ver pasajeros' }),
    );
    expect(await screen.findByText('Aún no hay pasajeros.')).toBeTruthy();
  });

  it('si no se pueden cargar los pasajeros lo dice, sin códigos', async () => {
    await abrir();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Ver pasajeros' }),
    );
    expect(
      await screen.findByText(/No pudimos cargar a tus pasajeros/),
    ).toBeTruthy();
  });

  it('sin reservas ni viajes ofrece buscar o publicar', async () => {
    await abrir({
      'GET /reservas/mias': SIN_RESERVAS,
      'GET /viajes/mis-viajes': SIN_VIAJES,
    });
    expect(
      await screen.findByText('Todavía no reservaste ningún viaje.'),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Buscar un viaje' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Publicar un viaje' }),
    );
    expect(mockRouter.push).toHaveBeenNthCalledWith(1, '/');
    expect(mockRouter.push).toHaveBeenNthCalledWith(2, '/publicar');
  });

  it('solo reservas: no muestra la sección de viajes que ofrezco', async () => {
    await abrir({ 'GET /viajes/mis-viajes': SIN_VIAJES });
    expect(await screen.findByText('Mis reservas')).toBeTruthy();
    expect(screen.queryByText('Viajes que ofrezco')).toBeNull();
  });

  it('con una falla lo dice y deja reintentar', async () => {
    const { llamadas } = await abrir({
      'GET /reservas/mias': { estado: 503, cuerpo: {} },
    });
    expect(
      await screen.findByText(/No pudimos cargar tus viajes/),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() =>
      expect(veces(llamadas, 'GET /reservas/mias')).toBeGreaterThan(1),
    );
  });

  it('al volver a la pestaña (tras reservar) se relee', async () => {
    const { llamadas } = await abrir();
    await screen.findByText('Mis reservas');
    const antes = veces(llamadas, 'GET /reservas/mias');
    mockFoco.efecto?.();
    await waitFor(() =>
      expect(veces(llamadas, 'GET /reservas/mias')).toBeGreaterThan(antes),
    );
  });

  it('sin sesión lleva a iniciar sesión', async () => {
    simularFetch({
      'POST /autenticacion/refrescar': {
        estado: 401,
        cuerpo: { codigo: 'SESION_EXPIRADA' },
      },
    });
    await render(
      <ProveedorSesion>
        <MisViajesPantalla />
      </ProveedorSesion>,
    );
    expect(await screen.findByText('redirige:/iniciar-sesion')).toBeTruthy();
  });
});

describe('HU-19 · tarjeta del viaje activo', () => {
  const reserva = (estado: Reserva['estado'], salida: string): Reserva => ({
    ...MIAS[0],
    reservaId: salida,
    estado,
    viaje: { ...MIAS[0].viaje, fechaHoraSalida: salida },
  });
  const AHORA = Date.parse('2099-03-10T12:00:00.000Z');

  it('elige la reserva activa que sale primero', () => {
    const tarde = reserva('confirmada', '2099-03-10T18:00:00.000Z');
    const pronto = reserva('pendiente', '2099-03-10T13:00:00.000Z');
    expect(proximaReserva([tarde, pronto], AHORA)).toBe(pronto);
  });

  it('ignora las que no se completaron, las ya pagadas y las que salieron hace más de una hora', () => {
    const lista = [
      reserva('fallida', '2099-03-10T13:00:00.000Z'),
      reserva('pagada', '2099-03-10T13:30:00.000Z'),
      reserva('confirmada', '2099-03-10T10:00:00.000Z'),
    ];
    expect(proximaReserva(lista, AHORA)).toBeUndefined();
  });

  it('un viaje que salió hace menos de una hora sigue siendo el activo', () => {
    const enCurso = reserva('abordada', '2099-03-10T11:30:00.000Z');
    expect(proximaReserva([enCurso], AHORA)).toBe(enCurso);
  });

  it('sin reservas no hay tarjeta', () => {
    expect(proximaReserva([], AHORA)).toBeUndefined();
  });
});

describe('HU-23 · viaje activo anclado (DESIGN_SYSTEM N7)', () => {
  const AHORA = Date.parse('2099-03-10T12:00:00.000Z');
  const MIS_VIAJES = rr.misViajes.cuerpo as MiViaje[];
  const enMin = (min: number) => new Date(AHORA + min * 60_000).toISOString();
  const reserva = (estado: Reserva['estado'], min: number): Reserva => ({
    ...MIAS[0],
    reservaId: `r${min}`,
    estado,
    viaje: { ...MIAS[0].viaje, fechaHoraSalida: enMin(min) },
  });
  const viaje = (estado: string, min: number): MiViaje => ({
    ...MIS_VIAJES[0],
    id: `v${min}`,
    estado,
    fechaHoraSalida: enMin(min),
  });

  it('el viaje en curso va primero, sin límite de hora: el del conductor y luego el de a bordo', () => {
    const conduzco = viaje('en_curso', -300);
    const aBordo = reserva('abordada', -300);
    const pronto = reserva('confirmada', 10);
    expect(viajeAnclado([pronto, aBordo], [conduzco], AHORA)).toEqual({
      viaje: conduzco,
    });
    expect(viajeAnclado([pronto, aBordo], [], AHORA)).toEqual({
      reserva: aBordo,
    });
    // A bordo sigue siendo la próxima reserva aunque haya salido hace más de una hora.
    expect(proximaReserva([aBordo], AHORA)).toBe(aBordo);
  });

  it('desde 30 min antes de la salida hasta una hora después; el que sale primero', () => {
    expect(
      viajeAnclado([reserva('confirmada', 31)], [], AHORA),
    ).toBeUndefined();
    const reservada = reserva('confirmada', 30);
    expect(viajeAnclado([reservada], [], AHORA)).toEqual({
      reserva: reservada,
    });
    const ofrezco = viaje('reservado', 20);
    expect(viajeAnclado([reservada], [ofrezco], AHORA)).toEqual({
      viaje: ofrezco,
    });
    expect(
      viajeAnclado(
        [reserva('confirmada', -61)],
        [viaje('reservado', -61)],
        AHORA,
      ),
    ).toBeUndefined();
    // Una reserva pendiente o un viaje sin reservas todavía no tienen acción.
    expect(
      viajeAnclado([reserva('pendiente', 5)], [viaje('publicado', 5)], AHORA),
    ).toBeUndefined();
  });

  it('Mis viajes: el viaje en curso va arriba con «Ver viaje en curso» como acción principal, sin repetirse', async () => {
    await abrir({
      'GET /viajes/mis-viajes': {
        estado: 200,
        cuerpo: [{ ...MIS_VIAJES[0], estado: 'en_curso' }],
      },
    });
    expect(await screen.findByText('Tu viaje en curso')).toBeTruthy();
    expect(screen.queryByText('Viajes que ofrezco')).toBeNull();
    const botones = screen
      .getAllByRole('button')
      .map((b) => b.props.accessibilityLabel);
    expect(botones.indexOf('Ver viaje en curso')).toBeLessThan(
      botones.indexOf('Mostrar código de abordaje'),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Ver viaje en curso' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith(
      `/viaje-activo/${rr.viajeId}?rol=conductor`,
    );
  });

  it('Buscar: a bordo, la tarjeta arriba lleva al viaje en curso', async () => {
    simularFetch({
      ...BASE,
      'GET /reservas/mias': {
        estado: 200,
        cuerpo: { reservas: [{ ...MIAS[0], estado: 'abordada' }] },
      },
      'GET /viajes/mis-viajes': SIN_VIAJES,
    });
    await render(
      <ProveedorSesion>
        <ViajeActivo />
      </ProveedorSesion>,
    );
    expect(await screen.findByText('Tu viaje en curso')).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Ver viaje en curso' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith(
      `/viaje-activo/${rr.reservaId}?rol=pasajero`,
    );
  });

  it('Buscar: sin viaje del momento sigue la próxima reserva, sin acción (HU-19)', async () => {
    simularFetch(BASE);
    await render(
      <ProveedorSesion>
        <ViajeActivo />
      </ProveedorSesion>,
    );
    expect(await screen.findByText('Tu próximo viaje')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Escanear/ })).toBeNull();
  });
});

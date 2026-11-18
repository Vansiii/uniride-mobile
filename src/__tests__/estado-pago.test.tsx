import { act, render, screen } from '@testing-library/react-native';
import { EstadoPago } from '@/componentes/EstadoPago';
import { reservaReal as rr, simularFetch } from '@/pruebas/respuestasApi';

const CONSULTAR = `GET /reservas/${rr.reservaId}`;
const veces = (llamadas: { ruta: string }[]) =>
  llamadas.filter((l) => l.ruta === CONSULTAR).length;
const avanzar = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
// El conductor no recibe el hash del bloqueo (libro del pasajero): `GET /reservas/:id` lo trae en null.
const delConductor = (r: typeof rr.verificada) => ({
  ...r,
  cuerpo: { ...(r.cuerpo as object), hashTx: null },
});

beforeEach(() => {
  jest.useFakeTimers({
    doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
  });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('HU-24 · estado del pago', () => {
  it('CA-1 conductor: «Recibirás» mientras se registra y «Recibiste» al confirmarse; luego deja de preguntar', async () => {
    const { llamadas } = simularFetch({
      [CONSULTAR]: [delConductor(rr.verificada), delConductor(rr.pagada)],
    });
    await render(<EstadoPago reservaId={rr.reservaId} rol="conductor" />);
    expect(await screen.findByText('Recibirás 10,50 URC')).toBeTruthy();
    expect(screen.getByText('Pendiente')).toBeTruthy();
    expect(
      screen.getByText(/Se está registrando en la red de prueba/),
    ).toBeTruthy();

    await avanzar(5000);
    expect(await screen.findByText('Recibiste 10,50 URC')).toBeTruthy();
    expect(screen.getByText('Pagado')).toBeTruthy();
    expect(screen.queryByText(/Se está registrando/)).toBeNull();
    const consultas = veces(llamadas);
    await avanzar(20_000);
    expect(veces(llamadas)).toBe(consultas);
  });

  it('CA-6: con la red caída sigue Pendiente y vuelve a preguntar solo', async () => {
    const { llamadas } = simularFetch({ [CONSULTAR]: rr.verificada });
    await render(<EstadoPago reservaId={rr.reservaId} rol="pasajero" />);
    expect(
      await screen.findByText('Pago al conductor: 10,50 URC'),
    ).toBeTruthy();
    const antes = veces(llamadas);
    await avanzar(10_000);
    expect(veces(llamadas)).toBeGreaterThan(antes);
    expect(screen.getByText('Pendiente')).toBeTruthy();
  });

  it('una reserva que todavía no está verificada no muestra pago ni sigue preguntando', async () => {
    const { llamadas } = simularFetch({ [CONSULTAR]: rr.abordada });
    await render(<EstadoPago reservaId={rr.reservaId} rol="conductor" />);
    await avanzar(0);
    expect(screen.queryByText(/Recibirás|Recibiste/)).toBeNull();
    const consultas = veces(llamadas);
    await avanzar(20_000);
    expect(veces(llamadas)).toBe(consultas);
  });
});

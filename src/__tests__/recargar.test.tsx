import {
  act,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { router } from 'expo-router';
import RecargarPantalla from '@/app/recargar';
import { cerrarSesion } from '@/api/cliente';
import { ProveedorSesion } from '@/contexto/sesion';
import { ErrorKeystore, firmar } from '@/dispositivo/keystore';
import {
  dispositivoReal as d,
  recargaReal as o,
  respuestasReales as r,
  simularFetch,
} from '@/pruebas/respuestasApi';

jest.mock('expo-router', () => {
  const { Text: Texto } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) => (
      <Texto>{`redirige:${href}`}</Texto>
    ),
    router: { push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() },
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
const CREAR = 'POST /billetera/recargas';
const CONFIRMAR = `POST /billetera/recargas/${o.ordenId}/confirmar`;
const CONSULTAR = `GET /billetera/recargas/${o.ordenId}`;
const AHORA = Date.parse('2026-11-07T15:00:00.000Z');

const veces = (llamadas: { ruta: string }[], ruta: string) =>
  llamadas.filter((l) => l.ruta === ruta).length;
const boton = (name: string) => screen.getByRole('button', { name });
const otroMonto = () => screen.getByLabelText('Otro monto');

async function abrir(rutas: Parameters<typeof simularFetch>[0] = {}) {
  const simulado = simularFetch({
    'POST /autenticacion/refrescar': r.sesionAprobada,
    'GET /yo': r.yoAprobada,
    'GET /dispositivos/mi-dispositivo': d.vinculado,
    [CREAR]: o.creada(),
    ...rutas,
  });
  await render(
    <ProveedorSesion>
      <RecargarPantalla />
    </ProveedorSesion>,
  );
  await screen.findByText('¿Cuánto quieres recargar?');
  return simulado;
}

async function abrirQr(rutas: Parameters<typeof simularFetch>[0] = {}) {
  const simulado = await abrir(rutas);
  await fireEvent.press(boton('Generar QR de pago'));
  await screen.findByText('Pagar con QR');
  return simulado;
}

/** Hace correr el reloj y los `fetch` que dispare. */
const avanzar = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

beforeEach(async () => {
  jest.clearAllMocks();
  await cerrarSesion().catch(() => undefined);
  firma.mockReset();
  firma.mockResolvedValue('firma-de-prueba');
  jest.useFakeTimers({
    doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
    now: AHORA,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Recargar · monto (CA-2, RN-1, RN-7)', () => {
  it('parte de 50 Bs, muestra el resumen y marca el pago como simulado', async () => {
    await abrir();
    expect(screen.getByText('50,00 Bs')).toBeTruthy();
    expect(screen.getByText('50,00 URC')).toBeTruthy();
    expect(
      screen.getByRole('radio', { name: '50 Bs', selected: true }),
    ).toBeTruthy();
    expect(
      screen.getByText('Pago simulado · red de prueba · sin valor real'),
    ).toBeTruthy();
  });

  it('un monto rápido se envía como número y limpia lo escrito', async () => {
    const { llamadas } = await abrir();
    await fireEvent.changeText(otroMonto(), '30');
    await fireEvent.press(screen.getByRole('radio', { name: '100 Bs' }));
    expect(otroMonto().props.value).toBe('');
    expect(screen.getByText('100,00 Bs')).toBeTruthy();
    await fireEvent.press(boton('Generar QR de pago'));
    await screen.findByText('Pagar con QR');
    expect(llamadas.find((l) => l.ruta === CREAR)?.cuerpo).toEqual({
      monto: 100,
    });
  });

  it('otro monto admite coma decimal y nunca redondea', async () => {
    const { llamadas } = await abrir();
    await fireEvent.changeText(otroMonto(), '12,50');
    expect(screen.getByText('12,50 URC')).toBeTruthy();
    await fireEvent.press(boton('Generar QR de pago'));
    await screen.findByText('Pagar con QR');
    expect(llamadas.find((l) => l.ruta === CREAR)?.cuerpo).toEqual({
      monto: 12.5,
    });
  });

  it.each([
    ['9.99', 'Puedes recargar entre 10 y 500 Bs por vez.'],
    ['500.01', 'Puedes recargar entre 10 y 500 Bs por vez.'],
    ['12,345', 'Escribe un monto con hasta 2 decimales.'],
    ['1e2', 'Escribe un monto con hasta 2 decimales.'],
    ['-50', 'Escribe un monto con hasta 2 decimales.'],
  ])('%s se rechaza sin llamar al servidor', async (monto, mensaje) => {
    const { llamadas } = await abrir();
    await fireEvent.changeText(otroMonto(), monto);
    expect(screen.getByText(mensaje)).toBeTruthy();
    expect(screen.queryByText('Pagas')).toBeNull();
    await fireEvent.press(boton('Generar QR de pago'));
    await avanzar(0);
    expect(veces(llamadas, CREAR)).toBe(0);
  });

  it.each(['10', '500', '10.00'])('%s es válido', async (monto) => {
    await abrir();
    await fireEvent.changeText(otroMonto(), monto);
    expect(screen.getByText('Pagas')).toBeTruthy();
  });

  it('el rechazo del servidor se muestra en el campo', async () => {
    await abrir({ [CREAR]: o.fueraDeRango });
    await fireEvent.press(boton('Generar QR de pago'));
    expect(
      await screen.findByText('Puedes recargar entre 10 y 500 Bs por vez.'),
    ).toBeTruthy();
    expect(screen.queryByText('Pagar con QR')).toBeNull();
  });

  it('dos toques seguidos crean una sola orden', async () => {
    const { falso, llamadas } = await abrir();
    let soltar: (respuesta: unknown) => void = () => undefined;
    falso.mockImplementationOnce(async () => {
      llamadas.push({ ruta: CREAR, cuerpo: null });
      return new Promise((resolver) => {
        soltar = resolver;
      }) as never;
    });
    await fireEvent.press(boton('Generar QR de pago'));
    await fireEvent.press(boton('Generar QR de pago'));
    soltar({
      ok: true,
      status: 201,
      json: async () => o.creada().cuerpo,
    });
    await screen.findByText('Pagar con QR');
    expect(veces(llamadas, CREAR)).toBe(1);
  });

  it('CA-6: sin identidad verificada lleva a verificarla', async () => {
    await abrir({
      [CREAR]: {
        estado: 403,
        cuerpo: { codigo: 'IDENTIDAD_NO_VERIFICADA', mensaje: '' },
      },
    });
    await fireEvent.press(boton('Generar QR de pago'));
    expect(
      await screen.findByText(
        'Verifica tu identidad para recargar. Tu billetera se crea al verificarla.',
      ),
    ).toBeTruthy();
    await fireEvent.press(boton('Verificar identidad'));
    expect(router.push).toHaveBeenCalledWith('/identidad');
    expect(screen.queryByText('Pagar con QR')).toBeNull();
  });

  it('sin sesión redirige a iniciar sesión', async () => {
    simularFetch({});
    await render(
      <ProveedorSesion>
        <RecargarPantalla />
      </ProveedorSesion>,
    );
    expect(await screen.findByText('redirige:/iniciar-sesion')).toBeTruthy();
  });
});

describe('Recargar · QR (RN-4)', () => {
  it('muestra el QR del servidor, la marca de simulado y la cuenta regresiva', async () => {
    await abrirQr();
    expect(screen.getByLabelText('Código QR de pago simulado').props.source).toEqual(
      { uri: 'data:image/png;base64,iVBORw0KGgo=' },
    );
    expect(screen.getByText('Pago simulado · red de prueba')).toBeTruthy();
    expect(screen.getByText('50,00 Bs')).toBeTruthy();
    expect(screen.getByText('Vence en 15:00')).toBeTruthy();
    await avanzar(28_000);
    expect(screen.getByText('Vence en 14:32')).toBeTruthy();
  });

  it('crear el QR y esperarlo no pide huella', async () => {
    await abrirQr();
    await avanzar(60_000);
    expect(firma).not.toHaveBeenCalled();
  });

  it('CA-5: al llegar a cero pregunta al servidor y solo entonces dice que no se cobró', async () => {
    const { llamadas } = await abrirQr({ [CONSULTAR]: o.expirada });
    await avanzar(14 * 60_000);
    expect(veces(llamadas, CONSULTAR)).toBe(0);
    await avanzar(60_000);
    await avanzar(3_000);
    expect(veces(llamadas, CONSULTAR)).toBe(1);
    expect(screen.getByText('Este QR venció')).toBeTruthy();
    expect(
      screen.getByText(
        'Pasaron 15 minutos sin confirmar el pago. No se cobró nada.',
      ),
    ).toBeTruthy();
    await avanzar(30_000);
    expect(veces(llamadas, CONSULTAR)).toBe(1);
    await fireEvent.press(boton('Generar un QR nuevo'));
    expect(screen.getByText('¿Cuánto quieres recargar?')).toBeTruthy();
  });

  it('si se perdió la respuesta de una confirmación, al vencer no dice que no se cobró', async () => {
    await abrirQr({ [CONSULTAR]: o.procesando(200) });
    await avanzar(15 * 60_000);
    await avanzar(3_000);
    expect(screen.getByText('Recarga en camino')).toBeTruthy();
    expect(screen.queryByText('Este QR venció')).toBeNull();
  });

  it('sin conexión al vencer sigue preguntando', async () => {
    const { llamadas } = await abrirQr();
    await avanzar(15 * 60_000);
    await avanzar(3_000);
    expect(veces(llamadas, CONSULTAR)).toBe(1);
    expect(screen.queryByText('Este QR venció')).toBeNull();
    await avanzar(3_000);
    expect(veces(llamadas, CONSULTAR)).toBe(2);
  });
});

describe('Recargar · confirmación (CA-1, CA-3, CA-4, RN-6)', () => {
  it('CA-1: firma una sola vez, queda procesando y se acredita sin más huellas', async () => {
    const { llamadas, falso } = await abrirQr({
      [CONFIRMAR]: o.procesando(),
      [CONSULTAR]: [o.procesando(200), o.completada],
    });
    await fireEvent.press(boton('Simular pago'));
    expect(await screen.findByText('Recarga en camino')).toBeTruthy();
    expect(
      screen.getByText(
        'Pagaste 50,00 Bs. Estamos registrando tus 50,00 URC en la red de prueba; puede tardar unos minutos.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Tu pago quedó registrado. Seguimos intentando sumar los URC; aparecerá como pendiente hasta lograrlo.',
      ),
    ).toBeTruthy();

    const llamada = falso.mock.calls.find(([url]) =>
      url.endsWith('/confirmar'),
    );
    const cabeceras = llamada?.[1]?.headers as Record<string, string>;
    expect(cabeceras['X-Firma']).toBe('firma-de-prueba');
    expect(llamada?.[1]?.body).toBeUndefined();

    await avanzar(3_000);
    expect(screen.getByText('Recarga en camino')).toBeTruthy();
    await avanzar(3_000);
    expect(screen.getByText('Recarga acreditada')).toBeTruthy();
    expect(
      screen.getByText('Sumamos 50,00 URC a tu billetera.'),
    ).toBeTruthy();
    // Acreditada no es "pago repetido".
    expect(screen.queryByText(/ya se acreditó/)).toBeNull();
    expect(firma).toHaveBeenCalledTimes(1);

    // Ya acreditada deja de preguntar.
    const consultas = veces(llamadas, CONSULTAR);
    await avanzar(30_000);
    expect(veces(llamadas, CONSULTAR)).toBe(consultas);

    await fireEvent.press(boton('Ver mi billetera'));
    expect(router.dismissTo).toHaveBeenCalledWith('/billetera');
  });

  it('dos toques a Simular pago piden una sola huella', async () => {
    let soltar: (valor: string) => void = () => undefined;
    firma.mockImplementationOnce(
      () =>
        new Promise((resolver) => {
          soltar = resolver;
        }),
    );
    const { llamadas } = await abrirQr({ [CONFIRMAR]: o.procesando() });
    await fireEvent.press(boton('Simular pago'));
    await fireEvent.press(boton('Simular pago'));
    soltar('firma-de-prueba');
    await screen.findByText('Recarga en camino');
    expect(firma).toHaveBeenCalledTimes(1);
    expect(veces(llamadas, CONFIRMAR)).toBe(1);
  });

  it('CA-3: una orden ya acreditada avisa que no se sumó dos veces', async () => {
    await abrirQr({ [CONFIRMAR]: o.completada });
    await fireEvent.press(boton('Simular pago'));
    expect(await screen.findByText('Recarga acreditada')).toBeTruthy();
    expect(
      screen.getByText(
        'Esta recarga ya se acreditó. No se cobró ni se sumó dos veces.',
      ),
    ).toBeTruthy();
  });

  it('cancelar la huella no envía nada y se puede reintentar', async () => {
    firma.mockRejectedValueOnce(new ErrorKeystore('BIOMETRIA_CANCELADA'));
    const { llamadas } = await abrirQr({ [CONFIRMAR]: o.procesando() });
    await fireEvent.press(boton('Simular pago'));
    expect(
      await screen.findByText(/Cancelaste la confirmación con tu huella/),
    ).toBeTruthy();
    expect(veces(llamadas, CONFIRMAR)).toBe(0);
    await fireEvent.press(boton('Simular pago'));
    expect(await screen.findByText('Recarga en camino')).toBeTruthy();
  });

  it('sin llave en el teléfono no finge el pago', async () => {
    firma.mockRejectedValue(new ErrorKeystore('KEYSTORE_NO_DISPONIBLE'));
    const { llamadas } = await abrirQr();
    await fireEvent.press(boton('Simular pago'));
    expect(
      await screen.findByText(/no puede usar la llave de seguridad/),
    ).toBeTruthy();
    expect(veces(llamadas, CONFIRMAR)).toBe(0);
    expect(screen.queryByText('Recarga en camino')).toBeNull();
  });

  it('CA-4: firma rechazada lleva a vincular el teléfono y no acredita', async () => {
    await abrirQr({ [CONFIRMAR]: o.firmaInvalida });
    await fireEvent.press(boton('Simular pago'));
    expect(
      await screen.findByText(
        'Para confirmar la recarga, primero vincula este teléfono.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Recarga en camino')).toBeNull();
    await fireEvent.press(boton('Vincular mi teléfono'));
    expect(router.push).toHaveBeenCalledWith('/dispositivo');
  });

  it('teléfono sin vincular: no pide huella', async () => {
    await abrirQr({ 'GET /dispositivos/mi-dispositivo': d.sinDispositivo });
    await fireEvent.press(boton('Simular pago'));
    expect(
      await screen.findByText(
        'Para confirmar la recarga, primero vincula este teléfono.',
      ),
    ).toBeTruthy();
    expect(firma).not.toHaveBeenCalled();
  });

  it('CA-5: el servidor rechaza una orden vencida', async () => {
    await abrirQr({ [CONFIRMAR]: o.ordenExpirada });
    await fireEvent.press(boton('Simular pago'));
    expect(await screen.findByText('Este QR venció')).toBeTruthy();
  });

  it('sin conexión al confirmar se reintenta sobre la misma orden, con otra firma', async () => {
    const { llamadas } = await abrirQr();
    await fireEvent.press(boton('Simular pago'));
    expect(await screen.findByText(/conexión/i)).toBeTruthy();
    simularFetch({
      'GET /dispositivos/mi-dispositivo': d.vinculado,
      [CONFIRMAR]: o.procesando(),
    });
    await fireEvent.press(boton('Simular pago'));
    expect(await screen.findByText('Recarga en camino')).toBeTruthy();
    expect(firma).toHaveBeenCalledTimes(2);
    expect(veces(llamadas, CREAR)).toBe(1);
  });

  it('mientras se acredita, una falla de red no la da por perdida', async () => {
    await abrirQr({ [CONFIRMAR]: o.procesando() });
    await fireEvent.press(boton('Simular pago'));
    await screen.findByText('Recarga en camino');
    await avanzar(9_000);
    expect(screen.getByText('Recarga en camino')).toBeTruthy();
    const { llamadas } = simularFetch({ [CONSULTAR]: o.completada });
    await avanzar(3_000);
    expect(veces(llamadas, CONSULTAR)).toBe(1);
    expect(screen.getByText('Recarga acreditada')).toBeTruthy();
  });

  it('cerrar vuelve atrás y deja de consultar', async () => {
    const { llamadas } = await abrirQr({
      [CONFIRMAR]: o.procesando(),
      [CONSULTAR]: o.procesando(200),
    });
    await fireEvent.press(boton('Simular pago'));
    await screen.findByText('Recarga en camino');
    await fireEvent.press(boton('Cerrar'));
    expect(router.back).toHaveBeenCalled();
    await screen.unmount();
    const consultas = veces(llamadas, CONSULTAR);
    await avanzar(30_000);
    expect(veces(llamadas, CONSULTAR)).toBe(consultas);
    expect(firma).toHaveBeenCalledTimes(1);
  });
});

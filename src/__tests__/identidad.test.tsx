import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import * as SelectorImagen from 'expo-image-picker';
import IdentidadPantalla from '@/app/identidad';
import { ProveedorSesion } from '@/contexto/sesion';
import { ErrorLiveness, ejecutarLiveness } from '@/identidad/liveness';
import {
  identidadReal as i,
  respuestasReales as r,
  simularFetch,
} from '@/pruebas/respuestasApi';

const mockRouter = { push: jest.fn(), back: jest.fn() };

jest.mock('expo-router', () => {
  const { Text: Texto } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) => (
      <Texto>{`redirige:${href}`}</Texto>
    ),
    router: {
      push: (...a: unknown[]) => mockRouter.push(...a),
      back: (...a: unknown[]) => mockRouter.back(...a),
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
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));
jest.mock('@/identidad/liveness', () => ({
  ejecutarLiveness: jest.fn(),
  ErrorLiveness: class ErrorLiveness extends Error {},
}));

const selector = jest.mocked(SelectorImagen);
const liveness = jest.mocked(ejecutarLiveness);
const CON_SESION = {
  'POST /autenticacion/refrescar': r.sesionAprobada,
  'GET /yo': r.yoAprobada,
};
const foto = {
  canceled: false,
  assets: [{ uri: 'file:///cache/carnet.jpg', mimeType: 'image/jpeg' }],
};
const SESION = 'sim-3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';

const abrir = async (rutas: Parameters<typeof simularFetch>[0]) => {
  const simulado = simularFetch({
    ...CON_SESION,
    'GET /identidad/estado': i.sinVerificar,
    ...rutas,
  });
  await render(
    <ProveedorSesion>
      <IdentidadPantalla />
    </ProveedorSesion>,
  );
  return simulado;
};
const presionar = (nombre: string | RegExp) =>
  fireEvent.press(screen.getByRole('button', { name: nombre }));
const paso1 = async () => {
  await screen.findByLabelText('Número de carnet');
  await fireEvent.changeText(
    screen.getByLabelText('Número de carnet'),
    '1234567-1A',
  );
  await fireEvent.press(
    screen.getByRole('checkbox', { name: /Acepto que UniRide trate/ }),
  );
  await presionar('Siguiente');
};
const hastaPaso3 = async () => {
  await paso1();
  selector.requestCameraPermissionsAsync.mockResolvedValue({
    granted: true,
  } as never);
  selector.launchCameraAsync.mockResolvedValue(foto as never);
  await presionar('Tomar foto del carnet');
  await screen.findByLabelText('Foto del carnet tomada');
  await presionar('Siguiente');
  await screen.findByText(/Mira a la cámara/);
};

beforeAll(() => {
  globalThis.FormData = jest.requireActual(
    'react-native/Libraries/Network/FormData',
  ).default;
});
beforeEach(() => {
  jest.clearAllMocks();
  liveness.mockResolvedValue(undefined);
});

describe('Verificación de identidad', () => {
  it('CA-1: recorre los tres pasos y deja la identidad verificada', async () => {
    const { llamadas } = await abrir({
      'POST /identidad/liveness-sesion': i.sesion,
      'POST /identidad/verificar': i.exito,
    });
    await hastaPaso3();
    await presionar('Iniciar prueba de vida');
    expect(
      await screen.findByText('Tu identidad está verificada.'),
    ).toBeTruthy();
    expect(liveness).toHaveBeenCalledWith(SESION);
    const envio = llamadas.filter(
      (l) => l.ruta === 'POST /identidad/verificar',
    );
    expect(envio).toHaveLength(1);
    expect(envio[0].cuerpo).toMatchObject({
      numeroDocumento: '1234567-1A',
      aceptaConsentimiento: 'true',
      sesionId: SESION,
    });
  });

  it('sin consentimiento ni número no avanza y avisa qué falta', async () => {
    await abrir({});
    await screen.findByLabelText('Número de carnet');
    await presionar('Siguiente');
    expect(screen.getByText('Escribe el número de tu carnet.')).toBeTruthy();
    expect(
      screen.getByText('Necesitamos tu consentimiento para verificarte.'),
    ).toBeTruthy();
    expect(screen.getByText(/Paso 1 de 3/)).toBeTruthy();
  });

  it('sin foto del carnet no pasa a la prueba de vida', async () => {
    await abrir({});
    await paso1();
    await presionar('Siguiente');
    expect(await screen.findByText('Toma la foto del carnet.')).toBeTruthy();
  });

  it('sin permiso de cámara lo dice y no toma la foto', async () => {
    await abrir({});
    await paso1();
    selector.requestCameraPermissionsAsync.mockResolvedValue({
      granted: false,
    } as never);
    await presionar('Tomar foto del carnet');
    expect(
      await screen.findByText(/necesitamos permiso de la cámara/),
    ).toBeTruthy();
    expect(selector.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('un rostro que no coincide vuelve al paso de la foto y exige tomar otra', async () => {
    await abrir({
      'POST /identidad/liveness-sesion': i.sesion,
      'POST /identidad/verificar': i.rostroNoCoincide,
    });
    await hastaPaso3();
    await presionar('Iniciar prueba de vida');
    expect(
      await screen.findByText(/no coincide con la foto del carnet/),
    ).toBeTruthy();
    expect(screen.getByText(/Paso 2 de 3/)).toBeTruthy();
    expect(screen.queryByLabelText('Foto del carnet tomada')).toBeNull();
  });

  it('un documento duplicado vuelve al paso 1', async () => {
    await abrir({
      'POST /identidad/liveness-sesion': i.sesion,
      'POST /identidad/verificar': i.documentoDuplicado,
    });
    await hastaPaso3();
    await presionar('Iniciar prueba de vida');
    expect(
      await screen.findByText(/ya está registrado en otra cuenta/),
    ).toBeTruthy();
    expect(screen.getByText(/Paso 1 de 3/)).toBeTruthy();
  });

  it('tras los intentos agotados muestra el bloqueo y retira el formulario', async () => {
    await abrir({
      'POST /identidad/liveness-sesion': i.sesion,
      'POST /identidad/verificar': i.intentosAgotados,
    });
    await hastaPaso3();
    await presionar('Iniciar prueba de vida');
    await waitFor(() =>
      expect(screen.getByText(/está bloqueada hasta las/)).toBeTruthy(),
    );
    expect(
      screen.queryByRole('button', { name: 'Iniciar prueba de vida' }),
    ).toBeNull();
  });

  it('si la prueba de vida no está disponible no envía nada al servidor', async () => {
    liveness.mockRejectedValue(new ErrorLiveness());
    const { llamadas } = await abrir({
      'POST /identidad/liveness-sesion': i.sesion,
    });
    await hastaPaso3();
    await presionar('Iniciar prueba de vida');
    expect(
      await screen.findByText(/todavía no puede hacer la prueba de vida/),
    ).toBeTruthy();
    expect(llamadas.some((l) => l.ruta === 'POST /identidad/verificar')).toBe(
      false,
    );
  });

  it('con la identidad ya verificada solo muestra el estado', async () => {
    await abrir({ 'GET /identidad/estado': i.verificada });
    expect(
      await screen.findByText('Tu identidad está verificada.'),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Número de carnet')).toBeNull();
  });

  it('con bloqueo vigente no ofrece verificar', async () => {
    await abrir({ 'GET /identidad/estado': i.bloqueada });
    expect(await screen.findByText(/está bloqueada hasta las/)).toBeTruthy();
    expect(screen.queryByLabelText('Número de carnet')).toBeNull();
  });

  it('si no puede consultar el estado ofrece reintentar y no verificar a ciegas', async () => {
    simularFetch({ ...CON_SESION });
    await render(
      <ProveedorSesion>
        <IdentidadPantalla />
      </ProveedorSesion>,
    );
    expect(
      await screen.findByRole('button', { name: 'Reintentar' }),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Número de carnet')).toBeNull();
  });
});

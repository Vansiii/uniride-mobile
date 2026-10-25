import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import Codigo from '@/app/codigo';
import { ProveedorSesion } from '@/contexto/sesion';
import { respuestasReales as r, simularFetch } from '@/pruebas/respuestasApi';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => {
  const { Text: Texto } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) => (
      <Texto>{`redirige:${href}`}</Texto>
    ),
    router: { back: (...a: unknown[]) => mockRouter.back(...a) },
    useLocalSearchParams: () => mockParams,
  };
});
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const CORREO = 'ana@a.hu05mob.test';
const ETIQUETA = 'Código de 6 dígitos';

const abrir = async () => {
  await render(
    <ProveedorSesion>
      <Codigo />
    </ProveedorSesion>,
  );
  await screen.findByLabelText(ETIQUETA);
};
const escribir = (texto: string) =>
  fireEvent.changeText(screen.getByLabelText(ETIQUETA), texto);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockParams = { correo: CORREO };
});

describe('Pantalla Código', () => {
  it('muestra el correo al que se envió el código y la vigencia de 10 minutos', async () => {
    simularFetch({});
    await abrir();
    expect(screen.getByText(CORREO)).toBeTruthy();
    expect(screen.getByText(/Vence en 10 minutos/)).toBeTruthy();
  });

  it('CA-2: con el sexto dígito confirma solo y, con aprobación automática, entra a la app', async () => {
    const { llamadas } = simularFetch({
      'POST /autenticacion/verificar-otp': r.sesionAprobada,
      'GET /yo': r.yoAprobada,
    });
    await abrir();
    await escribir('99965');
    expect(llamadas).toHaveLength(0);
    await escribir('999653');
    expect(await screen.findByText('redirige:/')).toBeTruthy();
    expect(llamadas[0]).toEqual({
      ruta: 'POST /autenticacion/verificar-otp',
      cuerpo: { correo: CORREO, codigo: '999653' },
    });
    expect(llamadas[1].ruta).toBe('GET /yo');
  });

  it('CA-2: con aprobación manual la sesión queda iniciada y el inicio muestra el estado de la solicitud', async () => {
    simularFetch({
      'POST /autenticacion/verificar-otp': r.sesionPendiente,
      'GET /yo': r.yoPendiente,
    });
    await abrir();
    await escribir('717849');
    // "/" decide: con todas las membresías pendientes lleva a /estado-membresia (HU-06 CA-7).
    expect(await screen.findByText('redirige:/')).toBeTruthy();
  });

  it('acepta el código pegado completo y descarta lo que no es dígito', async () => {
    const { llamadas } = simularFetch({
      'POST /autenticacion/verificar-otp': r.sesionAprobada,
      'GET /yo': r.yoAprobada,
    });
    await abrir();
    await escribir('999 653');
    await screen.findByText('redirige:/');
    expect(llamadas[0].cuerpo).toEqual({ correo: CORREO, codigo: '999653' });
  });

  it('código incorrecto: lo dice en el campo, sin código técnico, y limpia el error al escribir', async () => {
    simularFetch({ 'POST /autenticacion/verificar-otp': r.otpInvalido });
    await abrir();
    await escribir('000000');
    expect(await screen.findByText('El código no es correcto.')).toBeTruthy();
    expect(screen.queryByText(/OTP_INVALIDO/)).toBeNull();
    await escribir('00000');
    expect(screen.queryByText('El código no es correcto.')).toBeNull();
  });

  it('CA-4: tras 5 errores el registro queda en pausa con la hora y el campo se bloquea', async () => {
    simularFetch({ 'POST /autenticacion/verificar-otp': r.otpBloqueado });
    await abrir();
    await escribir('000000');
    expect(await screen.findByText('Registro en pausa')).toBeTruthy();
    expect(screen.getByText(/espera hasta las \d{2}:\d{2}/)).toBeTruthy();
    expect(screen.getByLabelText(ETIQUETA).props.editable).toBe(false);
  });

  it('CA-5: código vencido ofrece enviar uno nuevo y, al pedirlo, el campo queda limpio', async () => {
    const { llamadas } = simularFetch({
      'POST /autenticacion/verificar-otp': r.otpVencido,
      'POST /autenticacion/reenviar-codigo': r.codigoEnviado,
    });
    await abrir();
    await escribir('653116');
    expect(await screen.findByText(/El código venció/)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Enviar código nuevo' }),
    );
    expect(
      await screen.findByText('Te enviamos un código nuevo.'),
    ).toBeTruthy();
    expect(llamadas[1]).toEqual({
      ruta: 'POST /autenticacion/reenviar-codigo',
      cuerpo: { correo: CORREO, proposito: 'registro' },
    });
    expect(screen.getByLabelText(ETIQUETA).props.value).toBe('');
  });

  it('CA-6: Reenviar está desactivado con cuenta regresiva y se activa al llegar a cero', async () => {
    jest.useFakeTimers();
    mockParams = {
      correo: CORREO,
      reenviarEn: new Date(Date.now() + 42_000).toISOString(),
    };
    const { llamadas } = simularFetch({
      'POST /autenticacion/reenviar-codigo': r.codigoEnviado,
    });
    await render(
      <ProveedorSesion>
        <Codigo />
      </ProveedorSesion>,
    );
    expect(await screen.findByText('Reenviar código en 42 s')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Reenviar código' }),
    ).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.getByText('Reenviar código en 32 s')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(33_000);
    });
    await fireEvent.press(
      screen.getByRole('button', { name: 'Reenviar código' }),
    );
    await waitFor(() => expect(llamadas).toHaveLength(1));
    expect(llamadas[0].ruta).toBe('POST /autenticacion/reenviar-codigo');
    expect(
      await screen.findByText('Te enviamos un código nuevo.'),
    ).toBeTruthy();
  });

  it('RN-4: si el servidor limita el reenvío, vuelve la cuenta regresiva en vez de un error', async () => {
    jest.useFakeTimers();
    mockParams = { correo: CORREO };
    simularFetch({
      'POST /autenticacion/reenviar-codigo': {
        estado: 429,
        cuerpo: {
          ...(r.reenvioLimitado.cuerpo as object),
          reenviarEn: new Date(Date.now() + 30_000).toISOString(),
        },
      },
    });
    await render(
      <ProveedorSesion>
        <Codigo />
      </ProveedorSesion>,
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Reenviar código' }),
    );
    expect(await screen.findByText('Reenviar código en 30 s')).toBeTruthy();
  });

  it('sin conexión muestra un mensaje claro y se puede volver a intentar con el mismo código', async () => {
    simularFetch({});
    await abrir();
    await escribir('999653');
    expect(await screen.findByText(/No hay conexión/)).toBeTruthy();
    expect(screen.getByLabelText(ETIQUETA).props.editable).toBe(true);
  });

  it('sin correo en la ruta vuelve al registro', async () => {
    mockParams = {};
    simularFetch({});
    await render(
      <ProveedorSesion>
        <Codigo />
      </ProveedorSesion>,
    );
    expect(await screen.findByText('redirige:/registro')).toBeTruthy();
  });

  it('la flecha de volver regresa al registro', async () => {
    simularFetch({});
    await abrir();
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

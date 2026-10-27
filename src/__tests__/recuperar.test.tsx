import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import IniciarSesion from '@/app/iniciar-sesion';
import Recuperar from '@/app/recuperar';
import { ProveedorSesion } from '@/contexto/sesion';
import {
  recuperacionReal as rec,
  respuestasReales as r,
  simularFetch,
} from '@/pruebas/respuestasApi';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
const mockAlmacen = {
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
};

jest.mock('expo-router', () => {
  const { Text: Texto } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) => (
      <Texto>{`redirige:${href}`}</Texto>
    ),
    router: {
      push: (...a: unknown[]) => mockRouter.push(...a),
      back: (...a: unknown[]) => mockRouter.back(...a),
      replace: (...a: unknown[]) => mockRouter.replace(...a),
    },
  };
});
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('expo-secure-store', () => ({
  getItemAsync: (...a: unknown[]) => mockAlmacen.getItemAsync(...a),
  setItemAsync: (...a: unknown[]) => mockAlmacen.setItemAsync(...a),
  deleteItemAsync: (...a: unknown[]) => mockAlmacen.deleteItemAsync(...a),
}));

const CORREO = 'ana@a.p34mob.test';
const CODIGO = '713056';
const CONTRASENA = 'Nueva5678';
const ETIQUETA_CODIGO = 'Código de 6 dígitos';
const SOLICITAR = 'POST /autenticacion/recuperar-contrasena';
const RESTABLECER = 'POST /autenticacion/restablecer-contrasena';

const abrir = async () => {
  await render(
    <ProveedorSesion>
      <Recuperar />
    </ProveedorSesion>,
  );
  await screen.findByRole('button', { name: 'Enviar código' });
};

const pedirCodigo = async () => {
  await fireEvent.changeText(
    screen.getByLabelText('Correo institucional'),
    CORREO,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Enviar código' }));
  await screen.findByRole('button', { name: 'Cambiar contraseña' });
};

const escribirCodigo = (texto: string) =>
  fireEvent.changeText(screen.getByLabelText(ETIQUETA_CODIGO), texto);

const llenarYCambiar = async (codigo = CODIGO, contrasena = CONTRASENA) => {
  await escribirCodigo(codigo);
  await fireEvent.changeText(
    screen.getByLabelText('Contraseña nueva'),
    contrasena,
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'Cambiar contraseña' }),
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe('Recuperar contraseña · paso 1 (correo)', () => {
  it('CA-1: con el correo pide el código y pasa a escribirlo con la contraseña nueva', async () => {
    const { llamadas } = simularFetch({ [SOLICITAR]: rec.solicitudConCuenta });
    await abrir();
    await pedirCodigo();
    expect(llamadas).toEqual([{ ruta: SOLICITAR, cuerpo: { correo: CORREO } }]);
    expect(
      screen.getByText(
        `Si ${CORREO} tiene una cuenta, te llegará un código en unos minutos.`,
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText(ETIQUETA_CODIGO)).toBeTruthy();
    expect(screen.getByLabelText('Contraseña nueva')).toBeTruthy();
    expect(screen.getByText(/Vence en 10 minutos/)).toBeTruthy();
  });

  it('CA-2: con cuenta o sin ella la pantalla es exactamente la misma, también cuando el servidor limita el envío', async () => {
    const mismoPlazo = (respuesta: { estado: number; cuerpo: unknown }) => ({
      ...respuesta,
      cuerpo: {
        ...(respuesta.cuerpo as object),
        reenviarEn: '2026-10-27T03:47:45.000Z',
      },
    });
    const vistaConRespuesta = async (respuesta: {
      estado: number;
      cuerpo: unknown;
    }) => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-10-27T03:47:15.000Z'));
      simularFetch({ [SOLICITAR]: mismoPlazo(respuesta) });
      await abrir();
      await pedirCodigo();
      const vista = JSON.stringify(screen.toJSON());
      await screen.unmount();
      jest.useRealTimers();
      return vista;
    };
    const conCuenta = await vistaConRespuesta(rec.solicitudConCuenta);
    const sinCuenta = await vistaConRespuesta(rec.solicitudSinCuenta);
    const limitadoConCuenta = await vistaConRespuesta(rec.limitadoConCuenta);
    const limitadoSinCuenta = await vistaConRespuesta(rec.limitadoSinCuenta);
    expect(conCuenta).toContain('te llegará un código en unos minutos');
    expect(sinCuenta).toBe(conCuenta);
    expect(limitadoConCuenta).toBe(conCuenta);
    expect(limitadoSinCuenta).toBe(conCuenta);
  });

  it('un correo mal escrito se corrige en el campo y no llama a la API', async () => {
    const { llamadas } = simularFetch({});
    await abrir();
    await fireEvent.changeText(
      screen.getByLabelText('Correo institucional'),
      'ana',
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Enviar código' }),
    );
    expect(await screen.findByText(/Escribe un correo válido/)).toBeTruthy();
    expect(llamadas).toHaveLength(0);
    await fireEvent.changeText(
      screen.getByLabelText('Correo institucional'),
      'ana@',
    );
    expect(screen.queryByText(/Escribe un correo válido/)).toBeNull();
  });

  it('sin conexión muestra un mensaje claro y se queda en el correo', async () => {
    simularFetch({});
    await abrir();
    await fireEvent.changeText(
      screen.getByLabelText('Correo institucional'),
      CORREO,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Enviar código' }),
    );
    expect(await screen.findByText(/No hay conexión/)).toBeTruthy();
    expect(screen.getByLabelText('Correo institucional')).toBeTruthy();
  });

  it('si el correo está en pausa por intentos lo dice con la hora, sin código técnico', async () => {
    simularFetch({ [SOLICITAR]: rec.bloqueado });
    await abrir();
    await fireEvent.changeText(
      screen.getByLabelText('Correo institucional'),
      CORREO,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Enviar código' }),
    );
    expect(await screen.findByText('Recuperación en pausa')).toBeTruthy();
    expect(screen.getByText(/espera hasta las \d{2}:\d{2}/)).toBeTruthy();
    expect(screen.queryByText(/OTP_BLOQUEADO/)).toBeNull();
  });

  it('la flecha de volver regresa a la pantalla anterior', async () => {
    simularFetch({});
    await abrir();
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('con la sesión iniciada no se usa: lleva al inicio', async () => {
    simularFetch({
      'GET /yo': r.yoAprobada,
      'POST /autenticacion/refrescar': r.sesionAprobada,
    });
    mockAlmacen.getItemAsync.mockResolvedValueOnce('refresco-de-prueba');
    await render(
      <ProveedorSesion>
        <Recuperar />
      </ProveedorSesion>,
    );
    expect(await screen.findByText('redirige:/')).toBeTruthy();
  });
});

describe('Recuperar contraseña · paso 2 (código y contraseña nueva)', () => {
  it('CA-3: con el código y la contraseña nueva la cambia, avisa que se cierran las sesiones y lleva a iniciar sesión', async () => {
    const { llamadas } = simularFetch({
      [SOLICITAR]: rec.solicitudConCuenta,
      [RESTABLECER]: rec.restablecida,
    });
    await abrir();
    await pedirCodigo();
    expect(
      screen.getByText(
        'Al cambiarla se cerrará tu sesión en todos tus dispositivos.',
      ),
    ).toBeTruthy();
    await llenarYCambiar();
    expect(await screen.findByText('Contraseña cambiada')).toBeTruthy();
    expect(llamadas[1]).toEqual({
      ruta: RESTABLECER,
      cuerpo: { correo: CORREO, codigo: CODIGO, contrasenaNueva: CONTRASENA },
    });
    // La app no inicia sesión sola: el servidor cerró todas y se entra con la contraseña nueva.
    expect(llamadas).toHaveLength(2);
    expect(mockAlmacen.setItemAsync).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Iniciar sesión' }),
    );
    expect(mockRouter.replace).toHaveBeenCalledWith('/iniciar-sesion');
  });

  it('CA-3: con el sexto dígito el código no se envía solo: falta la contraseña', async () => {
    const { llamadas } = simularFetch({ [SOLICITAR]: rec.solicitudConCuenta });
    await abrir();
    await pedirCodigo();
    await escribirCodigo('71305');
    await escribirCodigo(CODIGO);
    expect(llamadas.map((l) => l.ruta)).toEqual([SOLICITAR]);
  });

  it('CA-3: el código pegado con espacios se limpia a 6 dígitos', async () => {
    const { llamadas } = simularFetch({
      [SOLICITAR]: rec.solicitudConCuenta,
      [RESTABLECER]: rec.restablecida,
    });
    await abrir();
    await pedirCodigo();
    await llenarYCambiar('713 056');
    await screen.findByText('Contraseña cambiada');
    expect(llamadas[1].cuerpo).toMatchObject({ codigo: CODIGO });
  });

  it('CA-4: tras 5 errores la recuperación queda en pausa con la hora y los campos se bloquean', async () => {
    simularFetch({
      [SOLICITAR]: rec.solicitudConCuenta,
      [RESTABLECER]: rec.bloqueado,
    });
    await abrir();
    await pedirCodigo();
    await llenarYCambiar('000000');
    expect(await screen.findByText('Recuperación en pausa')).toBeTruthy();
    expect(screen.getByText(/espera hasta las \d{2}:\d{2}/)).toBeTruthy();
    expect(screen.getByLabelText(ETIQUETA_CODIGO).props.editable).toBe(false);
    expect(screen.getByLabelText('Contraseña nueva').props.editable).toBe(
      false,
    );
    expect(screen.queryByText(/OTP_BLOQUEADO/)).toBeNull();
  });

  it('CA-5: un código incorrecto o ya usado se dice en el campo, sin código técnico, y se limpia al escribir', async () => {
    simularFetch({
      [SOLICITAR]: rec.solicitudConCuenta,
      [RESTABLECER]: rec.codigoInvalido,
    });
    await abrir();
    await pedirCodigo();
    await llenarYCambiar('000000');
    expect(await screen.findByText('El código no es correcto.')).toBeTruthy();
    expect(screen.queryByText(/OTP_INVALIDO/)).toBeNull();
    await escribirCodigo('00000');
    expect(screen.queryByText('El código no es correcto.')).toBeNull();
  });

  it('CA-5: un código vencido ofrece enviar uno nuevo y, al pedirlo, el campo queda limpio', async () => {
    const { llamadas } = simularFetch({
      [SOLICITAR]: rec.solicitudConCuenta,
      [RESTABLECER]: rec.vencido,
    });
    await abrir();
    await pedirCodigo();
    await llenarYCambiar();
    expect(await screen.findByText(/El código venció/)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Enviar código nuevo' }),
    );
    await waitFor(() =>
      expect(llamadas.filter((l) => l.ruta === SOLICITAR)).toHaveLength(2),
    );
    expect(screen.queryByText(/El código venció/)).toBeNull();
    expect(screen.getByLabelText(ETIQUETA_CODIGO).props.value).toBe('');
    // La contraseña escrita se conserva: solo se vuelve a pedir el código.
    expect(screen.getByLabelText('Contraseña nueva').props.value).toBe(
      CONTRASENA,
    );
  });

  it('CA-6: una contraseña que no cumple se rechaza en el campo con el requisito y sin llamar a la API', async () => {
    const { llamadas } = simularFetch({ [SOLICITAR]: rec.solicitudConCuenta });
    await abrir();
    await pedirCodigo();
    await llenarYCambiar(CODIGO, 'corta');
    expect(
      await screen.findByText(
        'Necesita al menos 8 caracteres, una letra y un número.',
      ),
    ).toBeTruthy();
    expect(llamadas.map((l) => l.ruta)).toEqual([SOLICITAR]);
    await fireEvent.changeText(
      screen.getByLabelText('Contraseña nueva'),
      'corta1234',
    );
    expect(
      screen.queryByText(
        'Necesita al menos 8 caracteres, una letra y un número.',
      ),
    ).toBeNull();
  });

  it('CA-6: sin letra o sin número tampoco se acepta', async () => {
    const { llamadas } = simularFetch({ [SOLICITAR]: rec.solicitudConCuenta });
    await abrir();
    await pedirCodigo();
    await llenarYCambiar(CODIGO, '12345678');
    await screen.findByText(/Necesita al menos 8 caracteres/);
    await llenarYCambiar(CODIGO, 'sololetras');
    await screen.findByText(/Necesita al menos 8 caracteres/);
    expect(llamadas.map((l) => l.ruta)).toEqual([SOLICITAR]);
  });

  it('CA-6: si el servidor rechaza la contraseña, el requisito sale en el campo y el código escrito se conserva', async () => {
    simularFetch({
      [SOLICITAR]: rec.solicitudConCuenta,
      [RESTABLECER]: rec.contrasenaDebil,
    });
    await abrir();
    await pedirCodigo();
    await llenarYCambiar();
    expect(
      await screen.findByText(
        'Necesita al menos 8 caracteres, una letra y un número.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/CONTRASENA_DEBIL/)).toBeNull();
    expect(screen.getByLabelText(ETIQUETA_CODIGO).props.value).toBe(CODIGO);
  });

  it('un código incompleto se pide completar y no llama a la API', async () => {
    const { llamadas } = simularFetch({ [SOLICITAR]: rec.solicitudConCuenta });
    await abrir();
    await pedirCodigo();
    await llenarYCambiar('7130');
    expect(
      await screen.findByText('Escribe el código de 6 dígitos.'),
    ).toBeTruthy();
    expect(llamadas.map((l) => l.ruta)).toEqual([SOLICITAR]);
  });

  it('RN-1: Reenviar está desactivado con cuenta regresiva y se activa al llegar a cero', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-27T03:47:15.000Z'));
    const { llamadas } = simularFetch({
      [SOLICITAR]: {
        ...rec.solicitudConCuenta,
        cuerpo: { reenviarEn: '2026-10-27T03:48:00.000Z' },
      },
    });
    await abrir();
    await pedirCodigo();
    expect(await screen.findByText('Reenviar código en 45 s')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Reenviar código' }),
    ).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(46_000);
    });
    await fireEvent.press(
      screen.getByRole('button', { name: 'Reenviar código' }),
    );
    await waitFor(() =>
      expect(llamadas.filter((l) => l.ruta === SOLICITAR)).toHaveLength(2),
    );
  });

  it('la flecha de volver regresa al correo con el correo escrito', async () => {
    simularFetch({ [SOLICITAR]: rec.solicitudConCuenta });
    await abrir();
    await pedirCodigo();
    await fireEvent.press(screen.getByRole('button', { name: 'Volver' }));
    expect(
      await screen.findByRole('button', { name: 'Enviar código' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Correo institucional').props.value).toBe(
      CORREO,
    );
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('sin conexión al cambiar muestra un mensaje claro y deja volver a intentar con los mismos datos', async () => {
    simularFetch({ [SOLICITAR]: rec.solicitudConCuenta });
    await abrir();
    await pedirCodigo();
    await llenarYCambiar();
    expect(await screen.findByText(/No hay conexión/)).toBeTruthy();
    expect(screen.getByLabelText(ETIQUETA_CODIGO).props.value).toBe(CODIGO);
    expect(screen.getByLabelText(ETIQUETA_CODIGO).props.editable).toBe(true);
  });
});

describe('Entrada a la recuperación desde Iniciar sesión', () => {
  it('el botón Olvidé mi contraseña abre la recuperación', async () => {
    simularFetch({});
    await render(
      <ProveedorSesion>
        <IniciarSesion />
      </ProveedorSesion>,
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Olvidé mi contraseña' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith('/recuperar');
  });
});

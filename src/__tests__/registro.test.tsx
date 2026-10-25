import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import IniciarSesion from '@/app/iniciar-sesion';
import Registro from '@/app/registro';
import { ProveedorSesion } from '@/contexto/sesion';
import { respuestasReales as r, simularFetch } from '@/pruebas/respuestasApi';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };

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
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const CORREO = 'ana@a.hu05mob.test';
const CONTRASENA = 'Clave1234';

const abrir = async () => {
  await render(
    <ProveedorSesion>
      <Registro />
    </ProveedorSesion>,
  );
  await screen.findByRole('button', { name: 'Crear cuenta' });
};

async function llenar({
  nombre = 'Ana Real',
  correo = CORREO,
  contrasena = CONTRASENA,
  consentimiento = true,
} = {}) {
  await fireEvent.changeText(screen.getByLabelText('Nombre completo'), nombre);
  await fireEvent.changeText(
    screen.getByLabelText('Correo institucional'),
    correo,
  );
  await fireEvent.changeText(screen.getByLabelText('Contraseña'), contrasena);
  if (consentimiento) {
    await fireEvent.press(screen.getByRole('checkbox'));
  }
  await fireEvent.press(screen.getByRole('button', { name: 'Crear cuenta' }));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Pantalla Registro', () => {
  it('CA-1: registra con nombre, correo, contraseña y consentimiento, y pasa a la pantalla del código', async () => {
    const { llamadas } = simularFetch({
      'POST /autenticacion/registro': r.codigoEnviado,
    });
    await abrir();
    await llenar();
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalled());
    expect(llamadas).toEqual([
      {
        ruta: 'POST /autenticacion/registro',
        cuerpo: {
          nombreCompleto: 'Ana Real',
          correo: CORREO,
          contrasena: CONTRASENA,
          aceptaTratamientoDatos: true,
        },
      },
    ]);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/codigo',
      params: { correo: CORREO, reenviarEn: '2026-10-25T02:56:06.092Z' },
    });
  });

  it('CA-8 (A-13): el cliente nunca envía una organización y la contraseña no viaja a la pantalla siguiente', async () => {
    const { llamadas } = simularFetch({
      'POST /autenticacion/registro': r.codigoEnviado,
    });
    await abrir();
    await llenar();
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalled());
    const cuerpo = llamadas[0].cuerpo as Record<string, unknown>;
    expect(Object.keys(cuerpo).sort()).toEqual([
      'aceptaTratamientoDatos',
      'contrasena',
      'correo',
      'nombreCompleto',
    ]);
    expect(JSON.stringify(mockRouter.push.mock.calls)).not.toContain(
      CONTRASENA,
    );
  });

  it('CA-7: un correo que ya tiene cuenta recibe la misma respuesta y la pantalla sigue igual', async () => {
    // El servidor responde 202 con la misma forma que un registro normal; la app no tiene cómo distinguirlos.
    simularFetch({ 'POST /autenticacion/registro': r.codigoEnviado });
    await abrir();
    await llenar();
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledTimes(1));
    expect(mockRouter.push.mock.calls[0][0].pathname).toBe('/codigo');
    expect(
      screen.queryByText(/ya tiene|ya existe|ya está registrado/i),
    ).toBeNull();
  });

  it('CA-3: dominio no afiliado marca el campo del correo y no pasa al código', async () => {
    simularFetch({ 'POST /autenticacion/registro': r.organizacionNoAfiliada });
    await abrir();
    await llenar({ correo: 'dario@noafiliada.hu05mob.test' });
    expect(
      await screen.findByText(/organización todavía no está afiliada/),
    ).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(screen.queryByText(/ORGANIZACION_NO_AFILIADA/)).toBeNull();
  });

  it('CA-9: sin consentimiento no se registra ni se llama a la API', async () => {
    const { falso } = simularFetch({
      'POST /autenticacion/registro': r.codigoEnviado,
    });
    await abrir();
    await llenar({ consentimiento: false });
    expect(
      await screen.findByText(/Necesitamos tu consentimiento/),
    ).toBeTruthy();
    expect(falso).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('CA-9: si el servidor rechaza el consentimiento, el error queda en la casilla', async () => {
    simularFetch({
      'POST /autenticacion/registro': r.consentimientoRequerido,
    });
    await abrir();
    await llenar();
    expect(
      await screen.findByText(/Necesitamos tu consentimiento/),
    ).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('RN-5: dice el requisito antes de fallar y rechaza una contraseña débil sin llamar a la API', async () => {
    const { falso } = simularFetch({
      'POST /autenticacion/registro': r.codigoEnviado,
    });
    await abrir();
    expect(
      screen.getByText(
        'Mínimo 8 caracteres, con al menos una letra y un número.',
      ),
    ).toBeTruthy();
    await llenar({ contrasena: 'solotexto' });
    expect(
      await screen.findByText(/al menos 8 caracteres, una letra y un número/),
    ).toBeTruthy();
    expect(falso).not.toHaveBeenCalled();
  });

  it('RN-5: si el servidor rechaza la contraseña, el error queda en ese campo', async () => {
    simularFetch({ 'POST /autenticacion/registro': r.contrasenaDebil });
    await abrir();
    await llenar();
    expect(
      await screen.findByText(/al menos 8 caracteres, una letra y un número/),
    ).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('al tocar Crear cuenta con el formulario vacío marca cada campo y no llama a la API', async () => {
    const { falso } = simularFetch({});
    await abrir();
    await fireEvent.press(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText('Escribe tu nombre completo.')).toBeTruthy();
    expect(screen.getByText(/correo válido/)).toBeTruthy();
    expect(screen.getByText(/Necesitamos tu consentimiento/)).toBeTruthy();
    expect(falso).not.toHaveBeenCalled();
  });

  it('RN-4: si ya hay un código vigente lo dice con la hora y ofrece ingresarlo', async () => {
    simularFetch({ 'POST /autenticacion/registro': r.reenvioLimitado });
    await abrir();
    await llenar();
    expect(await screen.findByText(/Ya te enviamos un código/)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Ingresar el código' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/codigo',
      params: { correo: CORREO },
    });
  });

  it('si falla el servicio de correo pide reintentar más tarde y no avanza', async () => {
    simularFetch({
      'POST /autenticacion/registro': {
        estado: 503,
        cuerpo: {
          codigo: 'CORREO_NO_DISPONIBLE',
          mensaje:
            'No pudimos enviarte el código. Inténtalo de nuevo más tarde.',
        },
      },
    });
    await abrir();
    await llenar();
    expect(
      await screen.findByText(/No pudimos enviarte el código/),
    ).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('sin conexión muestra un mensaje claro y conserva lo escrito', async () => {
    simularFetch({});
    await abrir();
    await llenar();
    expect(await screen.findByText(/No hay conexión/)).toBeTruthy();
    expect(screen.getByLabelText('Nombre completo').props.value).toBe(
      'Ana Real',
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('un error de un campo se borra al corregirlo', async () => {
    simularFetch({});
    await abrir();
    await fireEvent.press(screen.getByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByText('Escribe tu nombre completo.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Nombre completo'), 'A');
    expect(screen.queryByText('Escribe tu nombre completo.')).toBeNull();
  });

  it('Ya tengo cuenta lleva a iniciar sesión', async () => {
    simularFetch({});
    await abrir();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Ya tengo cuenta' }),
    );
    expect(mockRouter.replace).toHaveBeenCalledWith('/iniciar-sesion');
  });
});

describe('Entrada al registro desde Iniciar sesión', () => {
  it('el botón Crear cuenta abre el registro', async () => {
    simularFetch({});
    await render(
      <ProveedorSesion>
        <IniciarSesion />
      </ProveedorSesion>,
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Crear cuenta' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith('/registro');
  });
});

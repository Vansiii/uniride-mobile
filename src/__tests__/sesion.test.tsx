import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { ReactNode } from 'react';
import * as api from '@/api/cliente';
import EstadoMembresia from '@/app/estado-membresia';
import Inicio from '@/app/index';
import IniciarSesion from '@/app/iniciar-sesion';
import { ProveedorSesion } from '@/contexto/sesion';
import { t } from '@/i18n';

jest.mock('expo-router', () => {
  const { Text: Texto } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) => (
      <Texto>{`redirige:${href}`}</Texto>
    ),
  };
});
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@/api/cliente', () => ({
  ...jest.requireActual('@/api/cliente'),
  renovarSesion: jest.fn(),
  iniciarSesion: jest.fn(),
  consultarYo: jest.fn(),
  cerrarSesion: jest.fn().mockResolvedValue(undefined),
}));

const usuario = (membresias: api.Membresia[]): api.Usuario => ({
  id: '1',
  nombreCompleto: 'Ana Pérez',
  correo: 'ana@uagrm.edu.bo',
  rolPlataforma: null,
  organizacionActiva: null,
  membresias,
});

const conSesion = (nodo: ReactNode) =>
  render(<ProveedorSesion>{nodo}</ProveedorSesion>);

async function escribir(correo: string, contrasena: string) {
  await fireEvent.changeText(screen.getByLabelText('Correo'), correo);
  await fireEvent.changeText(screen.getByLabelText('Contraseña'), contrasena);
  await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(api.renovarSesion).mockResolvedValue(false);
});

describe('t()', () => {
  it('devuelve la clave si el texto no existe', () => {
    expect(t('no.existe')).toBe('no.existe');
  });
});

describe('Pantalla Iniciar sesión', () => {
  it('muestra los errores de cada campo y no llama a la API si faltan datos', async () => {
    await conSesion(<IniciarSesion />);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Entrar' }),
    );
    expect(await screen.findByText(/correo válido/)).toBeTruthy();
    expect(screen.getByText('Escribe tu contraseña.')).toBeTruthy();
    expect(api.iniciarSesion).not.toHaveBeenCalled();
  });

  it('el error de un campo se borra al corregirlo y la contraseña se puede mostrar', async () => {
    await conSesion(<IniciarSesion />);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Entrar' }),
    );
    expect(await screen.findByText('Escribe tu contraseña.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'x');
    expect(screen.queryByText('Escribe tu contraseña.')).toBeNull();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Mostrar contraseña' }),
    );
    expect(
      screen.getByRole('button', { name: 'Ocultar contraseña' }),
    ).toBeTruthy();
  });

  it('CA-1: con credenciales correctas inicia sesión y sale de la pantalla', async () => {
    jest.mocked(api.iniciarSesion).mockResolvedValue();
    jest.mocked(api.consultarYo).mockResolvedValue(usuario([]));
    await conSesion(<IniciarSesion />);
    await screen.findByRole('button', { name: 'Entrar' });
    await escribir('ana@uagrm.edu.bo', 'Clave1234');
    expect(await screen.findByText('redirige:/')).toBeTruthy();
    expect(api.iniciarSesion).toHaveBeenCalledWith(
      'ana@uagrm.edu.bo',
      'Clave1234',
    );
  });

  it('CA-2: credenciales inválidas muestran un mensaje genérico, sin código técnico', async () => {
    jest
      .mocked(api.iniciarSesion)
      .mockRejectedValue(new api.ErrorApi(401, 'CREDENCIALES_INVALIDAS'));
    await conSesion(<IniciarSesion />);
    await screen.findByRole('button', { name: 'Entrar' });
    await escribir('ana@uagrm.edu.bo', 'mala');
    expect(
      await screen.findByText(/Correo o contraseña incorrectos/),
    ).toBeTruthy();
    expect(screen.queryByText(/CREDENCIALES_INVALIDAS/)).toBeNull();
  });

  it('CA-6: cuenta bloqueada indica cuándo reintentar', async () => {
    jest.mocked(api.iniciarSesion).mockRejectedValue(
      new api.ErrorApi(429, 'SESION_BLOQUEADA', {
        reintentarEn: new Date().toISOString(),
      }),
    );
    await conSesion(<IniciarSesion />);
    await screen.findByRole('button', { name: 'Entrar' });
    await escribir('ana@uagrm.edu.bo', 'mala');
    await waitFor(() =>
      expect(screen.getByText(/Demasiados intentos/)).toBeTruthy(),
    );
  });

  it('sin conexión muestra un mensaje claro', async () => {
    jest
      .mocked(api.iniciarSesion)
      .mockRejectedValue(new api.ErrorApi(0, 'SIN_CONEXION'));
    await conSesion(<IniciarSesion />);
    await screen.findByRole('button', { name: 'Entrar' });
    await escribir('ana@uagrm.edu.bo', 'Clave1234');
    expect(await screen.findByText(/No hay conexión/)).toBeTruthy();
  });
});

describe('Inicio según la sesión y la membresía', () => {
  const conSesionDe = (u: api.Usuario | null) => {
    jest.mocked(api.renovarSesion).mockResolvedValue(u !== null);
    jest.mocked(api.consultarYo).mockResolvedValue(u as api.Usuario);
  };

  it('sin sesión lleva a iniciar sesión', async () => {
    conSesionDe(null);
    await conSesion(<Inicio />);
    expect(await screen.findByText('redirige:/iniciar-sesion')).toBeTruthy();
  });

  it('CA-7: con membresía pendiente solo ve el estado de su solicitud', async () => {
    conSesionDe(usuario([{ organizacionId: 'o1', estado: 'pendiente' }]));
    await conSesion(<Inicio />);
    expect(await screen.findByText('redirige:/estado-membresia')).toBeTruthy();
  });

  it('con membresía aprobada entra a la app', async () => {
    conSesionDe(usuario([{ organizacionId: 'o1', estado: 'aprobada' }]));
    await conSesion(<Inicio />);
    expect(await screen.findByText('Hola, Ana Pérez.')).toBeTruthy();
  });

  it('cerrar sesión devuelve a iniciar sesión', async () => {
    conSesionDe(usuario([{ organizacionId: 'o1', estado: 'aprobada' }]));
    await conSesion(<Inicio />);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Cerrar sesión' }),
    );
    expect(await screen.findByText('redirige:/iniciar-sesion')).toBeTruthy();
    expect(api.cerrarSesion).toHaveBeenCalled();
  });
});

describe('Pantalla Estado de membresía', () => {
  it('pendiente explica que falta la aprobación del administrador', async () => {
    jest.mocked(api.renovarSesion).mockResolvedValue(true);
    jest
      .mocked(api.consultarYo)
      .mockResolvedValue(
        usuario([{ organizacionId: 'o1', estado: 'pendiente' }]),
      );
    await conSesion(<EstadoMembresia />);
    expect(await screen.findByText('Pendiente de aprobación')).toBeTruthy();
  });

  it('rechazada lo dice con claridad', async () => {
    jest.mocked(api.renovarSesion).mockResolvedValue(true);
    jest
      .mocked(api.consultarYo)
      .mockResolvedValue(
        usuario([{ organizacionId: 'o1', estado: 'rechazada' }]),
      );
    await conSesion(<EstadoMembresia />);
    expect(await screen.findByText('No aprobaron tu solicitud')).toBeTruthy();
  });
});

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import AgregarOrganizacion from '@/app/agregar-organizacion';
import Codigo from '@/app/codigo';
import EstadoMembresia from '@/app/estado-membresia';
import Inicio from '@/app/(pestanas)/index';
import Organizaciones from '@/app/organizaciones';
import { ProveedorSesion } from '@/contexto/sesion';
import {
  organizacionesReales as o,
  respuestasReales as r,
  simularFetch,
} from '@/pruebas/respuestasApi';

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  dismissTo: jest.fn(),
};
let mockParams: Record<string, string> = {};
let mockRefresco: string | null = 'refresco-de-prueba';

jest.mock('expo-router', () => {
  const { Text: Texto } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) => (
      <Texto>{`redirige:${href}`}</Texto>
    ),
    router: {
      push: (...a: unknown[]) => mockRouter.push(...a),
      back: (...a: unknown[]) => mockRouter.back(...a),
      dismissTo: (...a: unknown[]) => mockRouter.dismissTo(...a),
    },
    useLocalSearchParams: () => mockParams,
  };
});
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => mockRefresco),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const CORREO_B = 'ana@pb.p7mob.test';
const ETIQUETA_CODIGO = 'Código de 6 dígitos';
const CON_SESION = {
  'POST /autenticacion/refrescar': r.sesionAprobada,
};

const abrir = async (pantalla: React.ReactElement) => {
  await render(<ProveedorSesion>{pantalla}</ProveedorSesion>);
};
const cabecerasDe = (falso: jest.Mock, indice: number) =>
  (falso.mock.calls[indice][1] as RequestInit).headers as Record<
    string,
    string
  >;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockParams = {};
  mockRefresco = 'refresco-de-prueba';
});

describe('Mis organizaciones', () => {
  it('CA-3: lista cada organización con el estado de su membresía y marca la activa', async () => {
    simularFetch({ ...CON_SESION, 'GET /yo': o.yoVarias });
    await abrir(<Organizaciones />);
    expect(await screen.findByText('P7MOB A')).toBeTruthy();
    expect(screen.getByText('Activa')).toBeTruthy();
    expect(screen.getByText('Aprobada')).toBeTruthy();
    expect(screen.getByText('Pendiente')).toBeTruthy();
    expect(screen.getByText('Rechazada')).toBeTruthy();
    // Las que no se pueden activar lo dicen (CA-5).
    expect(screen.getAllByText('Aún no puedes activarla')).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'P7MOB A' }).props.accessibilityState,
    ).toMatchObject({ selected: true, disabled: true });
  });

  it('CA-4: elegir otra aprobada cambia la activa sin cerrar sesión y usa el token nuevo', async () => {
    const { llamadas, falso } = simularFetch({
      ...CON_SESION,
      'GET /yo': [o.yoVarias, o.yoActivaB],
      'PUT /yo/organizacion-activa': o.activaCambiada,
    });
    await abrir(<Organizaciones />);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Cambiar a P7MOB B' }),
    );
    expect(
      await screen.findByText('Ahora ves los viajes de P7MOB B.'),
    ).toBeTruthy();
    const rutas = llamadas.map((l) => l.ruta);
    expect(rutas).toEqual([
      'POST /autenticacion/refrescar',
      'GET /yo',
      'PUT /yo/organizacion-activa',
      'GET /yo',
    ]);
    expect(llamadas[2].cuerpo).toEqual({ organizacionId: o.idB });
    // El token de acceso nuevo reemplaza al anterior; el de refresco no se toca.
    expect(cabecerasDe(falso, 2).Authorization).toBe('Bearer acceso-de-prueba');
    expect(cabecerasDe(falso, 3).Authorization).toBe(
      'Bearer acceso-nuevo-de-prueba',
    );
    expect(
      screen.getByRole('button', { name: 'P7MOB B' }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(
      screen.getByRole('button', { name: 'Cambiar a P7MOB A' }),
    ).toBeTruthy();
  });

  it('CA-5: una pendiente o rechazada no se puede elegir y no llama a la API', async () => {
    const { llamadas } = simularFetch({ ...CON_SESION, 'GET /yo': o.yoVarias });
    await abrir(<Organizaciones />);
    await screen.findByText('P7MOB C');
    for (const nombre of ['P7MOB C', 'P7MOB D']) {
      const fila = screen.getByRole('button', { name: nombre });
      expect(fila.props.accessibilityState).toMatchObject({ disabled: true });
      await fireEvent.press(fila);
    }
    expect(llamadas.some((l) => l.ruta.startsWith('PUT'))).toBe(false);
    expect(
      screen.queryByRole('button', { name: 'Cambiar a P7MOB C' }),
    ).toBeNull();
  });

  it('CA-5: si el servidor rechaza el cambio, lo dice sin código técnico y la activa no cambia', async () => {
    simularFetch({
      ...CON_SESION,
      'GET /yo': o.yoVarias,
      'PUT /yo/organizacion-activa': o.activaNoAprobada,
    });
    await abrir(<Organizaciones />);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Cambiar a P7MOB B' }),
    );
    expect(
      await screen.findByText(/todavía no te aprobó, así que no puedes/),
    ).toBeTruthy();
    expect(screen.queryByText(/MEMBRESIA_NO_APROBADA/)).toBeNull();
    expect(
      screen.getByRole('button', { name: 'P7MOB A' }).props.accessibilityState,
    ).toMatchObject({ selected: true });
  });

  it('sin conexión al cambiar muestra un mensaje claro', async () => {
    simularFetch({ ...CON_SESION, 'GET /yo': o.yoVarias });
    await abrir(<Organizaciones />);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Cambiar a P7MOB B' }),
    );
    expect(await screen.findByText(/No hay conexión/)).toBeTruthy();
  });

  it('Agregar organización lleva a la pantalla de alta', async () => {
    simularFetch({ ...CON_SESION, 'GET /yo': o.yoSoloA });
    await abrir(<Organizaciones />);
    await screen.findByText('P7MOB A');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Agregar organización' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith('/agregar-organizacion');
  });

  it('al volver de agregar una aprobada o pendiente lo dice', async () => {
    simularFetch({ ...CON_SESION, 'GET /yo': o.yoVarias });
    mockParams = { agregada: 'aprobada', organizacion: 'P7MOB B' };
    await abrir(<Organizaciones />);
    expect(await screen.findByText('Ya eres parte de P7MOB B.')).toBeTruthy();
  });

  it('al volver de agregar una pendiente explica que falta la aprobación', async () => {
    simularFetch({ ...CON_SESION, 'GET /yo': o.yoVarias });
    mockParams = { agregada: 'pendiente', organizacion: 'P7MOB C' };
    await abrir(<Organizaciones />);
    expect(
      await screen.findByText(/solicitud a P7MOB C está en revisión/),
    ).toBeTruthy();
  });

  it('con la pantalla ya abierta, volver de agregar actualiza el aviso con la organización nueva', async () => {
    simularFetch({ ...CON_SESION, 'GET /yo': o.yoVarias });
    const pantalla = () => (
      <ProveedorSesion>
        <Organizaciones />
      </ProveedorSesion>
    );
    const { rerender } = await render(pantalla());
    await screen.findByText('P7MOB A');
    expect(screen.queryByText(/Ya eres parte/)).toBeNull();
    // Mismo caso que `router.dismissTo` hacia la pantalla que sigue en la pila: solo cambian los parámetros.
    mockParams = { agregada: 'aprobada', organizacion: 'P7MOB B' };
    await rerender(pantalla());
    expect(await screen.findByText('Ya eres parte de P7MOB B.')).toBeTruthy();
  });

  it('sin sesión lleva a iniciar sesión', async () => {
    mockRefresco = null;
    simularFetch({});
    await abrir(<Organizaciones />);
    expect(await screen.findByText('redirige:/iniciar-sesion')).toBeTruthy();
  });
});

describe('Agregar organización', () => {
  const abrirAgregar = async (rutas: Parameters<typeof simularFetch>[0]) => {
    const simulado = simularFetch({
      ...CON_SESION,
      'GET /yo': o.yoSoloA,
      ...rutas,
    });
    await abrir(<AgregarOrganizacion />);
    await screen.findByLabelText('Correo de la otra organización');
    return simulado;
  };
  const enviarCorreo = async (correo: string) => {
    await fireEvent.changeText(
      screen.getByLabelText('Correo de la otra organización'),
      correo,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Enviar código' }),
    );
  };

  it('CA-1: con un correo de otra organización pide el código y sigue a Código con el propósito', async () => {
    const { llamadas } = await abrirAgregar({
      'POST /membresias': o.codigoEnviado,
    });
    await enviarCorreo(` ${CORREO_B} `);
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalled());
    // El cliente solo manda el correo: la organización la decide el servidor (A-13).
    expect(llamadas.find((l) => l.ruta === 'POST /membresias')?.cuerpo).toEqual(
      { correo: CORREO_B },
    );
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/codigo',
      params: {
        correo: CORREO_B,
        proposito: 'agregar_organizacion',
        reenviarEn: '2026-10-27T02:59:56.135Z',
      },
    });
  });

  it('un correo mal escrito se marca en el campo y no llama a la API', async () => {
    const { llamadas } = await abrirAgregar({});
    await enviarCorreo('ana');
    expect(await screen.findByText(/Escribe un correo válido/)).toBeTruthy();
    expect(llamadas.some((l) => l.ruta === 'POST /membresias')).toBe(false);
    await fireEvent.changeText(
      screen.getByLabelText('Correo de la otra organización'),
      'ana@',
    );
    expect(screen.queryByText(/Escribe un correo válido/)).toBeNull();
  });

  it('dominio no afiliado: error en el campo y no sigue', async () => {
    await abrirAgregar({ 'POST /membresias': o.organizacionNoAfiliada });
    await enviarCorreo('ana@gmail.com');
    expect(await screen.findByText(/todavía no está afiliada/)).toBeTruthy();
    expect(screen.queryByText(/ORGANIZACION_NO_AFILIADA/)).toBeNull();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('CA-7: si ya es miembro se lo dice y no pide código', async () => {
    await abrirAgregar({ 'POST /membresias': o.yaEsMiembro });
    await enviarCorreo('otra.ana@pa.p7mob.test');
    expect(
      await screen.findByText('Ya eres miembro de esa organización.'),
    ).toBeTruthy();
    expect(screen.queryByText(/YA_ES_MIEMBRO/)).toBeNull();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('CA-7: una solicitud rechazada antes se explica en el campo', async () => {
    await abrirAgregar({ 'POST /membresias': o.membresiaRechazada });
    await enviarCorreo('ana@pd.p7mob.test');
    expect(await screen.findByText(/rechazó tu solicitud antes/)).toBeTruthy();
    expect(screen.queryByText(/MEMBRESIA_RECHAZADA/)).toBeNull();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('un correo que ya usa otra cuenta se explica en el campo', async () => {
    await abrirAgregar({ 'POST /membresias': o.correoEnUso });
    await enviarCorreo(CORREO_B);
    expect(
      await screen.findByText(/ya está en uso en otra cuenta/),
    ).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('si ya hay un código vigente (RN-4) avisa con la hora y ofrece ingresarlo', async () => {
    await abrirAgregar({ 'POST /membresias': o.reenvioLimitado });
    await enviarCorreo(CORREO_B);
    expect(await screen.findByText(/Ya te enviamos un código/)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Ingresar el código' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/codigo',
      params: {
        correo: CORREO_B,
        proposito: 'agregar_organizacion',
        reenviarEn: '2026-10-27T02:59:56.135Z',
      },
    });
  });

  it('sin conexión muestra un mensaje claro', async () => {
    await abrirAgregar({});
    await enviarCorreo(CORREO_B);
    expect(await screen.findByText(/No hay conexión/)).toBeTruthy();
  });

  it('Cerrar vuelve a la pantalla anterior', async () => {
    await abrirAgregar({});
    await fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('sin sesión lleva a iniciar sesión', async () => {
    mockRefresco = null;
    simularFetch({});
    await abrir(<AgregarOrganizacion />);
    expect(await screen.findByText('redirige:/iniciar-sesion')).toBeTruthy();
  });
});

describe('Código para agregar una organización', () => {
  const abrirCodigo = async (rutas: Parameters<typeof simularFetch>[0]) => {
    mockParams = { correo: CORREO_B, proposito: 'agregar_organizacion' };
    const simulado = simularFetch({ ...CON_SESION, ...rutas });
    await abrir(<Codigo />);
    await screen.findByLabelText(ETIQUETA_CODIGO);
    return simulado;
  };
  const escribir = (texto: string) =>
    fireEvent.changeText(screen.getByLabelText(ETIQUETA_CODIGO), texto);

  it('con sesión iniciada no redirige a "/" y muestra el correo de la otra organización', async () => {
    await abrirCodigo({ 'GET /yo': o.yoSoloA });
    expect(screen.queryByText('redirige:/')).toBeNull();
    expect(screen.getByText(CORREO_B)).toBeTruthy();
  });

  it('CA-2: con el sexto dígito crea la membresía aprobada y vuelve a Mis organizaciones', async () => {
    const { llamadas } = await abrirCodigo({
      'GET /yo': [o.yoSoloA, o.yoVarias],
      'POST /membresias/confirmar': o.confirmadaAprobada,
    });
    await escribir('99965');
    expect(llamadas.some((l) => l.ruta.endsWith('/confirmar'))).toBe(false);
    await escribir('999653');
    await waitFor(() => expect(mockRouter.dismissTo).toHaveBeenCalled());
    expect(llamadas.find((l) => l.ruta.endsWith('/confirmar'))?.cuerpo).toEqual(
      { correo: CORREO_B, codigo: '999653' },
    );
    expect(mockRouter.dismissTo).toHaveBeenCalledWith({
      pathname: '/organizaciones',
      params: { agregada: 'aprobada', organizacion: 'P7MOB B' },
    });
    // Ya tenía una activa: no cambia sola.
    expect(llamadas.some((l) => l.ruta.startsWith('PUT'))).toBe(false);
  });

  it('CA-2: con aprobación manual la membresía queda pendiente', async () => {
    await abrirCodigo({
      'GET /yo': [o.yoSoloA, o.yoVarias],
      'POST /membresias/confirmar': o.confirmadaPendiente,
    });
    await escribir('717849');
    await waitFor(() => expect(mockRouter.dismissTo).toHaveBeenCalled());
    expect(mockRouter.dismissTo).toHaveBeenCalledWith({
      pathname: '/organizaciones',
      params: { agregada: 'pendiente', organizacion: 'P7MOB C' },
    });
  });

  it('sin organización activa, la primera aprobada pasa a serlo y guarda el token nuevo', async () => {
    const { llamadas, falso } = await abrirCodigo({
      'GET /yo': [r.yoPendiente, o.yoSoloA],
      'POST /membresias/confirmar': o.confirmadaAprobada,
      'PUT /yo/organizacion-activa': o.activaCambiada,
    });
    await escribir('999653');
    await waitFor(() => expect(mockRouter.dismissTo).toHaveBeenCalled());
    const put = llamadas.findIndex((l) => l.ruta.startsWith('PUT'));
    expect(llamadas[put].cuerpo).toEqual({ organizacionId: o.idB });
    expect(cabecerasDe(falso, put + 1).Authorization).toBe(
      'Bearer acceso-nuevo-de-prueba',
    );
  });

  it('código incorrecto: lo dice en el campo, sin código técnico', async () => {
    await abrirCodigo({
      'GET /yo': o.yoSoloA,
      'POST /membresias/confirmar': r.otpInvalido,
    });
    await escribir('000000');
    expect(await screen.findByText('El código no es correcto.')).toBeTruthy();
    expect(screen.queryByText(/OTP_INVALIDO/)).toBeNull();
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  });

  it('5 errores: la confirmación queda en pausa con la hora y el campo se bloquea', async () => {
    await abrirCodigo({
      'GET /yo': o.yoSoloA,
      'POST /membresias/confirmar': r.otpBloqueado,
    });
    await escribir('000000');
    expect(await screen.findByText('Confirmación en pausa')).toBeTruthy();
    expect(screen.queryByText('Registro en pausa')).toBeNull();
    expect(screen.getByLabelText(ETIQUETA_CODIGO).props.editable).toBe(false);
  });

  it('código vencido: el nuevo se pide con el propósito de agregar organización', async () => {
    const { llamadas } = await abrirCodigo({
      'GET /yo': o.yoSoloA,
      'POST /membresias/confirmar': r.otpVencido,
      'POST /autenticacion/reenviar-codigo': o.reenvioAgregar,
    });
    await escribir('653116');
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Enviar código nuevo' }),
    );
    expect(
      await screen.findByText('Te enviamos un código nuevo.'),
    ).toBeTruthy();
    expect(
      llamadas.find((l) => l.ruta === 'POST /autenticacion/reenviar-codigo')
        ?.cuerpo,
    ).toEqual({ correo: CORREO_B, proposito: 'agregar_organizacion' });
  });

  it('si el correo cambió de dueña o ya es miembro, lo explica', async () => {
    await abrirCodigo({
      'GET /yo': o.yoSoloA,
      'POST /membresias/confirmar': o.correoEnUso,
    });
    await escribir('999653');
    expect(
      await screen.findByText(/ya está en uso en otra cuenta/),
    ).toBeTruthy();
  });

  it('sin sesión lleva a iniciar sesión', async () => {
    mockRefresco = null;
    mockParams = { correo: CORREO_B, proposito: 'agregar_organizacion' };
    simularFetch({});
    await abrir(<Codigo />);
    expect(await screen.findByText('redirige:/iniciar-sesion')).toBeTruthy();
  });

  it('sin correo en la ruta vuelve a Agregar organización', async () => {
    mockParams = { proposito: 'agregar_organizacion' };
    simularFetch({ ...CON_SESION, 'GET /yo': o.yoSoloA });
    await abrir(<Codigo />);
    expect(
      await screen.findByText('redirige:/agregar-organizacion'),
    ).toBeTruthy();
  });
});

describe('Entradas a las pantallas de organizaciones', () => {
  it('el inicio muestra la organización activa y lleva a Mis organizaciones', async () => {
    simularFetch({ ...CON_SESION, 'GET /yo': o.yoVarias });
    await abrir(<Inicio />);
    expect(await screen.findByText('Organización activa')).toBeTruthy();
    expect(screen.getByText('P7MOB A')).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Mis organizaciones' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith('/organizaciones');
  });

  it('con solo solicitudes en espera, Estado de membresía ofrece agregar otra organización', async () => {
    simularFetch({ ...CON_SESION, 'GET /yo': r.yoPendiente });
    await abrir(<EstadoMembresia />);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Agregar otra organización' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith('/agregar-organizacion');
  });

  it('si ya tiene una aprobada, Estado de membresía devuelve al inicio', async () => {
    simularFetch({ ...CON_SESION, 'GET /yo': o.yoVarias });
    await abrir(<EstadoMembresia />);
    expect(await screen.findByText('redirige:/')).toBeTruthy();
  });
});

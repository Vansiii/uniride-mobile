import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import * as SelectorImagen from 'expo-image-picker';
import Inicio from '@/app/(pestanas)/index';
import VehiculoPantalla from '@/app/vehiculo';
import { ProveedorSesion } from '@/contexto/sesion';
import {
  respuestasReales as r,
  simularFetch,
  vehiculosReales as v,
} from '@/pruebas/respuestasApi';

const mockRouter = { push: jest.fn(), back: jest.fn() };
let mockRefresco: string | null = 'refresco-de-prueba';

// Inicio monta el formulario de búsqueda, que tiene sus propias pruebas.
jest.mock('@/componentes/FormularioBusqueda', () => ({
  FormularioBusqueda: () => null,
}));
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
  getItemAsync: jest.fn(async () => mockRefresco),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const selector = jest.mocked(SelectorImagen);
const URI_FOTO = 'file:///cache/ImagePicker/foto-del-auto.jpg';
const CON_SESION = {
  'POST /autenticacion/refrescar': r.sesionAprobada,
  'GET /yo': r.yoAprobada,
};
const SIN_VEHICULO = { ...CON_SESION, 'GET /vehiculos/mio': v.sinVehiculo };
const UN_MB = 1024 * 1024;

const fotoElegida = (extra: Record<string, unknown> = {}) => ({
  canceled: false,
  assets: [
    { uri: URI_FOTO, mimeType: 'image/jpeg', fileSize: 2 * UN_MB, ...extra },
  ],
});

const abrir = async (pantalla: React.ReactElement = <VehiculoPantalla />) => {
  await render(<ProveedorSesion>{pantalla}</ProveedorSesion>);
};
const abrirFormulario = async (rutas: Parameters<typeof simularFetch>[0]) => {
  const simulado = simularFetch({ ...SIN_VEHICULO, ...rutas });
  await abrir();
  await screen.findByLabelText('Placa');
  return simulado;
};
const escribir = (etiqueta: string, texto: string) =>
  fireEvent.changeText(screen.getByLabelText(etiqueta), texto);
const presionar = (nombre: string) =>
  fireEvent.press(screen.getByRole('button', { name: nombre }));
const llenar = async (extra: Partial<Record<string, string>> = {}) => {
  const datos = {
    Placa: '1234-abc',
    Marca: 'Toyota',
    Modelo: 'Corolla',
    Color: 'Blanco',
    'Asientos para pasajeros': '4',
    ...extra,
  };
  for (const [etiqueta, texto] of Object.entries(datos))
    await escribir(etiqueta, texto);
};
const elegirFotoDeGaleria = async (resultado = fotoElegida()) => {
  selector.launchImageLibraryAsync.mockResolvedValue(resultado as never);
  await presionar('Elegir de la galería');
  await screen.findByLabelText('Foto elegida del vehículo');
};
const aceptarConsentimiento = () =>
  fireEvent.press(
    screen.getByRole('checkbox', { name: /Acepto que UniRide guarde la foto/ }),
  );
const registrar = () => presionar('Registrar vehículo');
const completo = async () => {
  await llenar();
  await elegirFotoDeGaleria();
  await aceptarConsentimiento();
};
const cabecerasDe = (falso: jest.Mock, indice: number) =>
  (falso.mock.calls[indice][1] as RequestInit).headers as Record<
    string,
    string
  >;
const envios = (llamadas: { ruta: string; cuerpo: unknown }[]) =>
  llamadas.filter((l) => l.ruta === 'POST /vehiculos');

// En el teléfono `FormData` es el de React Native (adjunta `{ uri, name, type }` como archivo); Node no lo entiende.
beforeAll(() => {
  globalThis.FormData = jest.requireActual(
    'react-native/Libraries/Network/FormData',
  ).default;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockRefresco = 'refresco-de-prueba';
});

describe('Registrar vehículo', () => {
  it('CA-1: con todos los datos, la foto y el consentimiento lo registra a nombre de la persona', async () => {
    const { llamadas, falso } = await abrirFormulario({
      'POST /vehiculos': v.registrado,
    });
    await completo();
    await registrar();
    expect(
      await screen.findByText('Tu vehículo quedó registrado.'),
    ).toBeTruthy();
    const envio = envios(llamadas);
    expect(envio).toHaveLength(1);
    // La placa viaja como la escribió la persona: el servidor la normaliza (CA-3).
    expect(envio[0].cuerpo).toMatchObject({
      placa: '1234-abc',
      marca: 'Toyota',
      modelo: 'Corolla',
      color: 'Blanco',
      capacidad: '4',
      aceptaUsoFoto: 'true',
      foto: { archivo: true, uri: URI_FOTO, type: 'image/jpeg' },
    });
    // Ni el dueño ni el cuerpo llevan datos que identifiquen a la persona: la sesión va en el token.
    expect(Object.keys(envio[0].cuerpo as object).sort()).toEqual([
      'aceptaUsoFoto',
      'capacidad',
      'color',
      'foto',
      'marca',
      'modelo',
      'placa',
    ]);
    // Multipart: sin Content-Type JSON, para que fetch ponga el límite entre partes.
    const indice = llamadas.findIndex((l) => l.ruta === 'POST /vehiculos');
    expect(cabecerasDe(falso, indice)['Content-Type']).toBeUndefined();
    expect(cabecerasDe(falso, indice).Authorization).toBe(
      'Bearer acceso-de-prueba',
    );
  });

  it('CA-1 / CA-3: muestra el vehículo registrado con la placa normalizada que devolvió el servidor', async () => {
    await abrirFormulario({ 'POST /vehiculos': v.registrado });
    await completo();
    await registrar();
    expect(await screen.findByText('1234ABC')).toBeTruthy();
    expect(screen.getByText('Toyota')).toBeTruthy();
    expect(screen.getByText('Corolla')).toBeTruthy();
    expect(screen.getByText('Blanco')).toBeTruthy();
    expect(screen.getByText('4 asientos para pasajeros')).toBeTruthy();
    // Ya no hay formulario ni botón de registrar (un vehículo por persona, RN-4).
    expect(screen.queryByLabelText('Placa')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Registrar vehículo' }),
    ).toBeNull();
  });

  it('CA-7: la foto se quita de la pantalla al registrar y nunca se muestra ni se registra en consola', async () => {
    const registros = ['log', 'info', 'warn', 'error', 'debug'].map((m) =>
      jest.spyOn(console, m as 'log').mockImplementation(() => undefined),
    );
    await abrirFormulario({ 'POST /vehiculos': v.registrado });
    await completo();
    expect(screen.getByLabelText('Foto elegida del vehículo')).toBeTruthy();
    await registrar();
    await screen.findByText('1234ABC');
    expect(screen.queryByLabelText('Foto elegida del vehículo')).toBeNull();
    for (const registro of registros) {
      expect(JSON.stringify(registro.mock.calls)).not.toContain(URI_FOTO);
      registro.mockRestore();
    }
  });

  it('RN-5: sin consentimiento no se envía nada y lo pide en la casilla', async () => {
    const { llamadas } = await abrirFormulario({});
    await llenar();
    await elegirFotoDeGaleria();
    await registrar();
    expect(
      await screen.findByText(
        'Necesitamos tu consentimiento para guardar la foto.',
      ),
    ).toBeTruthy();
    expect(envios(llamadas)).toHaveLength(0);
    // Marcarla quita el error.
    await aceptarConsentimiento();
    expect(
      screen.queryByText('Necesitamos tu consentimiento para guardar la foto.'),
    ).toBeNull();
  });

  it('el servidor también exige el consentimiento y se lo dice en la casilla', async () => {
    await abrirFormulario({ 'POST /vehiculos': v.consentimientoRequerido });
    await completo();
    await registrar();
    expect(
      await screen.findByText(
        'Necesitamos tu consentimiento para guardar la foto.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/CONSENTIMIENTO_REQUERIDO/)).toBeNull();
  });

  it('CA-4: con todo vacío marca cada campo y no llama a la API', async () => {
    const { llamadas } = await abrirFormulario({});
    await registrar();
    expect(await screen.findByText('Escribe la placa.')).toBeTruthy();
    expect(screen.getByText('Escribe la marca.')).toBeTruthy();
    expect(screen.getByText('Escribe el modelo.')).toBeTruthy();
    expect(screen.getByText('Escribe el color.')).toBeTruthy();
    expect(
      screen.getByText('Escribe un número de asientos entre 1 y 6.'),
    ).toBeTruthy();
    expect(screen.getByText('Agrega una foto del vehículo.')).toBeTruthy();
    expect(
      screen.getByText('Necesitamos tu consentimiento para guardar la foto.'),
    ).toBeTruthy();
    expect(envios(llamadas)).toHaveLength(0);
  });

  it.each([
    ['12-AB', 'placa de 2 números'],
    ['12345ABC', 'placa de 5 números'],
    ['1234AB', 'placa de 2 letras'],
    ['ABC1234', 'placa con las letras antes'],
  ])(
    'CA-4: la placa "%s" (%s) se marca en el campo y no se envía',
    async (placa) => {
      const { llamadas } = await abrirFormulario({});
      await llenar({ Placa: placa });
      await elegirFotoDeGaleria();
      await aceptarConsentimiento();
      await registrar();
      expect(
        await screen.findByText(
          'La placa lleva 3 o 4 números y 3 letras, por ejemplo 1234-ABC.',
        ),
      ).toBeTruthy();
      expect(envios(llamadas)).toHaveLength(0);
    },
  );

  it.each([['0'], ['7'], ['x'], ['']])(
    'CA-4: la capacidad "%s" está fuera de 1 a 6 y no se envía',
    async (capacidad) => {
      const { llamadas } = await abrirFormulario({});
      await llenar({ 'Asientos para pasajeros': capacidad });
      await elegirFotoDeGaleria();
      await aceptarConsentimiento();
      await registrar();
      expect(
        await screen.findByText('Escribe un número de asientos entre 1 y 6.'),
      ).toBeTruthy();
      expect(envios(llamadas)).toHaveLength(0);
    },
  );

  it.each([['1'], ['6']])(
    'CA-4: la capacidad %s, en los extremos del rango, se envía',
    async (capacidad) => {
      const { llamadas } = await abrirFormulario({
        'POST /vehiculos': v.registrado,
      });
      await llenar({ 'Asientos para pasajeros': capacidad });
      await elegirFotoDeGaleria();
      await aceptarConsentimiento();
      await registrar();
      await screen.findByText('Tu vehículo quedó registrado.');
      expect(envios(llamadas)[0].cuerpo).toMatchObject({ capacidad });
    },
  );

  it('CA-4: un texto de más de 40 caracteres se marca antes de enviar', async () => {
    const { llamadas } = await abrirFormulario({});
    await llenar({ Marca: 'M'.repeat(41) });
    await elegirFotoDeGaleria();
    await aceptarConsentimiento();
    await registrar();
    expect(
      await screen.findByText('Usa 40 caracteres como máximo.'),
    ).toBeTruthy();
    expect(envios(llamadas)).toHaveLength(0);
  });

  it('CA-4: si el servidor rechaza la placa, la marca en el campo sin código técnico', async () => {
    await abrirFormulario({ 'POST /vehiculos': v.placaInvalida });
    await completo();
    await registrar();
    expect(
      await screen.findByText(
        'La placa lleva 3 o 4 números y 3 letras, por ejemplo 1234-ABC.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/VEHICULO_DATO_INVALIDO/)).toBeNull();
    // Sigue el formulario con lo escrito, para corregir.
    expect(screen.getByLabelText('Marca').props.value).toBe('Toyota');
  });

  it('CA-4: si el servidor rechaza la capacidad, la marca en el campo', async () => {
    await abrirFormulario({ 'POST /vehiculos': v.capacidadInvalida });
    await completo();
    await registrar();
    expect(
      await screen.findByText('Escribe un número de asientos entre 1 y 6.'),
    ).toBeTruthy();
  });

  it('CA-2: una placa ya registrada se rechaza en el campo de la placa', async () => {
    await abrirFormulario({ 'POST /vehiculos': v.placaDuplicada });
    await completo();
    await registrar();
    expect(
      await screen.findByText('Esa placa ya está registrada en UniRide.'),
    ).toBeTruthy();
    expect(screen.queryByText(/VEHICULO_PLACA_DUPLICADA/)).toBeNull();
    // No dice quién la tiene y deja corregir la placa sin perder lo demás.
    expect(screen.getByLabelText('Modelo').props.value).toBe('Corolla');
    await escribir('Placa', '4321-xyz');
    expect(
      screen.queryByText('Esa placa ya está registrada en UniRide.'),
    ).toBeNull();
  });

  it('RN-4: si ya tenía un vehículo muestra el que quedó y lo avisa', async () => {
    await abrirFormulario({
      'POST /vehiculos': v.yaRegistrado,
      'GET /vehiculos/mio': [v.sinVehiculo, v.mio],
    });
    await completo();
    await registrar();
    expect(
      await screen.findByText('Ya tenías un vehículo registrado.'),
    ).toBeTruthy();
    expect(screen.getByText('1234ABC')).toBeTruthy();
    expect(screen.queryByLabelText('Placa')).toBeNull();
  });

  it('con una foto que el servidor no acepta dice el límite y conserva lo escrito', async () => {
    await abrirFormulario({ 'POST /vehiculos': v.fotoInvalida });
    await completo();
    await registrar();
    expect(
      await screen.findByText(
        'La foto debe ser JPEG o PNG y pesar como máximo 5 MB.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/VEHICULO_FOTO_INVALIDA/)).toBeNull();
    expect(screen.getByLabelText('Modelo').props.value).toBe('Corolla');
  });

  it('si falla el almacenamiento lo dice, no se registró nada y se puede reintentar con la misma foto', async () => {
    const { llamadas } = await abrirFormulario({
      'POST /vehiculos': [v.almacenamientoNoDisponible, v.registrado],
    });
    await completo();
    await registrar();
    expect(await screen.findByText(/no se registró nada/)).toBeTruthy();
    expect(screen.queryByText(/ALMACENAMIENTO_NO_DISPONIBLE/)).toBeNull();
    expect(screen.queryByText('Tu vehículo quedó registrado.')).toBeNull();
    expect(screen.getByLabelText('Foto elegida del vehículo')).toBeTruthy();
    await registrar();
    expect(
      await screen.findByText('Tu vehículo quedó registrado.'),
    ).toBeTruthy();
    expect(envios(llamadas)).toHaveLength(2);
  });

  it('sin conexión muestra un mensaje claro y deja reintentar', async () => {
    await abrirFormulario({});
    await completo();
    await registrar();
    expect(await screen.findByText(/No hay conexión/)).toBeTruthy();
    expect(screen.getByLabelText('Placa').props.value).toBe('1234-abc');
  });

  it('CA-8: si el servidor dice que no tiene membresía aprobada, lo explica', async () => {
    await abrirFormulario({ 'POST /vehiculos': v.noAutorizado });
    await completo();
    await registrar();
    expect(
      await screen.findByText(/ser miembro aprobado de una organización/),
    ).toBeTruthy();
    expect(screen.queryByText(/NO_AUTORIZADO/)).toBeNull();
  });
});

describe('Foto del vehículo', () => {
  it('tomar foto pide el permiso de la cámara y usa la cámara', async () => {
    selector.requestCameraPermissionsAsync.mockResolvedValue({
      granted: true,
    } as never);
    selector.launchCameraAsync.mockResolvedValue(fotoElegida() as never);
    await abrirFormulario({});
    await presionar('Tomar foto');
    expect(
      await screen.findByLabelText('Foto elegida del vehículo'),
    ).toBeTruthy();
    expect(selector.requestCameraPermissionsAsync).toHaveBeenCalled();
    expect(selector.launchCameraAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ['images'] }),
    );
    // Con una foto elegida, el mismo botón la cambia.
    expect(screen.getByRole('button', { name: 'Cambiar foto' })).toBeTruthy();
  });

  it('sin permiso de la cámara lo explica, no abre la cámara y ofrece la galería', async () => {
    selector.requestCameraPermissionsAsync.mockResolvedValue({
      granted: false,
    } as never);
    await abrirFormulario({});
    await presionar('Tomar foto');
    expect(
      await screen.findByText(/necesitamos permiso de la cámara/),
    ).toBeTruthy();
    expect(selector.launchCameraAsync).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Elegir de la galería' }),
    ).toBeTruthy();
  });

  it('elegir de la galería no pide permiso de la cámara', async () => {
    await abrirFormulario({});
    await elegirFotoDeGaleria();
    expect(selector.requestCameraPermissionsAsync).not.toHaveBeenCalled();
  });

  it('si se cancela el selector no queda ninguna foto', async () => {
    selector.launchImageLibraryAsync.mockResolvedValue({
      canceled: true,
      assets: null,
    } as never);
    await abrirFormulario({});
    await presionar('Elegir de la galería');
    await waitFor(() =>
      expect(selector.launchImageLibraryAsync).toHaveBeenCalled(),
    );
    expect(screen.queryByLabelText('Foto elegida del vehículo')).toBeNull();
  });

  it('una foto de más de 5 MB se rechaza al elegirla y no queda guardada', async () => {
    await abrirFormulario({});
    selector.launchImageLibraryAsync.mockResolvedValue(
      fotoElegida({ fileSize: 5 * UN_MB + 1 }) as never,
    );
    await presionar('Elegir de la galería');
    expect(
      await screen.findByText(
        'La foto debe ser JPEG o PNG y pesar como máximo 5 MB.',
      ),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Foto elegida del vehículo')).toBeNull();
  });

  it('si el selector falla lo dice sin detalles técnicos', async () => {
    selector.launchImageLibraryAsync.mockRejectedValue(new Error('boom'));
    await abrirFormulario({});
    await presionar('Elegir de la galería');
    expect(await screen.findByText(/Algo salió mal/)).toBeTruthy();
    expect(screen.queryByText(/boom/)).toBeNull();
  });

  it('en web envía el archivo mismo, porque allí un uri no se puede adjuntar', async () => {
    const archivo = new Blob(['x'], { type: 'image/png' });
    const { llamadas, falso } = await abrirFormulario({
      'POST /vehiculos': v.registrado,
    });
    await llenar();
    await elegirFotoDeGaleria(
      fotoElegida({ mimeType: 'image/png', file: archivo }) as never,
    );
    await aceptarConsentimiento();
    await registrar();
    await screen.findByText('Tu vehículo quedó registrado.');
    const indice = llamadas.findIndex((l) => l.ruta === 'POST /vehiculos');
    const partes = (
      (falso.mock.calls[indice][1] as RequestInit).body as unknown as {
        _parts: [string, unknown][];
      }
    )._parts;
    expect(partes.find(([campo]) => campo === 'foto')?.[1]).toBe(archivo);
  });
});

describe('Quién puede registrar', () => {
  it('CA-8: con la membresía pendiente no ve el formulario y no llama a la API de vehículos', async () => {
    const { llamadas } = simularFetch({
      'POST /autenticacion/refrescar': r.sesionPendiente,
      'GET /yo': r.yoPendiente,
    });
    await abrir();
    expect(await screen.findByText('redirige:/estado-membresia')).toBeTruthy();
    expect(llamadas.some((l) => l.ruta.includes('/vehiculos'))).toBe(false);
  });

  it('sin sesión lleva a iniciar sesión', async () => {
    mockRefresco = null;
    simularFetch({});
    await abrir();
    expect(await screen.findByText('redirige:/iniciar-sesion')).toBeTruthy();
  });
});

describe('Mi vehículo', () => {
  it('CA-7: el dueño ve placa, marca, modelo, color y capacidad, sin foto ni formulario', async () => {
    simularFetch({ ...CON_SESION, 'GET /vehiculos/mio': v.mio });
    await abrir();
    expect(await screen.findByText('1234ABC')).toBeTruthy();
    expect(screen.getByText('Toyota')).toBeTruthy();
    expect(screen.getByText('Corolla')).toBeTruthy();
    expect(screen.getByText('Blanco')).toBeTruthy();
    expect(screen.getByText('4 asientos para pasajeros')).toBeTruthy();
    expect(screen.queryByLabelText('Foto elegida del vehículo')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tomar foto' })).toBeNull();
    expect(screen.getByText(/nadie más la ve/)).toBeTruthy();
  });

  it('con un solo asiento lo dice en singular', async () => {
    const [{ cuerpo }] = [v.mio];
    simularFetch({
      ...CON_SESION,
      'GET /vehiculos/mio': {
        estado: 200,
        cuerpo: { ...(cuerpo as object), capacidad: 1 },
      },
    });
    await abrir();
    expect(await screen.findByText('1 asiento para pasajeros')).toBeTruthy();
  });

  it('si no se puede consultar lo dice y no ofrece registrar a ciegas', async () => {
    simularFetch(CON_SESION);
    await abrir();
    expect(await screen.findByText(/No hay conexión/)).toBeTruthy();
  });

  it('Volver regresa a la pantalla anterior', async () => {
    simularFetch({ ...CON_SESION, 'GET /vehiculos/mio': v.mio });
    await abrir();
    await screen.findByText('1234ABC');
    await presionar('Volver');
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('el inicio ofrece entrar a Mi vehículo', async () => {
    simularFetch(CON_SESION);
    await abrir(<Inicio />);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Mi vehículo' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith('/vehiculo');
  });
});

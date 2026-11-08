import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { AccessibilityInfo, Keyboard, ScrollView } from 'react-native';
import PublicarPantalla from '@/app/(pestanas)/publicar';
import { limites } from '@/componentes/MapaRuta';
import { zoomParaVer } from '@/componentes/MapaRuta.web';
import { ProveedorSesion } from '@/contexto/sesion';
import { ErrorKeystore } from '@/dispositivo/keystore';
import { formatearHoraLocal } from '@/formato';
import {
  dispositivoReal as d,
  identidadReal as i,
  billeteraReal as b,
  respuestasReales as r,
  simularFetch,
  vehiculosReales as v,
  viajeReal as vj,
} from '@/pruebas/respuestasApi';
import { buscarLugares } from '@/servicios/geocoding';

const mockRouter = { push: jest.fn() };
const mockFirmar = jest.fn();
// Volver a la pestaña es volver a correr el efecto de foco.
const mockFoco: { efecto?: () => void } = {};

jest.mock('expo-router', () => {
  const { Text: Texto } = jest.requireActual('react-native');
  const { useEffect } = jest.requireActual('react');
  return {
    Redirect: ({ href }: { href: string }) => (
      <Texto>{`redirige:${href}`}</Texto>
    ),
    router: { push: (...a: unknown[]) => mockRouter.push(...a) },
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
jest.mock('@/dispositivo/firma', () => ({
  cabecerasFirma: (...a: unknown[]) => mockFirmar(...a),
}));
jest.mock('@/servicios/geocoding', () => ({ buscarLugares: jest.fn() }));

const buscar = jest.mocked(buscarLugares);
const PLAZA = {
  nombre: 'Plaza 24 de Septiembre',
  detalle: 'Plaza 24 de Septiembre, Santa Cruz de la Sierra, Bolivia',
  lat: -17.783327,
  lng: -63.182129,
};
const UAGRM = {
  nombre: 'UAGRM, Módulos',
  detalle: 'UAGRM, Módulos, Santa Cruz de la Sierra, Bolivia',
  lat: -17.775,
  lng: -63.195,
};
const REQUISITOS_OK = {
  'POST /autenticacion/refrescar': r.sesionAprobada,
  'GET /yo': r.yoAprobada,
  'GET /vehiculos/mio': v.mio,
  'GET /identidad/estado': i.verificada,
  'GET /dispositivos/mi-dispositivo': d.vinculado,
  'GET /viajes/limites': vj.limites,
};

const abrir = async (rutas: Parameters<typeof simularFetch>[0] = {}) => {
  const simulado = simularFetch({ ...REQUISITOS_OK, ...rutas });
  await render(
    <ProveedorSesion>
      <PublicarPantalla />
    </ProveedorSesion>,
  );
  return simulado;
};

const elegirLugar = async (etiqueta: string, lugar: typeof PLAZA) => {
  buscar.mockResolvedValueOnce([lugar]);
  await fireEvent.changeText(
    await screen.findByLabelText(etiqueta),
    lugar.nombre,
  );
  await fireEvent(screen.getByLabelText(etiqueta), 'submitEditing');
  await fireEvent.press(await screen.findByLabelText(lugar.detalle));
};

const llenar = async (precio = '10,50') => {
  await elegirLugar('Punto de encuentro', PLAZA);
  await elegirLugar('Destino', UAGRM);
  await fireEvent.press(screen.getByLabelText('Mañana'));
  await fireEvent.changeText(screen.getByLabelText('Hora de salida'), '0730');
  await fireEvent.press(screen.getByLabelText('3 asientos'));
  await fireEvent.changeText(
    screen.getByLabelText('Precio por asiento (URC)'),
    precio,
  );
};

const publicar = () =>
  fireEvent.press(screen.getByRole('button', { name: 'Publicar viaje' }));

const envios = (llamadas: { ruta: string }[]) =>
  llamadas.filter((l) => l.ruta === 'POST /viajes');

beforeEach(() => {
  // La animación de la ilustración deja un temporizador que sobrevive a la prueba y rompe la siguiente suite.
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  jest.clearAllMocks();
  mockFirmar.mockResolvedValue({ 'X-Firma': 'firma-de-prueba' });
});

describe('HU-17 · requisitos (CA-6)', () => {
  it('sin vehículo: dice qué falta y lleva a registrarlo, sin formulario', async () => {
    await abrir({ 'GET /vehiculos/mio': v.sinVehiculo });
    expect(await screen.findByText('Registra tu vehículo')).toBeTruthy();
    expect(screen.queryByLabelText('Punto de encuentro')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Mi vehículo' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/vehiculo');
  });

  it('con vehículo, sin verificar: marca lo hecho y lleva a verificar', async () => {
    await abrir({ 'GET /identidad/estado': i.sinVerificar });
    expect(await screen.findByText('Vehículo registrado')).toBeTruthy();
    expect(screen.getByText(/^Toyota Corolla · /)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Verificar identidad' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith('/identidad');
  });

  it('sin teléfono vinculado: lleva a vincular', async () => {
    await abrir({ 'GET /dispositivos/mi-dispositivo': d.sinDispositivo });
    expect(await screen.findByText('Vincula este teléfono')).toBeTruthy();
  });

  it('si no se pudo consultar, no ofrece el formulario y deja reintentar', async () => {
    const { falso } = await abrir({ 'GET /viajes/limites': [] });
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Reintentar' }),
    );
    expect(falso).toHaveBeenCalled();
    expect(screen.queryByLabelText('Punto de encuentro')).toBeNull();
  });
});

describe('HU-17 · formulario', () => {
  it('muestra los límites antes de fallar y bloquea asientos sobre la capacidad (CA-2, CA-3)', async () => {
    await abrir();
    expect(
      await screen.findByText(
        'Tu Toyota Corolla tiene 4 asientos para pasajeros.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('Entre 1 y 20 URC, el máximo de HU05MOB A.'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('4 asientos').props.accessibilityState,
    ).toEqual(expect.objectContaining({ disabled: false }));
    expect(
      screen.getByLabelText('5 asientos').props.accessibilityState,
    ).toEqual(expect.objectContaining({ disabled: true }));
  });

  it('CA-1: envía la salida como UTC y los datos del contrato, firmado, y muestra el resultado', async () => {
    const { llamadas } = await abrir({ 'POST /viajes': vj.publicado });
    await llenar();
    await publicar();

    expect(await screen.findByText('Viaje publicado')).toBeTruthy();
    expect(screen.getByText('Publicado')).toBeTruthy();
    expect(screen.getByText('3 asientos · 10,50 URC c/u')).toBeTruthy();

    const [envio] = envios(llamadas);
    const cuerpo = envio as unknown as { cuerpo: Record<string, unknown> };
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    manana.setHours(7, 30, 0, 0);
    expect(cuerpo.cuerpo).toEqual({
      origenNombre: PLAZA.nombre,
      origenLat: PLAZA.lat,
      origenLng: PLAZA.lng,
      destinoNombre: UAGRM.nombre,
      destinoLat: UAGRM.lat,
      destinoLng: UAGRM.lng,
      fechaHoraSalida: manana.toISOString(),
      cuposTotales: 3,
      precioPorAsiento: 10.5,
    });
    // CA-7: lo firmado es exactamente el cuerpo que se envía, y sin organización (A-13).
    expect(mockFirmar).toHaveBeenCalledTimes(1);
    expect(mockFirmar.mock.calls[0][1]).toBe('POST');
    expect(JSON.parse(mockFirmar.mock.calls[0][3])).toEqual(cuerpo.cuerpo);
    expect(cuerpo.cuerpo).not.toHaveProperty('organizacionId');

    await fireEvent.press(screen.getByRole('button', { name: 'Listo' }));
    expect(screen.getByLabelText('Punto de encuentro').props.value).toBe('');
    expect(screen.getByLabelText('Precio por asiento (URC)').props.value).toBe(
      '',
    );
  });

  it('sin datos: marca los errores y no pide la huella', async () => {
    const { llamadas } = await abrir();
    await screen.findByLabelText('Punto de encuentro');
    await publicar();
    expect(
      screen.getAllByText('Busca el lugar y elige una opción de la lista.'),
    ).toHaveLength(2);
    expect(
      screen.getByText('El precio debe estar entre 1 y 20 URC.'),
    ).toBeTruthy();
    expect(mockFirmar).not.toHaveBeenCalled();
    expect(envios(llamadas)).toHaveLength(0);
  });

  it.each(['0,99', '20,01', 'abc', '1,005'])(
    'CA-3: precio %s no pide la huella',
    async (precio) => {
      const { llamadas } = await abrir();
      await llenar(precio);
      await publicar();
      expect(
        screen.getByText('El precio debe estar entre 1 y 20 URC.'),
      ).toBeTruthy();
      expect(envios(llamadas)).toHaveLength(0);
    },
  );

  it('CA-4: con menos de 15 minutos no pide la huella', async () => {
    const { llamadas } = await abrir();
    await llenar();
    await fireEvent.press(screen.getByLabelText('Hoy'));
    const dentroDeUnRato = new Date(Date.now() + 5 * 60_000);
    // Cerca de medianoche, "hoy" a esa hora ya pasó o no cumple: en ambos casos se rechaza.
    await fireEvent.changeText(
      screen.getByLabelText('Hora de salida'),
      formatearHoraLocal(dentroDeUnRato.toISOString()),
    );
    await publicar();
    expect(
      screen.getByText(
        /Sale en menos de 15 minutos\. Elige una hora a partir de las \d\d:\d\d|Elige una salida con al menos 15 minutos/,
      ),
    ).toBeTruthy();
    expect(envios(llamadas)).toHaveLength(0);
  });

  it('con varios errores avisa arriba; con uno lleva a ese campo y no al principio', async () => {
    const irA = jest.spyOn(ScrollView.prototype, 'scrollTo');
    await abrir();
    await screen.findByLabelText('Punto de encuentro');
    await publicar();
    expect(screen.getByText('Revisa los campos marcados.')).toBeTruthy();

    await llenar('20,01');
    const campo = screen.getByLabelText('Precio por asiento (URC)');
    await fireEvent(campo, 'layout', {
      nativeEvent: { layout: { x: 0, y: 900, width: 300, height: 80 } },
    });
    irA.mockClear();
    await publicar();
    expect(screen.queryByText('Revisa los campos marcados.')).toBeNull();
    expect(irA).toHaveBeenLastCalledWith({ y: 892 });
    irA.mockRestore();
  });

  it('hora mal escrita: lo dice, y el texto se arma con los dos puntos', async () => {
    await abrir();
    const hora = await screen.findByLabelText('Hora de salida');
    await fireEvent.changeText(hora, '2575');
    expect(screen.getByLabelText('Hora de salida').props.value).toBe('25:75');
    await publicar();
    expect(
      screen.getByText('Escribe la hora en 24 horas, por ejemplo 07:30.'),
    ).toBeTruthy();
  });

  it('intercambia origen y destino', async () => {
    await abrir();
    await elegirLugar('Punto de encuentro', PLAZA);
    await elegirLugar('Destino', UAGRM);
    await fireEvent.press(
      screen.getByRole('button', { name: 'Intercambiar origen y destino' }),
    );
    expect(screen.getByLabelText('Punto de encuentro').props.value).toBe(
      UAGRM.nombre,
    );
    expect(screen.getByLabelText('Destino').props.value).toBe(PLAZA.nombre);
  });

  it('al intercambiar no queda el error sobre el lugar que ya se llenó', async () => {
    await abrir();
    await elegirLugar('Destino', UAGRM);
    await publicar();
    expect(
      screen.getByText('Busca el lugar y elige una opción de la lista.'),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Intercambiar origen y destino' }),
    );
    expect(
      screen.queryByText('Busca el lugar y elige una opción de la lista.'),
    ).toBeNull();
  });

  it('editar un lugar elegido obliga a elegir otro: sin coordenadas no se publica (RN-4)', async () => {
    const { llamadas } = await abrir();
    await llenar();
    await fireEvent.changeText(
      screen.getByLabelText('Destino'),
      'Otro lugar escrito',
    );
    await publicar();
    expect(
      screen.getByText('Busca el lugar y elige una opción de la lista.'),
    ).toBeTruthy();
    expect(envios(llamadas)).toHaveLength(0);
  });
});

describe('HU-17 · búsqueda de lugar', () => {
  it('sin resultados y con la red caída lo dice', async () => {
    await abrir();
    const campo = await screen.findByLabelText('Destino');
    await fireEvent.changeText(campo, 'zzz');
    buscar.mockResolvedValueOnce([]);
    await fireEvent(campo, 'submitEditing');
    expect(
      await screen.findByText(
        'No encontramos ese lugar. Prueba con otro nombre.',
      ),
    ).toBeTruthy();
    buscar.mockRejectedValueOnce(new Error('caído'));
    await fireEvent(screen.getByLabelText('Destino'), 'submitEditing');
    expect(
      await screen.findByText(
        'No pudimos buscar el lugar. Revisa tu conexión e inténtalo de nuevo.',
      ),
    ).toBeTruthy();
  });

  it('un lugar elegido se lee desde el inicio, pero con foco el cursor es de quien edita', async () => {
    await abrir();
    await elegirLugar('Destino', UAGRM);
    const campo = () => screen.getByLabelText('Destino');
    expect(campo().props.selection).toEqual({ start: 0, end: 0 });
    await fireEvent(campo(), 'focus');
    expect(campo().props.selection).toBeUndefined();
    await fireEvent(campo(), 'blur');
    expect(campo().props.selection).toEqual({ start: 0, end: 0 });
  });

  it('una búsqueda en camino no se repite, y si cambió el texto su respuesta no se muestra', async () => {
    await abrir();
    let responder = (_: (typeof PLAZA)[]) => {};
    buscar.mockReturnValueOnce(new Promise((ok) => (responder = ok)));
    const campo = await screen.findByLabelText('Destino');
    await fireEvent.changeText(campo, 'plaza');
    await fireEvent(campo, 'submitEditing');
    await fireEvent(campo, 'submitEditing');
    expect(buscar).toHaveBeenCalledTimes(1);
    await fireEvent.changeText(campo, 'plazuela');
    await act(async () => responder([PLAZA]));
    expect(screen.queryByLabelText(PLAZA.detalle)).toBeNull();
  });

  it('al intercambiar, lo que dijo la búsqueda anterior no queda sobre el lugar que llega', async () => {
    await abrir();
    await elegirLugar('Destino', UAGRM);
    const origen = screen.getByLabelText('Punto de encuentro');
    await fireEvent.changeText(origen, 'zzz');
    buscar.mockResolvedValueOnce([]);
    await fireEvent(origen, 'submitEditing');
    const aviso = 'No encontramos ese lugar. Prueba con otro nombre.';
    expect(await screen.findByText(aviso)).toBeTruthy();
    await fireEvent.press(
      screen.getByLabelText('Intercambiar origen y destino'),
    );
    expect(screen.getByLabelText('Punto de encuentro').props.value).toBe(
      UAGRM.nombre,
    );
    expect(screen.queryByText(aviso)).toBeNull();
  });

  it('tras tocar Publicar sin lugar, lo que respondió la búsqueda se ve sobre el error', async () => {
    await abrir();
    const campo = await screen.findByLabelText('Destino');
    await publicar();
    await fireEvent.changeText(campo, 'zzz');
    buscar.mockResolvedValueOnce([]);
    await fireEvent(campo, 'submitEditing');
    expect(
      await screen.findByText(
        'No encontramos ese lugar. Prueba con otro nombre.',
      ),
    ).toBeTruthy();
  });

  it('con menos de 3 letras no consulta a Nominatim', async () => {
    await abrir();
    const campo = await screen.findByLabelText('Destino');
    await fireEvent.changeText(campo, 'ab');
    await fireEvent(campo, 'submitEditing');
    expect(
      screen.getByText('Escribe al menos 3 letras para buscar.'),
    ).toBeTruthy();
    expect(buscar).not.toHaveBeenCalled();
  });
});

describe('HU-17 · rechazos del servidor', () => {
  it.each([
    [
      'CA-2',
      vj.cuposExceden,
      'Tu vehículo tiene 2 asientos para pasajeros. Ofrece 2 o menos.',
    ],
    ['CA-3', vj.precioFuera, 'El precio debe estar entre 1 y 15 URC.'],
    [
      'CA-4',
      vj.horarioInvalido,
      'Elige una salida con al menos 15 minutos de anticipación y hasta dentro de 7 días.',
    ],
    [
      'CA-5',
      vj.solapado,
      /^Ya tienes uno para .+ a las \d\d:\d\d\. Deja al menos 2 horas entre tus viajes\.$/,
    ],
    [
      'CA-7',
      vj.firmaInvalida,
      'Vincula este teléfono para publicar: cada viaje se firma desde él.',
    ],
  ])('%s: lo traduce y conserva lo escrito', async (_, respuesta, texto) => {
    await abrir({ 'POST /viajes': respuesta });
    await llenar();
    await publicar();
    expect(await screen.findByText(texto)).toBeTruthy();
    expect(screen.queryByText('Viaje publicado')).toBeNull();
    expect(screen.getByLabelText('Destino').props.value).toBe(UAGRM.nombre);
    expect(screen.queryByText(/CUPOS_|VIAJE_|FIRMA_/)).toBeNull();
  });

  it('al volver de resolverlo, no queda el aviso de lo que había fallado y conserva lo escrito', async () => {
    await abrir({ 'POST /viajes': vj.firmaInvalida });
    await llenar();
    await publicar();
    const aviso =
      'Vincula este teléfono para publicar: cada viaje se firma desde él.';
    expect(await screen.findByText(aviso)).toBeTruthy();
    await act(async () => mockFoco.efecto?.());
    expect(screen.queryByText(aviso)).toBeNull();
    expect(screen.getByLabelText('Destino').props.value).toBe(UAGRM.nombre);
  });

  it('origen y destino en el mismo lugar: lo dice sin pedir huella', async () => {
    const { llamadas } = await abrir();
    await llenar();
    await elegirLugar('Destino', PLAZA);
    await publicar();
    expect(
      await screen.findByText(
        'El punto de encuentro y el destino no pueden ser el mismo lugar.',
      ),
    ).toBeTruthy();
    expect(mockFirmar).not.toHaveBeenCalled();
    expect(envios(llamadas)).toHaveLength(0);
  });

  it('si cambió a un vehículo más chico, no ofrece más asientos de los que caben', async () => {
    await abrir();
    await llenar();
    const dos = {
      estado: 200,
      cuerpo: { ...(v.mio.cuerpo as object), capacidad: 2 },
    };
    const { llamadas } = simularFetch({
      ...REQUISITOS_OK,
      'GET /vehiculos/mio': dos,
      'POST /viajes': vj.publicado,
    });
    await act(async () => mockFoco.efecto?.());
    await publicar();
    await waitFor(() => expect(envios(llamadas)).toHaveLength(1));
    expect(
      llamadas.find((l) => l.ruta === 'POST /viajes')?.cuerpo,
    ).toMatchObject({ cuposTotales: 2 });
  });

  it('un rechazo por precio vuelve a leer los límites: la ayuda no se queda con el tope viejo', async () => {
    const { llamadas } = await abrir({
      'POST /viajes': {
        estado: 400,
        cuerpo: {
          codigo: 'PRECIO_FUERA_DE_RANGO',
          mensaje: 'viajes.publicar.precio_invalido',
          minimo: 1,
          maximo: 15,
        },
      },
    });
    await llenar();
    const lecturas = () =>
      llamadas.filter((l) => l.ruta === 'GET /viajes/limites').length;
    const antes = lecturas();
    await publicar();
    await waitFor(() => expect(lecturas()).toBe(antes + 1));
  });

  it('al volver otro día, la fecha que ya pasó vuelve a la de por omisión', async () => {
    await abrir();
    await screen.findByLabelText('Hoy');
    const elegidos = () => screen.getAllByRole('radio', { selected: true });
    expect(elegidos()).toHaveLength(2);
    jest.useFakeTimers({
      now: Date.now() + 2 * 24 * 3_600_000,
      advanceTimers: true,
    });
    try {
      await act(async () => mockFoco.efecto?.());
      // Una fecha y un número de asientos: la fecha sigue entre las opciones.
      expect(elegidos()).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('la hora admite "730": no la deja como 73:0', async () => {
    await abrir();
    const hora = await screen.findByLabelText('Hora de salida');
    await fireEvent.changeText(hora, '730');
    expect(screen.getByLabelText('Hora de salida').props.value).toBe('07:30');
    await fireEvent.changeText(hora, '130');
    expect(screen.getByLabelText('Hora de salida').props.value).toBe('13:0');
  });

  it('CA-2 con un solo asiento: en singular', async () => {
    await abrir({
      'POST /viajes': {
        estado: 400,
        cuerpo: {
          codigo: 'CUPOS_EXCEDEN_CAPACIDAD',
          mensaje: 'viajes.publicar.cupos_exceden_capacidad',
          maximo: 1,
        },
      },
    });
    await llenar();
    await publicar();
    expect(
      await screen.findByText(
        'Tu vehículo tiene 1 asiento para pasajeros. Ofrece solo 1.',
      ),
    ).toBeTruthy();
  });

  it('sin membresía en la organización activa: no lo confunde con falta de red y deja elegir otra', async () => {
    await abrir({
      'GET /viajes/limites': {
        estado: 403,
        cuerpo: {
          codigo: 'NO_AUTORIZADO',
          mensaje: 'comun.errores.no_autorizado',
        },
      },
    });
    expect(
      await screen.findByText(
        'Ya no tienes una membresía aprobada en tu organización activa. Elige otra para publicar.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/conexión/)).toBeNull();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Elegir organización' }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith('/organizaciones');
  });

  it('cuenta suspendida al abrir: lo dice, sin formulario ni huella', async () => {
    const { llamadas } = await abrir({
      'GET /viajes/limites': b.cuentaSuspendida,
    });
    expect(
      await screen.findByText(
        'Tu cuenta está suspendida, por eso no puedes publicar viajes. Comunícate con tu organización.',
      ),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Punto de encuentro')).toBeNull();
    expect(mockFirmar).not.toHaveBeenCalled();
    expect(envios(llamadas)).toHaveLength(0);
  });

  it('cuenta suspendida con el formulario abierto: al publicar lo dice y no muestra el resultado', async () => {
    await abrir({ 'POST /viajes': b.cuentaSuspendida });
    await llenar();
    await publicar();
    expect(
      await screen.findByText(
        'Tu cuenta está suspendida, por eso no puedes publicar viajes. Comunícate con tu organización.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Viaje publicado')).toBeNull();
  });

  it('CA-6: si perdió un requisito al publicar, vuelve a la lista de lo que falta', async () => {
    await abrir({
      'POST /viajes': vj.sinVehiculo,
      'GET /vehiculos/mio': [v.mio, v.sinVehiculo],
    });
    await llenar();
    await publicar();
    expect(await screen.findByText('Registra tu vehículo')).toBeTruthy();
  });

  it('cancelar la huella no es un error y no publica', async () => {
    mockFirmar.mockRejectedValue(new ErrorKeystore('BIOMETRIA_CANCELADA'));
    const soltar = jest.spyOn(Keyboard, 'dismiss');
    const { llamadas } = await abrir();
    await llenar();
    await publicar();
    expect(
      await screen.findByText(
        'Cancelaste la huella. Tu viaje no se publicó; tus datos siguen aquí.',
      ),
    ).toBeTruthy();
    expect(envios(llamadas)).toHaveLength(0);
    // Con el foco en un campo, Android deja el aviso fuera de la vista.
    expect(soltar).toHaveBeenCalled();
  });

  it('dos toques seguidos piden una sola huella', async () => {
    const { llamadas } = await abrir({ 'POST /viajes': vj.publicado });
    await llenar();
    const boton = screen.getByRole('button', { name: 'Publicar viaje' });
    await Promise.all([fireEvent.press(boton), fireEvent.press(boton)]);
    await waitFor(() => expect(envios(llamadas)).toHaveLength(1));
    expect(mockFirmar).toHaveBeenCalledTimes(1);
  });
});

describe('MapaRuta', () => {
  it('acerca lugares próximos y aleja los lejanos, siempre dentro del recuadro', () => {
    const cerca = zoomParaVer(PLAZA, UAGRM, 328);
    const lejos = zoomParaVer(PLAZA, { lat: -16.5, lng: -68.15 }, 328);
    expect(cerca).toBeGreaterThan(lejos);
    expect(lejos).toBeGreaterThan(0);
    expect(zoomParaVer(PLAZA, PLAZA, 328)).toBe(16);
  });

  it('el recuadro contiene ambos puntos sin importar cuál va primero', () => {
    const a = { lat: -17.8, lng: -63.2 };
    const b = { lat: -17.7, lng: -63.1 };
    expect(limites(a, b)).toEqual([-63.2, -17.8, -63.1, -17.7]);
    expect(limites(b, a)).toEqual(limites(a, b));
  });
});

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import MovimientosPantalla from '@/app/movimientos';
import { cerrarSesion } from '@/api/cliente';
import { ProveedorSesion } from '@/contexto/sesion';
import { firmar } from '@/dispositivo/keystore';
import { formatearDia } from '@/formato';
import {
  billeteraReal as b,
  dispositivoReal as d,
  historialReal as h,
  respuestasReales as r,
  simularFetch,
} from '@/pruebas/respuestasApi';

const mockFoco: { alEnfocar?: () => void } = {};
jest.mock('expo-router', () => {
  const { Text: Texto } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) => (
      <Texto>{`redirige:${href}`}</Texto>
    ),
    router: { push: jest.fn(), back: jest.fn() },
    // Como el real: corre el callback al montar y lo deja a mano para simular "volver a la pantalla".
    useFocusEffect: (alEnfocar: () => void) => {
      const { useEffect } = jest.requireActual('react');
      mockFoco.alEnfocar = alEnfocar;
      useEffect(() => alEnfocar(), [alEnfocar]);
    },
  };
});
// La lista real solo dibuja una ventana de filas; esta las dibuja todas para poder contarlas. Conserva los avisos
// de fin de lista y de refresco como props, que es lo que dispara la persona al desplazarse.
jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const { View: Vista } = jest.requireActual('react-native');
  const ListaCompleta = ({
    data,
    renderItem,
    keyExtractor,
    ListHeaderComponent,
    ListEmptyComponent,
    ListFooterComponent,
    ...resto
  }: any) => (
    <Vista {...resto}>
      {ListHeaderComponent}
      {data.length
        ? data.map((item: unknown, index: number) => (
            <Vista key={keyExtractor(item)}>
              {renderItem({ item, index })}
            </Vista>
          ))
        : ListEmptyComponent}
      {ListFooterComponent}
    </Vista>
  );
  return { __esModule: true, default: ListaCompleta };
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
  ErrorKeystore: class ErrorKeystore extends Error {},
}));

const firma = jest.mocked(firmar);
const CON_SESION = {
  'POST /autenticacion/refrescar': r.sesionAprobada,
  'GET /yo': r.yoAprobada,
  'GET /dispositivos/mi-dispositivo': d.vinculado,
  'GET /billetera/saldo': h.saldo,
};
const RUTA = 'GET /billetera/movimientos';

type Cuerpo = {
  items: { id: string; estado: string; hashTx: string | null }[];
};
/** Con el explorador de Polygon Amoy, como lo arma el servidor para los confirmados (en Hardhat es null). */
const conExplorador = (pagina: typeof h.pagina1) => ({
  ...pagina,
  cuerpo: {
    ...(pagina.cuerpo as Cuerpo),
    items: (pagina.cuerpo as Cuerpo).items.map((m) => ({
      ...m,
      exploradorUrl: m.hashTx
        ? `https://amoy.polygonscan.com/tx/${m.hashTx}`
        : null,
    })),
  },
});

const abrir = async (rutas: Parameters<typeof simularFetch>[0] = {}) => {
  const simulado = simularFetch({ ...CON_SESION, ...rutas });
  const pantalla = await render(
    <ProveedorSesion>
      <MovimientosPantalla />
    </ProveedorSesion>,
  );
  return { ...simulado, ...pantalla };
};
const lista = () => screen.getByTestId('lista-movimientos');
/** Movimientos dibujados (cada uno lleva el nombre de su tipo). */
const filas = () =>
  screen.queryAllByText(
    /^(Recarga|Reserva en garantía|Pago de viaje recibido|Reembolso)$/,
  ).length;
// Menos el título de la pantalla, que también es un encabezado.
const encabezadosDeDia = () => screen.queryAllByRole('header').length - 1;
const peticiones = (falso: jest.Mock) =>
  falso.mock.calls
    .map(([url]) => String(url))
    .filter((u) => u.includes('/billetera/movimientos'))
    .map((u) => u.split('/billetera/movimientos')[1]);
const filtro = (nombre: string) => screen.getByRole('radio', { name: nombre });

beforeEach(async () => {
  jest.clearAllMocks();
  await cerrarSesion().catch(() => undefined);
  firma.mockResolvedValue({ firma: 'firma-de-prueba', marca: '1' });
});

describe('Movimientos · CA-2: lista cronológica inversa con todos sus datos', () => {
  it('muestra tipo, hora, monto con signo en es-BO, agrupado por día, del más reciente al más antiguo', async () => {
    await abrir({ [RUTA]: h.pagina1 });
    expect(await screen.findByText('Pago de viaje recibido')).toBeTruthy();
    const items = (
      h.pagina1.cuerpo as { items: { tipo: string; creadoEn: string }[] }
    ).items;
    // Montos con signo y es-BO: el bloqueo en garantía resta, los demás suman.
    expect(screen.getByText('+12,00')).toBeTruthy();
    expect(screen.getByText('-15,00')).toBeTruthy();
    expect(screen.getAllByText('+10,00').length).toBeGreaterThan(0);
    // Mismo orden que la API (del más reciente al más antiguo).
    const nombre: Record<string, string> = {
      recarga: 'Recarga',
      bloqueo_reserva: 'Reserva en garantía',
      liberacion_viaje: 'Pago de viaje recibido',
      reembolso_reserva: 'Reembolso',
    };
    const dibujados = screen
      .queryAllByText(
        /^(Recarga|Reserva en garantía|Pago de viaje recibido|Reembolso)$/,
      )
      .map((x) => x.props.children);
    expect(dibujados).toEqual(items.map((m) => nombre[m.tipo]));
    // Un encabezado por cada día distinto, con la fecha de su día local.
    const dias = [...new Set(items.map((m) => formatearDia(m.creadoEn)))];
    for (const dia of dias) expect(screen.getAllByText(dia)).toHaveLength(1);
  });

  it('un pago recibido de hoy se agrupa bajo "Hoy"', async () => {
    const ahora = new Date().toISOString();
    const hoy = {
      ...h.pagina1,
      cuerpo: {
        items: [
          {
            ...(h.pagina1.cuerpo as { items: object[] }).items[1],
            creadoEn: ahora,
          },
        ],
        total: 1,
        pagina: 1,
        paginas: 1,
      },
    };
    await abrir({ [RUTA]: hoy });
    expect(await screen.findByText('Pago de viaje recibido')).toBeTruthy();
    expect(screen.getByText('Hoy')).toBeTruthy();
  });

  it('con exploradorUrl null (nodo local) no muestra el enlace al explorador', async () => {
    await abrir({ [RUTA]: h.pagina1 });
    await screen.findByText('Pago de viaje recibido');
    expect(screen.queryByText('Ver en el explorador')).toBeNull();
  });

  it('con exploradorUrl muestra el enlace de cada movimiento confirmado y lo abre', async () => {
    const abrirUrl = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(undefined as never);
    await abrir({ [RUTA]: conExplorador(h.pagina1) });
    await screen.findByText('Pago de viaje recibido');
    const enlaces = screen.getAllByRole('link', {
      name: 'Ver en el explorador',
    });
    // El pendiente no tiene hash: ninguna URL de explorador.
    expect(enlaces.length).toBeGreaterThan(0);
    await fireEvent.press(enlaces[0]);
    expect(abrirUrl).toHaveBeenCalledWith(
      expect.stringMatching(
        /^https:\/\/amoy\.polygonscan\.com\/tx\/0x[0-9a-f]{64}$/,
      ),
    );
  });

  it('solo abre enlaces https', async () => {
    const abrirUrl = jest
      .spyOn(Linking, 'openURL')
      .mockResolvedValue(undefined as never);
    const malo = conExplorador(h.pagina1);
    (malo.cuerpo.items as { exploradorUrl: string | null }[]).forEach(
      (m) => m.exploradorUrl && (m.exploradorUrl = 'javascript:alert(1)'),
    );
    await abrir({ [RUTA]: malo });
    await fireEvent.press(
      (await screen.findAllByRole('link', { name: 'Ver en el explorador' }))[0],
    );
    expect(abrirUrl).not.toHaveBeenCalled();
  });

  it('las lecturas van con token y sin firma ni huella (solo lecturas del libro)', async () => {
    const { falso } = await abrir({ [RUTA]: h.pagina1 });
    await screen.findByText('Pago de viaje recibido');
    const llamada = falso.mock.calls.find(([url]) =>
      String(url).includes('/billetera/movimientos'),
    );
    const cabeceras = llamada?.[1]?.headers as Record<string, string>;
    expect(cabeceras.Authorization).toBe('Bearer acceso-de-prueba');
    expect(Object.keys(cabeceras).filter((k) => k.startsWith('X-'))).toEqual(
      [],
    );
    expect(firma).not.toHaveBeenCalled();
  });
});

describe('Movimientos · CA-3: pendiente sin bloquear la interfaz', () => {
  it('el pendiente lleva la etiqueta Pendiente, "confirmándose" y ningún enlace; el resto sigue usable', async () => {
    await abrir({ [RUTA]: conExplorador(h.pagina1) });
    expect(await screen.findByText('Pendiente')).toBeTruthy();
    expect(screen.getByText(/· confirmándose/)).toBeTruthy();
    expect(screen.getByText('+50,00')).toBeTruthy();
    // La lista no se congela: los filtros responden con el pendiente a la vista.
    expect(filtro('Pagos')).toBeTruthy();
    // Solo los movimientos con hash tienen enlace: el pendiente y el fallido no.
    const items = (h.pagina1.cuerpo as Cuerpo).items;
    expect(items[0].estado).toBe('pendiente');
    expect(
      screen.getAllByRole('link', { name: 'Ver en el explorador' }),
    ).toHaveLength(items.filter((m) => m.hashTx).length);
  });

  it('un movimiento fallido se rotula "No se completó" y no lleva enlace', async () => {
    await abrir({ [RUTA]: conExplorador(h.pagina1) });
    // El fallido de la persona de prueba está en la página 1 (ayer).
    expect(await screen.findByText('No se completó')).toBeTruthy();
    expect(screen.getAllByText('Pendiente')).toHaveLength(1);
  });
});

describe('Movimientos · CA-5: scroll infinito de 20 en 20 y pull-to-refresh', () => {
  it('al llegar al final pide la página siguiente hasta agotar las páginas, sin repetir ninguna', async () => {
    const { falso } = await abrir({
      [RUTA]: [h.pagina1, h.pagina2, h.pagina3],
    });
    await screen.findByText('Pago de viaje recibido');
    expect(filas()).toBe(20);
    expect(peticiones(falso)).toEqual(['?pagina=1&limite=20']);

    await fireEvent(lista(), 'endReached');
    await waitFor(() => expect(filas()).toBe(40));
    expect(peticiones(falso)).toEqual([
      '?pagina=1&limite=20',
      '?pagina=2&limite=20',
    ]);

    await fireEvent(lista(), 'endReached');
    await waitFor(() => expect(peticiones(falso)).toHaveLength(3));
    await waitFor(() => expect(filas()).toBe(46));

    // Tras la última página, llegar al final otra vez no pide nada.
    await fireEvent(lista(), 'endReached');
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 30));
    });
    expect(peticiones(falso)).toHaveLength(3);
    // 46 movimientos + un encabezado por cada día distinto.
    const todos = [h.pagina1, h.pagina2, h.pagina3].flatMap(
      (p) => (p.cuerpo as { items: { creadoEn: string }[] }).items,
    );
    expect(todos).toHaveLength(46);
    const dias = new Set(todos.map((m) => new Date(m.creadoEn).toDateString()));
    expect(encabezadosDeDia()).toBe(dias.size);
    expect(firma).not.toHaveBeenCalled();
  });

  it('dos avisos de final de lista seguidos no piden dos veces la misma página', async () => {
    const { falso } = await abrir({
      [RUTA]: [h.pagina1, h.pagina2, h.pagina3],
    });
    await screen.findByText('Pago de viaje recibido');
    // Los dos avisos llegan antes de que la lista se vuelva a dibujar.
    await act(async () => {
      lista().props.onEndReached();
      lista().props.onEndReached();
    });
    await waitFor(() => expect(peticiones(falso)).toHaveLength(2));
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 30));
    });
    expect(
      peticiones(falso).filter((p) => p.includes('pagina=2')),
    ).toHaveLength(1);
  });

  it('si entra un movimiento nuevo entre páginas y una fila se repite, no se duplica', async () => {
    const repetida = {
      ...h.pagina2,
      cuerpo: {
        ...(h.pagina2.cuerpo as { items: object[] }),
        items: [
          (h.pagina1.cuerpo as { items: object[] }).items[19],
          ...(h.pagina2.cuerpo as { items: object[] }).items,
        ],
      },
    };
    await abrir({ [RUTA]: [h.pagina1, repetida] });
    await screen.findByText('Pago de viaje recibido');
    expect(filas()).toBe(20);
    await fireEvent(lista(), 'endReached');
    // La página 2 trae 21 filas (una repetida de la 1): quedan 40, no 41.
    await waitFor(() => expect(filas()).toBe(40));
  });

  it('pull-to-refresh vuelve a la página 1, reemplaza la lista y no pide huella', async () => {
    const { falso } = await abrir({
      [RUTA]: [h.pagina1, h.pagina2, h.pagina1],
    });
    await screen.findByText('Pago de viaje recibido');
    await fireEvent(lista(), 'endReached');
    await waitFor(() => expect(peticiones(falso)).toHaveLength(2));
    await fireEvent(lista(), 'refresh');
    await waitFor(() => expect(peticiones(falso)).toHaveLength(3));
    expect(peticiones(falso)[2]).toBe('?pagina=1&limite=20');
    await waitFor(() => expect(filas()).toBe(20));
    expect(firma).not.toHaveBeenCalled();
  });
});

describe('Movimientos · filtros', () => {
  it('cada filtro pide al servidor sus tipos: Recargas, Pagos y Reembolsos', async () => {
    const { falso } = await abrir({ [RUTA]: h.pagina1 });
    await screen.findByText('Pago de viaje recibido');
    expect(filtro('Todos').props.accessibilityState.selected).toBe(true);

    await fireEvent.press(filtro('Reembolsos'));
    await waitFor(() =>
      expect(peticiones(falso).at(-1)).toBe(
        '?pagina=1&limite=20&tipo=reembolso_reserva',
      ),
    );
    await fireEvent.press(filtro('Pagos'));
    await waitFor(() =>
      expect(peticiones(falso).at(-1)).toBe(
        '?pagina=1&limite=20&tipo=bloqueo_reserva,liberacion_viaje',
      ),
    );
    await fireEvent.press(filtro('Recargas'));
    await waitFor(() =>
      expect(peticiones(falso).at(-1)).toBe('?pagina=1&limite=20&tipo=recarga'),
    );
    await fireEvent.press(filtro('Todos'));
    await waitFor(() =>
      expect(peticiones(falso).at(-1)).toBe('?pagina=1&limite=20'),
    );
    expect(filtro('Todos').props.accessibilityState.selected).toBe(true);
  });

  it('Reembolsos muestra solo lo que el servidor devolvió', async () => {
    await abrir({ [RUTA]: [h.pagina1, h.reembolsos] });
    await screen.findByText('Pago de viaje recibido');
    await fireEvent.press(filtro('Reembolsos'));
    await waitFor(() =>
      expect(screen.queryByText('Pago de viaje recibido')).toBeNull(),
    );
    expect(screen.getByText('Reembolso')).toBeTruthy();
    expect(filtro('Reembolsos').props.accessibilityState.selected).toBe(true);
  });

  it('si la respuesta de un filtro anterior llega tarde, no pisa la del filtro actual', async () => {
    let soltarTodos!: () => void;
    const lenta = new Promise<void>((resolver) => (soltarTodos = resolver));
    const respuesta = (cuerpo: unknown) => ({
      ok: true,
      status: 200,
      json: async () => cuerpo,
    });
    globalThis.fetch = jest.fn(async (url: string) => {
      const ruta = new URL(url).pathname.replace('/api/v1', '');
      if (ruta === '/autenticacion/refrescar')
        return respuesta(r.sesionAprobada.cuerpo);
      if (ruta === '/yo') return respuesta(r.yoAprobada.cuerpo);
      if (ruta === '/billetera/saldo') return respuesta(h.saldo.cuerpo);
      if (url.includes('tipo=reembolso_reserva'))
        return respuesta(h.reembolsos.cuerpo);
      await lenta;
      return respuesta(h.pagina1.cuerpo);
    }) as unknown as typeof fetch;
    await render(
      <ProveedorSesion>
        <MovimientosPantalla />
      </ProveedorSesion>,
    );
    await fireEvent.press(
      await screen.findByRole('radio', { name: 'Reembolsos' }),
    );
    expect(await screen.findByText('Reembolso')).toBeTruthy();
    // Llega la respuesta lenta de "Todos": se descarta.
    await act(async () => {
      soltarTodos();
      await new Promise((resolver) => setTimeout(resolver, 30));
    });
    expect(screen.queryByText('Pago de viaje recibido')).toBeNull();
    expect(screen.getByText('Reembolso')).toBeTruthy();
  });
});

describe('Movimientos · historial vacío', () => {
  it('invita a recargar (HU-13)', async () => {
    await abrir({ [RUTA]: h.vacio });
    expect(
      await screen.findByText('Todavía no tienes movimientos'),
    ).toBeTruthy();
    expect(screen.getByText(/Cuando recargues o pagues un viaje/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Recargar' }));
    expect(router.push).toHaveBeenCalledWith('/recargar');
  });

  it('al volver de recargar muestra el movimiento nuevo', async () => {
    await abrir({ [RUTA]: h.vacio });
    await screen.findByText('Todavía no tienes movimientos');
    simularFetch({ ...CON_SESION, [RUTA]: h.pagina1 });
    await act(async () => {
      mockFoco.alEnfocar?.();
    });
    await waitFor(() =>
      expect(screen.queryByText('Todavía no tienes movimientos')).toBeNull(),
    );
    expect(filas()).toBeGreaterThan(0);
  });

  it('con un filtro sin resultados lo dice distinto', async () => {
    await abrir({ [RUTA]: [h.pagina1, h.vacio] });
    await screen.findByText('Pago de viaje recibido');
    await fireEvent.press(filtro('Recargas'));
    expect(
      await screen.findByText('No hay movimientos de este tipo.'),
    ).toBeTruthy();
    expect(screen.queryByText('Todavía no tienes movimientos')).toBeNull();
  });
});

describe('Movimientos · CA-6 y errores', () => {
  it('403 IDENTIDAD_NO_VERIFICADA: explica y lleva a verificar la identidad', async () => {
    await abrir({ [RUTA]: h.identidadNoVerificada });
    expect(
      await screen.findByText(/Verifica tu identidad para ver tus movimientos/),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Verificar identidad' }),
    );
    expect(router.push).toHaveBeenCalledWith('/identidad');
    expect(firma).not.toHaveBeenCalled();
  });

  it('404 BILLETERA_NO_ENCONTRADA: reintenta la creación (HU-12) una vez y muestra la lista', async () => {
    const { llamadas } = await abrir({
      [RUTA]: [h.noEncontrada, h.pagina1],
      'POST /billetera': b.creada,
    });
    expect(await screen.findByText('Pago de viaje recibido')).toBeTruthy();
    expect(llamadas.filter((l) => l.ruta === 'POST /billetera')).toHaveLength(
      1,
    );
    expect(llamadas.filter((l) => l.ruta === RUTA)).toHaveLength(2);
  });

  it('si el 404 persiste tras crear la billetera no entra en bucle: avisa y deja reintentar', async () => {
    const { llamadas } = await abrir({
      [RUTA]: h.noEncontrada,
      'POST /billetera': b.creada,
    });
    expect(
      await screen.findByText(/No pudimos cargar tus movimientos/),
    ).toBeTruthy();
    expect(llamadas.filter((l) => l.ruta === 'POST /billetera')).toHaveLength(
      1,
    );
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });

  it('si la creación falla, reintentar vuelve a crear la billetera', async () => {
    const { llamadas } = await abrir({
      [RUTA]: [h.noEncontrada, h.noEncontrada, h.pagina1],
      'POST /billetera': [b.cadenaCaida, b.creada],
    });
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Reintentar' }),
    );
    expect(await screen.findByText('Pago de viaje recibido')).toBeTruthy();
    expect(llamadas.filter((l) => l.ruta === 'POST /billetera')).toHaveLength(
      2,
    );
  });

  it('403 CUENTA_SUSPENDIDA: su mensaje y sin reintentar', async () => {
    await abrir({ [RUTA]: b.cuentaSuspendida });
    expect(await screen.findByText(/cuenta está suspendida/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('sin conexión: mensaje común y, al reintentar, carga', async () => {
    await abrir();
    expect(await screen.findByText(/No hay conexión/)).toBeTruthy();
    simularFetch({ ...CON_SESION, [RUTA]: h.pagina1 });
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Pago de viaje recibido')).toBeTruthy();
  });

  it('si falla la página 2 conserva lo cargado, avisa y reintenta esa misma página', async () => {
    const { falso } = await abrir({
      [RUTA]: [
        h.pagina1,
        { estado: 500, cuerpo: { codigo: 'ERROR_INTERNO' } },
        h.pagina2,
      ],
    });
    await screen.findByText('Pago de viaje recibido');
    await fireEvent(lista(), 'endReached');
    expect(
      await screen.findByText('No pudimos cargar más movimientos.'),
    ).toBeTruthy();
    expect(screen.getByText('Pago de viaje recibido')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(peticiones(falso)).toHaveLength(3));
    expect(peticiones(falso)[2]).toBe('?pagina=2&limite=20');
    await waitFor(() =>
      expect(
        screen.queryByText('No pudimos cargar más movimientos.'),
      ).toBeNull(),
    );
  });

  it('red caída: avisa el último saldo sincronizado sin bloquear la lista', async () => {
    await abrir({ [RUTA]: h.pagina1, 'GET /billetera/saldo': h.saldoSinNodo });
    expect(
      await screen.findByText(
        'Mostramos el último saldo sincronizado (347,00 URC). Lo actualizaremos al reconectar.',
      ),
    ).toBeTruthy();
    expect(await screen.findByText('Pago de viaje recibido')).toBeTruthy();
  });

  it('con la red en línea no muestra el aviso', async () => {
    await abrir({ [RUTA]: h.pagina1 });
    await screen.findByText('Pago de viaje recibido');
    expect(screen.queryByText(/último saldo sincronizado/)).toBeNull();
  });

  it('volver regresa a la pestaña', async () => {
    await abrir({ [RUTA]: h.vacio });
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Volver' }),
    );
    expect(router.back).toHaveBeenCalled();
  });

  it('sin sesión no pide movimientos ni saldo', async () => {
    const { llamadas } = await abrir({
      'POST /autenticacion/refrescar': { estado: 401, cuerpo: {} },
    });
    expect(await screen.findByText('redirige:/iniciar-sesion')).toBeTruthy();
    expect(llamadas.filter((l) => l.ruta.includes('billetera'))).toHaveLength(
      0,
    );
  });
});

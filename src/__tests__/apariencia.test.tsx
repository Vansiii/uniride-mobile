import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import * as AlmacenSeguro from 'expo-secure-store';
import { AccessibilityInfo } from 'react-native';
import AparienciaPantalla from '@/app/ajustes-apariencia';
import { ProveedorSesion } from '@/contexto/sesion';
import { respuestasReales as r, simularFetch } from '@/pruebas/respuestasApi';
import { ProveedorTema } from '@/tema/ProveedorTema';
import { paletas } from '@/tema/paletas';

const mockRouter = { push: jest.fn(), back: jest.fn() };
const mockSistema: { valor: 'light' | 'dark' } = { valor: 'light' };

jest.mock('expo-router', () => {
  const { Text: Texto } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) => (
      <Texto>{`redirige:${href}`}</Texto>
    ),
    router: {
      push: (...a: unknown[]) => mockRouter.push(...a),
      back: () => mockRouter.back(),
    },
  };
});
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockSistema.valor,
}));

const guardado = jest.mocked(AlmacenSeguro.getItemAsync);
const guardar = jest.mocked(AlmacenSeguro.setItemAsync);
const CLAVE = 'uniride.apariencia';

/** El almacén responde distinto según la clave: la sesión usa su token y la apariencia, la suya. */
const almacen = (apariencia: string | null) =>
  guardado.mockImplementation(async (clave) =>
    clave === CLAVE ? apariencia : 'refresco-de-prueba',
  );

const abrir = async () => {
  simularFetch({
    'POST /autenticacion/refrescar': r.sesionAprobada,
    'GET /yo': r.yoAprobada,
  });
  await render(
    <ProveedorTema>
      <ProveedorSesion>
        <AparienciaPantalla />
      </ProveedorSesion>
    </ProveedorTema>,
  );
  return screen.findByText('Tamaño de texto');
};

beforeEach(() => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  jest.clearAllMocks();
  mockSistema.valor = 'light';
  almacen(null);
  guardar.mockResolvedValue(undefined);
});

describe('HU-31 · Apariencia', () => {
  it('CA-1, CA-9: tres grupos de opciones; cada una con su nombre y su estado', async () => {
    await abrir();
    for (const nombre of [
      'tema automático',
      'tema claro',
      'tema oscuro',
      'texto normal',
      'texto grande',
      'texto muy grande',
    ])
      expect(
        screen.getByRole('radio', { name: new RegExp(`^${nombre}$`, 'i') }),
      ).toBeTruthy();
    expect(screen.getByRole('checkbox')).toBeTruthy();
    // Por defecto: Automático y Normal elegidos, sin alto contraste (RN-2).
    expect(
      screen.getByRole('radio', { name: /^Tema automático$/i }).props
        .accessibilityState,
    ).toEqual({ selected: true });
    expect(
      screen.getByRole('radio', { name: /^Tema oscuro$/i }).props
        .accessibilityState,
    ).toEqual({ selected: false });
    expect(
      screen.getByRole('radio', { name: /^Texto normal$/i }).props
        .accessibilityState,
    ).toEqual({ selected: true });
    expect(screen.getByRole('checkbox').props.accessibilityState).toEqual({
      checked: false,
    });
  });

  it('CA-2, CA-6: «Oscuro» cambia los colores al instante y se guarda', async () => {
    await abrir();
    expect(screen.getByText('Apariencia')).toHaveStyle({
      color: paletas.claro.texto,
    });
    await fireEvent.press(
      screen.getByRole('radio', { name: /^Tema oscuro$/i }),
    );
    await waitFor(() =>
      expect(screen.getByText('Apariencia')).toHaveStyle({
        color: paletas.oscuro.texto,
      }),
    );
    expect(
      screen.getByRole('radio', { name: /^Tema oscuro$/i }).props
        .accessibilityState,
    ).toEqual({ selected: true });
    expect(guardar).toHaveBeenCalledWith(
      CLAVE,
      JSON.stringify({
        tema: 'oscuro',
        texto: 'normal',
        altoContraste: false,
      }),
    );
  });

  it('CA-3: «Automático» sigue al teléfono', async () => {
    mockSistema.valor = 'dark';
    await abrir();
    expect(screen.getByText('Apariencia')).toHaveStyle({
      color: paletas.oscuro.texto,
    });
    await fireEvent.press(screen.getByRole('radio', { name: /^Tema claro$/i }));
    await waitFor(() =>
      expect(screen.getByText('Apariencia')).toHaveStyle({
        color: paletas.claro.texto,
      }),
    );
  });

  it('CA-4: «Muy grande» agranda el texto ×1,3', async () => {
    await abrir();
    const antes = screen.getByText('Apariencia').props.style;
    const tamanoAntes = [antes].flat(5).find((e) => e?.fontSize)?.fontSize;
    await fireEvent.press(
      screen.getByRole('radio', { name: /^Texto muy grande$/i }),
    );
    await waitFor(() => {
      const ahora = screen.getByText('Apariencia').props.style;
      expect([ahora].flat(5).find((e) => e?.fontSize)?.fontSize).toBe(
        Math.round(tamanoAntes * 1.3),
      );
    });
  });

  it('CA-5: «Alto contraste» activa la paleta de 7:1', async () => {
    await abrir();
    await fireEvent.press(screen.getByRole('checkbox'));
    await waitFor(() =>
      expect(screen.getByText('Apariencia')).toHaveStyle({
        color: paletas.altoContrasteClaro.texto,
      }),
    );
    expect(guardar).toHaveBeenLastCalledWith(
      CLAVE,
      JSON.stringify({
        tema: 'automatico',
        texto: 'normal',
        altoContraste: true,
      }),
    );
  });

  it('CA-6: al abrir la app conserva las tres elecciones', async () => {
    almacen(
      JSON.stringify({ tema: 'oscuro', texto: 'grande', altoContraste: true }),
    );
    await abrir();
    await waitFor(() =>
      expect(
        screen.getByRole('radio', { name: /^Tema oscuro$/i }).props
          .accessibilityState,
      ).toEqual({ selected: true }),
    );
    expect(
      screen.getByRole('radio', { name: /^Texto grande$/i }).props
        .accessibilityState,
    ).toEqual({ selected: true });
    expect(screen.getByRole('checkbox').props.accessibilityState).toEqual({
      checked: true,
    });
  });

  it('CA-10: un dato guardado corrupto vuelve a los valores por defecto sin fallar', async () => {
    almacen('{"tema": "rosado", "texto": 7');
    await abrir();
    expect(
      screen.getByRole('radio', { name: /^Tema automático$/i }).props
        .accessibilityState,
    ).toEqual({ selected: true });
    expect(screen.getByRole('checkbox').props.accessibilityState).toEqual({
      checked: false,
    });
  });

  it('si no se puede guardar, se aplica en la sesión y se avisa', async () => {
    guardar.mockImplementation(async (clave) => {
      if (clave === CLAVE) throw new Error('sin espacio');
    });
    await abrir();
    await fireEvent.press(
      screen.getByRole('radio', { name: /^Tema oscuro$/i }),
    );
    expect(
      await screen.findByText(
        'No pudimos guardar tu elección; se aplica solo en esta sesión.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Apariencia')).toHaveStyle({
      color: paletas.oscuro.texto,
    });
    await act(async () => undefined);
  });
});

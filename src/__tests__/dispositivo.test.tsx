import { fireEvent, render, screen } from '@testing-library/react-native';
import DispositivoPantalla from '@/app/dispositivo';
import { ProveedorSesion } from '@/contexto/sesion';
import { useLocalSearchParams } from 'expo-router';
import {
  confirmarLlave,
  crearLlave,
  ErrorKeystore,
  pedirTokenIntegridad,
} from '@/dispositivo/keystore';
import { ejecutarLiveness } from '@/identidad/liveness';
import {
  dispositivoReal as d,
  respuestasReales as r,
  simularFetch,
} from '@/pruebas/respuestasApi';

jest.mock('expo-router', () => {
  const { Text: Texto } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) => (
      <Texto>{`redirige:${href}`}</Texto>
    ),
    router: { push: jest.fn(), back: jest.fn() },
    useLocalSearchParams: jest.fn(() => ({})),
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
jest.mock('expo-device', () => ({ modelName: 'Pixel 8' }));
jest.mock('@/identidad/liveness', () => ({
  ejecutarLiveness: jest.fn().mockResolvedValue(undefined),
  ErrorLiveness: class ErrorLiveness extends Error {
    constructor() {
      super('LIVENESS_NO_DISPONIBLE');
    }
  },
}));
jest.mock('@/dispositivo/keystore', () => ({
  crearLlave: jest.fn(),
  confirmarLlave: jest.fn(),
  fallaDeLlave: jest.requireActual('@/dispositivo/keystore').fallaDeLlave,
  pedirTokenIntegridad: jest.fn(),
  ErrorKeystore: class ErrorKeystore extends Error {
    codigo: string;
    constructor(codigo: string) {
      super(codigo);
      this.codigo = codigo;
    }
  },
}));

const llave = jest.mocked(crearLlave);
const integridad = jest.mocked(pedirTokenIntegridad);
const liveness = jest.mocked(ejecutarLiveness);
const confirmar = jest.mocked(confirmarLlave);
const parametros = jest.mocked(useLocalSearchParams);
const PEM = '-----BEGIN PUBLIC KEY-----\nMFkw\n-----END PUBLIC KEY-----';
const CON_SESION = {
  'POST /autenticacion/refrescar': r.sesionAprobada,
  'GET /yo': r.yoAprobada,
};

const abrir = async (rutas: Parameters<typeof simularFetch>[0]) => {
  const simulado = simularFetch({
    ...CON_SESION,
    'GET /dispositivos/mi-dispositivo': d.sinDispositivo,
    ...rutas,
  });
  await render(
    <ProveedorSesion>
      <DispositivoPantalla />
    </ProveedorSesion>,
  );
  return simulado;
};
const vincular = async () => {
  await screen.findByRole('button', { name: 'Vincular este teléfono' });
  await fireEvent.press(
    screen.getByRole('button', { name: 'Vincular este teléfono' }),
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  llave.mockResolvedValue(PEM);
  integridad.mockResolvedValue('token-de-play-integrity');
  confirmar.mockResolvedValue(undefined);
  parametros.mockReturnValue({});
});

describe('Vinculación de dispositivo', () => {
  it('CA-1: pide el desafío, crea la llave, atesta con ese desafío y envía solo la llave pública', async () => {
    const { llamadas } = await abrir({
      'POST /dispositivos/desafio-atestacion': d.desafio,
      'POST /dispositivos/vincular': d.vinculadoOk,
      'GET /dispositivos/mi-dispositivo': [d.sinDispositivo, d.vinculado],
    });
    await vincular();
    expect(
      await screen.findByText('Tu teléfono quedó vinculado.'),
    ).toBeTruthy();
    expect(screen.getByText('Pixel 8')).toBeTruthy();
    expect(integridad).toHaveBeenCalledWith('ZGVzYWZpby1kZS1wcnVlYmE');
    const envio = llamadas.find(
      (l) => l.ruta === 'POST /dispositivos/vincular',
    );
    expect(envio?.cuerpo).toEqual({
      desafio: 'ZGVzYWZpby1kZS1wcnVlYmE',
      tokenIntegridad: 'token-de-play-integrity',
      llavePublicaPem: PEM,
      modelo: 'Pixel 8',
    });
    // La llave nueva pasa a firmar solo con el 201.
    expect(confirmar).toHaveBeenCalledTimes(1);
    // Ya vinculado no se ofrece vincular de nuevo (CA-6).
    expect(
      screen.queryByRole('button', { name: 'Vincular este teléfono' }),
    ).toBeNull();
  });

  it('CA-2: un teléfono no íntegro se rechaza con un mensaje claro y no queda vinculado', async () => {
    await abrir({
      'POST /dispositivos/desafio-atestacion': d.desafio,
      'POST /dispositivos/vincular': d.noIntegro,
    });
    await vincular();
    expect(
      await screen.findByText(
        /no pudimos comprobar que este teléfono es original/i,
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Tu teléfono quedó vinculado.')).toBeNull();
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('CA-6: si la cuenta ya tiene un teléfono, muestra el existente y no deja vincular otro', async () => {
    await abrir({ 'GET /dispositivos/mi-dispositivo': d.vinculado });
    expect(await screen.findByText('Pixel 8')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Vincular este teléfono' }),
    ).toBeNull();
  });

  it('CA-6: si otra sesión lo vinculó antes, avisa y muestra el que quedó', async () => {
    await abrir({
      'POST /dispositivos/desafio-atestacion': d.desafio,
      'POST /dispositivos/vincular': d.yaVinculado,
      'GET /dispositivos/mi-dispositivo': [d.sinDispositivo, d.vinculado],
    });
    await vincular();
    expect(
      await screen.findByText('Tu cuenta ya tiene un teléfono vinculado.'),
    ).toBeTruthy();
    expect(await screen.findByText('Pixel 8')).toBeTruthy();
  });

  it('CA-7: si la persona cancela la biometría no se envía nada al servidor', async () => {
    llave.mockRejectedValue(new ErrorKeystore('BIOMETRIA_CANCELADA'));
    const { llamadas } = await abrir({
      'POST /dispositivos/desafio-atestacion': d.desafio,
    });
    await vincular();
    expect(
      await screen.findByText(/Cancelaste la verificación biométrica/),
    ).toBeTruthy();
    expect(llamadas.some((l) => l.ruta === 'POST /dispositivos/vincular')).toBe(
      false,
    );
  });

  it('sin módulo de Keystore falla de forma segura, sin enviar nada', async () => {
    llave.mockRejectedValue(new ErrorKeystore('KEYSTORE_NO_DISPONIBLE'));
    const { llamadas } = await abrir({
      'POST /dispositivos/desafio-atestacion': d.desafio,
    });
    await vincular();
    expect(
      await screen.findByText(/todavía no puede vincular el teléfono/),
    ).toBeTruthy();
    expect(llamadas.some((l) => l.ruta === 'POST /dispositivos/vincular')).toBe(
      false,
    );
  });

  it('si no puede consultar el estado ofrece reintentar y no vincular a ciegas', async () => {
    simularFetch({ ...CON_SESION });
    await render(
      <ProveedorSesion>
        <DispositivoPantalla />
      </ProveedorSesion>,
    );
    expect(
      await screen.findByRole('button', { name: 'Reintentar' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Vincular este teléfono' }),
    ).toBeNull();
  });

  describe('Revinculación / pasar cuenta a este teléfono (HU-10)', () => {
    it('muestra el botón para pasar la cuenta si ya tiene teléfono vinculado', async () => {
      await abrir({ 'GET /dispositivos/mi-dispositivo': d.vinculado });
      expect(
        await screen.findByRole('button', {
          name: 'Pasar mi cuenta a este teléfono',
        }),
      ).toBeTruthy();
    });

    it('CA-2: revincula exitosamente con prueba de vida si requiere identidad', async () => {
      llave.mockResolvedValue(PEM);
      integridad.mockResolvedValue('token-amoy');
      liveness.mockResolvedValue(undefined);

      const { llamadas } = await abrir({
        'GET /dispositivos/mi-dispositivo': [d.vinculado, d.vinculado],
        'POST /dispositivos/revinculacion': d.desafioRevinculacion,
        'POST /dispositivos/revincular': d.revinculadoOk,
      });

      const boton = await screen.findByRole('button', {
        name: 'Pasar mi cuenta a este teléfono',
      });
      fireEvent.press(boton);

      expect(
        await screen.findByText('Tu teléfono quedó vinculado.'),
      ).toBeTruthy();
      expect(liveness).toHaveBeenCalledWith('liveness-ses-123');
      expect(llave).toHaveBeenCalled();
      expect(integridad).toHaveBeenCalledWith('ZGVzYWZpby1yZXZpbmN1bGFjaW9u');
      const envio = llamadas.find(
        (l) => l.ruta === 'POST /dispositivos/revincular',
      );
      expect(envio?.cuerpo).toMatchObject({
        desafio: 'ZGVzYWZpby1yZXZpbmN1bGFjaW9u',
        llavePublicaPem: PEM,
        tokenIntegridad: 'token-amoy',
        modelo: 'Pixel 8',
        sesionLivenessId: 'liveness-ses-123',
      });
      expect(confirmar).toHaveBeenCalledTimes(1);
    });

    it('CA-10: revincula sin prueba de vida si no requiere identidad', async () => {
      llave.mockResolvedValue(PEM);
      integridad.mockResolvedValue('token-amoy');

      const { llamadas } = await abrir({
        'GET /dispositivos/mi-dispositivo': [d.vinculado, d.vinculado],
        'POST /dispositivos/revinculacion': d.desafioRevinculacionSinIdentidad,
        'POST /dispositivos/revincular': d.revinculadoOk,
      });

      const boton = await screen.findByRole('button', {
        name: 'Pasar mi cuenta a este teléfono',
      });
      fireEvent.press(boton);

      expect(
        await screen.findByText('Tu teléfono quedó vinculado.'),
      ).toBeTruthy();
      expect(liveness).not.toHaveBeenCalled();
      const envio = llamadas.find(
        (l) => l.ruta === 'POST /dispositivos/revincular',
      );
      expect((envio?.cuerpo as { desafio?: string })?.desafio).toBe(
        'ZGVzYWZpby1yZXZpbmN1bGFjaW9u',
      );
      expect(
        (envio?.cuerpo as { sesionLivenessId?: string })?.sesionLivenessId,
      ).toBeUndefined();
    });

    it('CA-4: si el rostro no coincide muestra el mensaje amigable de es-BO', async () => {
      llave.mockResolvedValue(PEM);
      integridad.mockResolvedValue('token-amoy');
      liveness.mockResolvedValue(undefined);

      await abrir({
        'GET /dispositivos/mi-dispositivo': d.vinculado,
        'POST /dispositivos/revinculacion': d.desafioRevinculacion,
        'POST /dispositivos/revincular': d.rostroNoCoincide,
      });

      const boton = await screen.findByRole('button', {
        name: 'Pasar mi cuenta a este teléfono',
      });
      fireEvent.press(boton);

      expect(
        await screen.findByText(
          'Tu rostro no coincide con el de tu carnet verificado. No pudimos vincular este teléfono.',
        ),
      ).toBeTruthy();
      // Rechazada: la llave anterior sigue siendo la que firma.
      expect(confirmar).not.toHaveBeenCalled();
    });

    it('tras vincular, un rechazo al revincular no deja el aviso de éxito anterior', async () => {
      await abrir({
        'POST /dispositivos/desafio-atestacion': d.desafio,
        'POST /dispositivos/vincular': d.vinculadoOk,
        'GET /dispositivos/mi-dispositivo': [d.sinDispositivo, d.vinculado],
        'POST /dispositivos/revinculacion': d.desafioRevinculacion,
        'POST /dispositivos/revincular': d.rostroNoCoincide,
      });
      await vincular();
      await screen.findByText('Tu teléfono quedó vinculado.');
      fireEvent.press(
        screen.getByRole('button', { name: 'Pasar mi cuenta a este teléfono' }),
      );
      expect(
        await screen.findByText(/Tu rostro no coincide con el de tu carnet/),
      ).toBeTruthy();
      expect(screen.queryByText('Tu teléfono quedó vinculado.')).toBeNull();
    });

    it.each([
      [
        'PRUEBA_VIDA_FALLIDA',
        d.pruebaVidaFallida,
        /No pudimos confirmar que eres una persona real/,
      ],
      [
        'INTENTOS_AGOTADOS',
        d.intentosAgotados,
        /Podrás intentarlo de nuevo a las \d\d:\d\d/,
      ],
      [
        'CONFLICTO_CONCURRENTE',
        d.conflictoConcurrente,
        /se estaba pasando a otro teléfono al mismo tiempo/,
      ],
    ])(
      '%s: muestra su mensaje y no cambia de llave',
      async (_c, resp, texto) => {
        await abrir({
          'GET /dispositivos/mi-dispositivo': d.vinculado,
          'POST /dispositivos/revinculacion': d.desafioRevinculacion,
          'POST /dispositivos/revincular': resp,
        });
        fireEvent.press(
          await screen.findByRole('button', {
            name: 'Pasar mi cuenta a este teléfono',
          }),
        );
        expect(await screen.findByText(texto)).toBeTruthy();
        expect(confirmar).not.toHaveBeenCalled();
      },
    );

    it('CA-1: con la llave anulada explica la huella nueva y ofrece confirmar la identidad (nunca «Actualiza la app»)', async () => {
      parametros.mockReturnValue({ motivo: 'llave_anulada' });
      await abrir({
        'GET /dispositivos/mi-dispositivo': [d.vinculado, d.vinculado],
        'POST /dispositivos/revinculacion': d.desafioRevinculacion,
        'POST /dispositivos/revincular': d.revinculadoOk,
      });
      expect(
        await screen.findByText(
          'Registraste una huella nueva. Por seguridad, confirma tu identidad para volver a activar este teléfono.',
        ),
      ).toBeTruthy();
      expect(screen.queryByText(/Actualiza la app/)).toBeNull();
      // Una sola salida: no se repite el botón secundario.
      expect(
        screen.queryByRole('button', {
          name: 'Pasar mi cuenta a este teléfono',
        }),
      ).toBeNull();
      fireEvent.press(
        screen.getByRole('button', { name: 'Confirmar mi identidad' }),
      );
      expect(
        await screen.findByText('Tu teléfono quedó vinculado.'),
      ).toBeTruthy();
      expect(liveness).toHaveBeenCalledWith('liveness-ses-123');
      expect(confirmar).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByRole('button', { name: 'Confirmar mi identidad' }),
      ).toBeNull();
    });
  });
});

import type * as Keystore from '@/dispositivo/keystore';

type Modulo = typeof Keystore;

/** Carga `keystore.ts` de cero; con `nativo` simula la app de Android, sin él corre como en web y Jest. */
function cargar(nativo?: object): Modulo {
  let cargado!: Modulo;
  jest.isolateModules(() => {
    if (nativo)
      jest.doMock('expo', () => ({
        requireOptionalNativeModule: () => nativo,
      }));
    else jest.dontMock('expo');
    cargado = jest.requireActual('@/dispositivo/keystore');
  });
  return cargado;
}

const codigoDe = (promesa: Promise<unknown>) =>
  promesa.then(
    () => 'sin falla',
    (error) => error.codigo,
  );

describe('Keystore sin módulo nativo (web y Jest)', () => {
  const k = () => cargar();

  it('no crea llave ni firma: falla de forma segura', async () => {
    expect(await codigoDe(k().crearLlave())).toBe('KEYSTORE_NO_DISPONIBLE');
    expect(await codigoDe(k().firmar('m', 'n'))).toBe('KEYSTORE_NO_DISPONIBLE');
    expect(() => k().nonceAleatorio()).toThrow('KEYSTORE_NO_DISPONIBLE');
  });
});

describe('Keystore con módulo nativo', () => {
  const nativo = {
    crearLlave: jest.fn(),
    firmar: jest.fn(),
    nonceAleatorio: jest.fn(),
  };
  beforeEach(() => jest.resetAllMocks());

  it('devuelve la llave pública y la firma tal como salen del Keystore', async () => {
    nativo.crearLlave.mockResolvedValue('PEM');
    nativo.firmar.mockResolvedValue({ firma: 'RklSTUE=', marca: '1' });
    nativo.nonceAleatorio.mockReturnValue('ab'.repeat(16));
    const k = cargar(nativo);
    expect(await k.crearLlave()).toBe('PEM');
    expect(await k.firmar('antes', 'despues')).toEqual({
      firma: 'RklSTUE=',
      marca: '1',
    });
    expect(k.nonceAleatorio()).toBe('ab'.repeat(16));
  });

  it('el diálogo de huella recibe los textos de es-BO y el mensaje exacto', async () => {
    nativo.firmar.mockResolvedValue({ firma: 'RklSTUE=', marca: '1' });
    await cargar(nativo).firmar('GET\n/ruta\n', '\nnonce');
    expect(nativo.firmar).toHaveBeenCalledWith('GET\n/ruta\n', '\nnonce', {
      titulo: 'Confirma que eres tú',
      subtitulo: 'Usa tu huella o rostro para continuar.',
      cancelar: 'Cancelar',
    });
  });

  it('cancelar la huella no firma y da BIOMETRIA_CANCELADA (CA-7, A-04)', async () => {
    nativo.firmar.mockRejectedValue(
      Object.assign(new Error('x'), { code: 'BIOMETRIA_CANCELADA' }),
    );
    expect(await codigoDe(cargar(nativo).firmar('m', 'n'))).toBe(
      'BIOMETRIA_CANCELADA',
    );
  });

  it.each(['crearLlave', 'firmar'] as const)(
    'cualquier otra falla de %s es KEYSTORE_NO_DISPONIBLE y no filtra el detalle nativo',
    async (funcion) => {
      nativo[funcion].mockRejectedValue(
        Object.assign(new Error('detalle interno'), {
          code: 'KEYSTORE_NO_DISPONIBLE',
        }),
      );
      const falla = await cargar(nativo)
        [funcion]('m', 'n')
        .catch((e: Error) => e);
      expect((falla as Keystore.ErrorKeystore).codigo).toBe(
        'KEYSTORE_NO_DISPONIBLE',
      );
      expect((falla as Error).message).not.toContain('detalle interno');
    },
  );
});

describe('Token de integridad (Play Integrity real queda fuera)', () => {
  const original = process.env.EXPO_PUBLIC_MODO_SIMULADO;
  const modo = (valor: string | undefined, dev: boolean) => {
    if (valor === undefined) delete process.env.EXPO_PUBLIC_MODO_SIMULADO;
    else process.env.EXPO_PUBLIC_MODO_SIMULADO = valor;
    (globalThis as { __DEV__?: boolean }).__DEV__ = dev;
  };
  afterEach(() => modo(original, true));

  it('solo en desarrollo con EXPO_PUBLIC_MODO_SIMULADO=true devuelve el token simulado', async () => {
    modo('true', true);
    expect(await cargar().pedirTokenIntegridad('d')).toBe('simulado:integro');
  });

  it.each([
    ['desarrollo sin la bandera', undefined, true],
    ['desarrollo con otra bandera', 'false', true],
    ['producción aunque la bandera esté puesta (A-03)', 'true', false],
  ])('%s: falla', async (_caso, valor, dev) => {
    modo(valor, dev);
    expect(await codigoDe(cargar().pedirTokenIntegridad('d'))).toBe(
      'KEYSTORE_NO_DISPONIBLE',
    );
  });
});

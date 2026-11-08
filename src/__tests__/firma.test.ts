import { getItemAsync } from 'expo-secure-store';
import { iniciarSesion, solicitarFirmado } from '@/api/cliente';
import { cabecerasFirma, mensajeCanonico } from '@/dispositivo/firma';
import { firmar } from '@/dispositivo/keystore';
import { sha256Hex } from '@/dispositivo/sha256';
import { dispositivoReal as d, simularFetch } from '@/pruebas/respuestasApi';

// El móvil no trae tipos de Node: se declara solo lo que usan estas pruebas para hablar como el servidor.
interface Nodo {
  createHash(a: string): { update(t: string): { digest(e: string): string } };
  generateKeyPairSync(
    t: string,
    o: object,
  ): { privateKey: unknown; publicKey: unknown };
  sign(a: string, d: Uint8Array, k: unknown): { toString(e: string): string };
  verify(a: string, d: Uint8Array, k: unknown, s: Uint8Array): boolean;
}
const nodo = () => jest.requireActual<Nodo>('node:crypto');
const bytes = (texto: string) => new TextEncoder().encode(texto);
const deBase64 = (b64: string) =>
  jest
    .requireActual<{
      Buffer: { from(s: string, e: string): Uint8Array };
    }>('node:buffer')
    .Buffer.from(b64, 'base64');

const mockPar = nodo().generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

// Lo que haría el Keystore: ECDSA P-256 con SHA-256, firma en DER y Base64 (lo que acepta el servidor).
jest.mock('@/dispositivo/keystore', () => ({
  firmar: jest.fn(async (antes: string, despues: string) => {
    const marca = String(Date.now());
    return {
      marca,
      firma: jest
        .requireActual('node:crypto')
        .sign(
          'sha256',
          new TextEncoder().encode(antes + marca + despues),
          mockPar.privateKey,
        )
        .toString('base64'),
    };
  }),
  nonceAleatorio: () =>
    jest.requireActual('node:crypto').randomBytes(16).toString('hex'),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const valida = (mensaje: string, firma: string) =>
  nodo().verify('sha256', bytes(mensaje), mockPar.publicKey, deBase64(firma));
const sha256Servidor = (texto: string) =>
  nodo().createHash('sha256').update(texto).digest('hex');

describe('SHA-256 del cuerpo firmado (HU-09 RN-4)', () => {
  it.each([
    '',
    'abc',
    'a'.repeat(55),
    'a'.repeat(56),
    'a'.repeat(63),
    'a'.repeat(64),
    'a'.repeat(1000),
    '{"origen":"Plaza 24 de Septiembre","precio":4.5,"nota":"ñandú ✓"}',
  ])('coincide con el del servidor (%#)', (texto) => {
    expect(sha256Hex(texto)).toBe(sha256Servidor(texto));
  });
});

describe('Firma de peticiones sensibles', () => {
  const RUTA = '/api/v1/billetera/recargas';

  describe('una sola huella por petición', () => {
    const rechazo = (codigo: string) => ({ estado: 401, cuerpo: { codigo } });
    const sesion = {
      estado: 200,
      cuerpo: { tokenAcceso: 'a', tokenRefresco: 'r' },
    };
    const abrir = async (respuestas: { estado: number; cuerpo: object }[]) => {
      const { llamadas, falso } = simularFetch({
        'POST /autenticacion/iniciar-sesion': sesion,
        'POST /autenticacion/refrescar': sesion,
        'GET /dispositivos/mi-dispositivo': d.vinculado,
        'POST /billetera/recargas': respuestas,
      });
      await iniciarSesion('a@b.c', 'clave');
      jest.mocked(getItemAsync).mockResolvedValue('r');
      jest.mocked(firmar).mockClear();
      return { llamadas, falso };
    };

    it('si solo venció la sesión, la renueva y reenvía la misma firma', async () => {
      const { llamadas, falso } = await abrir([
        rechazo('NO_AUTENTICADO'),
        { estado: 200, cuerpo: {} },
      ]);
      await solicitarFirmado('/billetera/recargas', 'POST', { monto: 10 });
      expect(firmar).toHaveBeenCalledTimes(1);
      expect(llamadas.map((l) => l.ruta)).toContain(
        'POST /autenticacion/refrescar',
      );
      const firmas = falso.mock.calls
        .filter(([u]) => u.endsWith('/billetera/recargas'))
        .map(([, i]) => (i?.headers as Record<string, string>)['X-Firma']);
      expect(firmas).toHaveLength(2);
      expect(firmas[1]).toBe(firmas[0]);
    });

    it.each(['PETICION_EXPIRADA', 'FIRMA_DISPOSITIVO_INVALIDA'])(
      '%s no se reintenta solo: no renueva la sesión ni pide otra huella',
      async (codigo) => {
        const { llamadas } = await abrir([rechazo(codigo)]);
        await expect(
          solicitarFirmado('/billetera/recargas', 'POST', { monto: 10 }),
        ).rejects.toMatchObject({ codigo });
        expect(firmar).toHaveBeenCalledTimes(1);
        expect(llamadas.map((l) => l.ruta)).not.toContain(
          'POST /autenticacion/refrescar',
        );
      },
    );
  });

  it('el mensaje canónico es METODO, RUTA, TIMESTAMP, NONCE y hash del cuerpo', () => {
    const nonce = 'n'.repeat(16);
    expect(
      mensajeCanonico(
        'post',
        '/api/v1/viajes?x=1',
        '1730000000000',
        nonce,
        '{"a":1}',
      ),
    ).toBe(
      `POST\n/api/v1/viajes?x=1\n1730000000000\n${nonce}\n${sha256Servidor('{"a":1}')}`,
    );
  });

  it('la firma se verifica con la llave pública como lo hace el servidor, y alterar el cuerpo la invalida (CA-3, CA-4)', async () => {
    const cuerpo = '{"monto":10}';
    const c = await cabecerasFirma('id-dispositivo', 'POST', RUTA, cuerpo);
    expect(Object.keys(c).sort()).toEqual(
      ['X-Dispositivo-Id', 'X-Firma', 'X-Nonce', 'X-Timestamp'].sort(),
    );
    expect(c['X-Nonce']).toMatch(/^[A-Za-z0-9+/_=-]{16,128}$/);
    expect(c['X-Firma']).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    const con = (cuerpoFirmado: string) =>
      mensajeCanonico(
        'POST',
        RUTA,
        c['X-Timestamp'],
        c['X-Nonce'],
        cuerpoFirmado,
      );
    expect(valida(con(cuerpo), c['X-Firma'])).toBe(true);
    expect(valida(con('{"monto":9999}'), c['X-Firma'])).toBe(false);
  });

  it('cada petición lleva un nonce distinto (anti-replay, CA-5)', async () => {
    const a = await cabecerasFirma('d', 'GET', '/api/v1/x', '');
    const b = await cabecerasFirma('d', 'GET', '/api/v1/x', '');
    expect(a['X-Nonce']).not.toBe(b['X-Nonce']);
  });

  it('una petición firmada sale con los encabezados y el mismo cuerpo que se firmó', async () => {
    const { falso } = simularFetch({
      'GET /dispositivos/mi-dispositivo': d.vinculado,
      'POST /billetera/recargas': { estado: 200, cuerpo: {} },
    });
    await solicitarFirmado('/billetera/recargas', 'POST', { monto: 10 });
    const [url, init] = falso.mock.calls.at(-1) as [string, RequestInit];
    const h = init.headers as Record<string, string>;
    expect(new URL(url).pathname).toBe(RUTA);
    expect(h['X-Dispositivo-Id']).toBe(
      d.vinculado.cuerpo && (d.vinculado.cuerpo as { id: string }).id,
    );
    expect(
      valida(
        mensajeCanonico(
          'POST',
          RUTA,
          h['X-Timestamp'],
          h['X-Nonce'],
          String(init.body),
        ),
        h['X-Firma'],
      ),
    ).toBe(true);
  });
});

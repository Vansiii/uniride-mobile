import { ejecutarLiveness, ErrorLiveness } from '@/identidad/liveness';

const mockIniciar = jest.fn();
const mockPedirCredenciales = jest.fn();

jest.mock('expo', () => ({
  ...jest.requireActual('expo'),
  requireOptionalNativeModule: jest.fn(() => ({
    iniciar: (...a: unknown[]) => mockIniciar(...a),
  })),
}));
jest.mock('@/api/cliente', () => ({
  pedirCredencialesLiveness: () => mockPedirCredenciales(),
}));

const credenciales = {
  accessKeyId: 'ASIA1',
  secretAccessKey: 's',
  sessionToken: 't',
  expiracion: '2026-11-19T12:00:00.000Z',
  region: 'us-east-1',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPedirCredenciales.mockResolvedValue(credenciales);
});

describe('ejecutarLiveness', () => {
  it('abre el componente nativo con las credenciales temporales de la API', async () => {
    mockIniciar.mockResolvedValue(undefined);
    await ejecutarLiveness('ses-1');
    expect(mockIniciar).toHaveBeenCalledWith(
      'ses-1',
      'us-east-1',
      'ASIA1',
      's',
      't',
      Date.parse(credenciales.expiracion) / 1000,
    );
  });

  it('una falla del componente (p. ej. cancelar) llega como ErrorLiveness con su código', async () => {
    mockIniciar.mockRejectedValue(
      Object.assign(new Error('x'), { code: 'CANCELADA' }),
    );
    const error = await ejecutarLiveness('ses-1').catch((e) => e);
    expect(error).toBeInstanceOf(ErrorLiveness);
    expect(error.codigo).toBe('CANCELADA');
  });

  it('si la API no da credenciales, no abre la cámara y el error de la API sigue su camino', async () => {
    mockPedirCredenciales.mockRejectedValue(new Error('503'));
    await expect(ejecutarLiveness('ses-1')).rejects.toThrow('503');
    expect(mockIniciar).not.toHaveBeenCalled();
  });
});

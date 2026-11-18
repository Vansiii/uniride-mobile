import { fireEvent, render, screen } from '@testing-library/react-native';
import RecargarPantalla from '@/app/recargar';
import { cerrarSesion, ErrorApi } from '@/api/cliente';
import { ProveedorSesion } from '@/contexto/sesion';
import { ErrorKeystore, firmar } from '@/dispositivo/keystore';
import { dialogoDe, fallaDeFirma } from '@/hooks/useAccionSensible';
import {
  dispositivoReal as d,
  recargaReal as o,
  respuestasReales as r,
  simularFetch,
} from '@/pruebas/respuestasApi';

jest.mock('expo-router', () => {
  const { Text: Texto } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) => (
      <Texto>{`redirige:${href}`}</Texto>
    ),
    router: { push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() },
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
jest.mock('@/dispositivo/keystore', () => ({
  firmar: jest.fn(),
  fallaDeLlave: jest.requireActual('@/dispositivo/keystore').fallaDeLlave,
  nonceAleatorio: () => 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
  ErrorKeystore: class ErrorKeystore extends Error {
    codigo: string;
    constructor(codigo: string) {
      super(codigo);
      this.codigo = codigo;
    }
  },
}));

const firma = jest.mocked(firmar);
const CONFIRMAR = `POST /billetera/recargas/${o.ordenId}/confirmar`;
const PAGAR = 'Simular pago de 50,00 Bs';
const boton = (name: string) => screen.getByRole('button', { name });
const confirmaciones = (llamadas: { ruta: string }[]) =>
  llamadas.filter((l) => l.ruta === CONFIRMAR).length;

/** Recarga de 50 Bs hasta el QR: el resumen con el monto y el botón de la acción sensible. */
async function abrirConfirmacion() {
  const simulado = simularFetch({
    'POST /autenticacion/refrescar': r.sesionAprobada,
    'GET /yo': r.yoAprobada,
    'GET /dispositivos/mi-dispositivo': d.vinculado,
    'POST /billetera/recargas': o.creada(),
    [CONFIRMAR]: o.procesando(),
  });
  await render(
    <ProveedorSesion>
      <RecargarPantalla />
    </ProveedorSesion>,
  );
  await screen.findByText('¿Cuánto quieres recargar?');
  await fireEvent.press(boton('Generar QR de pago'));
  await screen.findByText('Pagar con QR');
  return simulado;
}

beforeEach(async () => {
  jest.clearAllMocks();
  await cerrarSesion().catch(() => undefined);
  firma.mockReset();
  firma.mockResolvedValue({ firma: 'firma-de-prueba', marca: '1' });
});

describe('HU-29 · confirmación biométrica en la app', () => {
  it('CA-1: resumen con el monto, botón con la acción y diálogo que nombra acción y monto', async () => {
    await abrirConfirmacion();
    expect(screen.getByText('Monto a pagar')).toBeTruthy();
    expect(screen.getByText('50,00 Bs')).toBeTruthy();
    await fireEvent.press(boton(PAGAR));
    expect(await screen.findByText('Recarga en camino')).toBeTruthy();
    expect(firma).toHaveBeenCalledTimes(1);
    expect(firma.mock.calls[0][2]).toEqual({
      titulo: 'Confirma tu recarga',
      subtitulo: 'Pagas 50,00 Bs y recibes 50,00 URC',
    });
  });

  it('CA-2: cancelar el diálogo no envía nada, avisa y el botón vuelve a reposo', async () => {
    firma.mockRejectedValueOnce(new ErrorKeystore('BIOMETRIA_CANCELADA'));
    const { llamadas } = await abrirConfirmacion();
    await fireEvent.press(boton(PAGAR));
    expect(await screen.findByText('No se confirmó el pago.')).toBeTruthy();
    expect(confirmaciones(llamadas)).toBe(0);
    expect(boton(PAGAR).props.accessibilityState).toMatchObject({
      busy: false,
      disabled: false,
    });
    // RN-3: el reintento pide otra huella.
    await fireEvent.press(boton(PAGAR));
    expect(await screen.findByText('Recarga en camino')).toBeTruthy();
    expect(firma).toHaveBeenCalledTimes(2);
  });

  it('RN-5: con la huella bloqueada por el sistema no se envía nada ni se ofrece otro camino', async () => {
    firma.mockRejectedValue(new ErrorKeystore('BIOMETRIA_BLOQUEADA'));
    const { llamadas } = await abrirConfirmacion();
    await fireEvent.press(boton(PAGAR));
    expect(
      await screen.findByText(/bloqueó la huella por demasiados intentos/),
    ).toBeTruthy();
    expect(confirmaciones(llamadas)).toBe(0);
    expect(
      screen.getAllByRole('button').map((b) => b.props.accessibilityLabel),
    ).not.toContain('Confirmar mi identidad');
  });

  it('CA-8: sin huella registrada explica dónde agregarla y no ofrece otra forma de confirmar', async () => {
    firma.mockRejectedValue(new ErrorKeystore('SIN_BIOMETRIA'));
    const { llamadas } = await abrirConfirmacion();
    await fireEvent.press(boton(PAGAR));
    expect(
      await screen.findByText(
        'Tu teléfono no tiene ninguna huella o rostro registrado. Agrega uno en los ajustes de tu teléfono.',
      ),
    ).toBeTruthy();
    expect(confirmaciones(llamadas)).toBe(0);
    const etiquetas = screen
      .getAllByRole('button')
      .map((b) => String(b.props.accessibilityLabel));
    expect(etiquetas.filter((e) => /PIN|contraseña|patrón/i.test(e))).toEqual(
      [],
    );
  });

  it('CA-9: firmada y sin respuesta del servidor dice «Confirmando…», nunca el resultado', async () => {
    await abrirConfirmacion();
    const real = globalThis.fetch;
    let soltar: () => void = () => undefined;
    globalThis.fetch = jest.fn((url: string, init?: RequestInit) =>
      String(url).endsWith('/confirmar')
        ? new Promise((resolver) => {
            soltar = () => resolver(real(url, init));
          })
        : real(url, init),
    ) as unknown as typeof fetch;
    await fireEvent.press(boton(PAGAR));
    const ocupado = await screen.findByRole('button', {
      name: 'Confirmando…',
    });
    expect(ocupado.props.accessibilityState).toMatchObject({ busy: true });
    expect(screen.queryByText('Recarga en camino')).toBeNull();
    expect(screen.queryByText('Recarga acreditada')).toBeNull();
    // Un segundo toque mientras espera no pide otra huella.
    await fireEvent.press(ocupado);
    expect(firma).toHaveBeenCalledTimes(1);
    soltar();
    expect(await screen.findByText('Recarga en camino')).toBeTruthy();
  });
});

describe('HU-29 · textos de cada acción', () => {
  it('el diálogo de publicar nombra el precio por asiento y el de crear la billetera, la acción', () => {
    expect(dialogoDe('publicar', '12.00')).toEqual({
      titulo: 'Confirma la publicación de tu viaje',
      subtitulo: '12,00 URC por asiento',
    });
    expect(dialogoDe('crear_billetera').titulo).toBe(
      'Confirma la creación de tu billetera',
    );
  });

  it('las fallas de firma se explican igual en toda acción; las de la acción quedan para su pantalla', () => {
    expect(
      fallaDeFirma(new ErrorKeystore('BIOMETRIA_CANCELADA'), 'publicar'),
    ).toEqual({
      texto: 'No se confirmó la publicación de tu viaje.',
      tono: 'info',
    });
    expect(
      fallaDeFirma(new ErrorKeystore('LLAVE_ANULADA'), 'recarga')?.revincular,
    ).toBe('llave_anulada');
    expect(
      fallaDeFirma(new ErrorApi(401, 'PETICION_EXPIRADA'), 'recarga')?.texto,
    ).toBe('La comprobación de tu teléfono venció. Inténtalo de nuevo.');
    expect(
      fallaDeFirma(new ErrorApi(409, 'ORDEN_EXPIRADA'), 'recarga'),
    ).toBeNull();
  });
});

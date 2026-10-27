import * as AlmacenSeguro from 'expo-secure-store';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000/api/v1';
const CLAVE_REFRESCO = 'uniride.refresco';

/** Error de la API con el `codigo` estable que el cliente traduce con su es-BO. */
export class ErrorApi extends Error {
  readonly estado: number;
  readonly codigo: string;
  readonly datos: Record<string, unknown>;

  constructor(
    estado: number,
    codigo: string,
    datos: Record<string, unknown> = {},
  ) {
    super(codigo);
    this.estado = estado;
    this.codigo = codigo;
    this.datos = datos;
  }
}

export interface Membresia {
  organizacionId: string;
  /** Nombre de la organización, tal como lo devuelve `GET /yo`. */
  organizacion: string;
  rol: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
}

export interface Usuario {
  id: string;
  nombreCompleto: string;
  correo: string;
  rolPlataforma: string | null;
  organizacionActiva: string | null;
  membresias: Membresia[];
}

// El token de acceso vive solo en memoria; el de refresco, en el almacenamiento seguro del sistema.
let tokenAcceso: string | null = null;
let renovando: Promise<boolean> | null = null;

async function enviar(
  ruta: string,
  metodo: string,
  cuerpo?: unknown,
): Promise<Response> {
  try {
    return await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(tokenAcceso ? { Authorization: `Bearer ${tokenAcceso}` } : {}),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION');
  }
}

async function leer<T>(respuesta: Response): Promise<T> {
  if (respuesta.ok) {
    return (respuesta.status === 204 ? undefined : await respuesta.json()) as T;
  }
  const datos = await respuesta.json().catch(() => ({}));
  throw new ErrorApi(
    respuesta.status,
    datos.codigo ?? 'ERROR_DESCONOCIDO',
    datos,
  );
}

async function guardarSesion(r: {
  tokenAcceso: string;
  tokenRefresco: string;
}): Promise<void> {
  tokenAcceso = r.tokenAcceso;
  await AlmacenSeguro.setItemAsync(CLAVE_REFRESCO, r.tokenRefresco);
}

/** Pide un token de acceso nuevo con el refresco guardado; llamadas simultáneas comparten una sola petición. */
export function renovarSesion(): Promise<boolean> {
  renovando ??= (async () => {
    const tokenRefresco = await AlmacenSeguro.getItemAsync(CLAVE_REFRESCO);
    if (!tokenRefresco) return false;
    const r = await enviar('/autenticacion/refrescar', 'POST', {
      tokenRefresco,
    });
    if (!r.ok) {
      // Refresco rechazado (vencido, revocado o reusado): la sesión local ya no sirve.
      await AlmacenSeguro.deleteItemAsync(CLAVE_REFRESCO);
      return false;
    }
    await guardarSesion(await r.json());
    return true;
  })()
    .catch(() => false)
    .finally(() => {
      renovando = null;
    });
  return renovando;
}

async function solicitar<T>(
  ruta: string,
  metodo: string,
  cuerpo?: unknown,
): Promise<T> {
  let respuesta = await enviar(ruta, metodo, cuerpo);
  if (respuesta.status === 401 && tokenAcceso && (await renovarSesion())) {
    respuesta = await enviar(ruta, metodo, cuerpo);
  }
  return leer<T>(respuesta);
}

export async function iniciarSesion(
  correo: string,
  contrasena: string,
): Promise<void> {
  const r = await leer<{ tokenAcceso: string; tokenRefresco: string }>(
    await enviar('/autenticacion/iniciar-sesion', 'POST', {
      correo,
      contrasena,
      tipoCliente: 'movil',
    }),
  );
  await guardarSesion(r);
}

/** Desde cuándo se puede pedir otro código (ISO 8601). */
export interface EnvioCodigo {
  reenviarEn: string;
}

export interface DatosRegistro {
  nombreCompleto: string;
  correo: string;
  contrasena: string;
  aceptaTratamientoDatos: boolean;
}

/** La organización la decide el servidor por el dominio del correo; el cliente no la envía (A-13). */
export async function registrar(datos: DatosRegistro): Promise<EnvioCodigo> {
  return leer<EnvioCodigo>(
    await enviar('/autenticacion/registro', 'POST', datos),
  );
}

/** Para qué se pidió el código: crear la cuenta o sumar otra organización (HU-07). */
export type PropositoCodigo = 'registro' | 'agregar_organizacion';

export async function reenviarCodigo(
  correo: string,
  proposito: PropositoCodigo = 'registro',
): Promise<EnvioCodigo> {
  return leer<EnvioCodigo>(
    await enviar('/autenticacion/reenviar-codigo', 'POST', {
      correo,
      proposito,
    }),
  );
}

/** Con el código correcto la cuenta queda creada y la sesión iniciada. */
export async function verificarOtp(
  correo: string,
  codigo: string,
): Promise<void> {
  const r = await leer<{ tokenAcceso: string; tokenRefresco: string }>(
    await enviar('/autenticacion/verificar-otp', 'POST', { correo, codigo }),
  );
  await guardarSesion(r);
}

export async function cerrarSesion(): Promise<void> {
  try {
    const tokenRefresco = await AlmacenSeguro.getItemAsync(CLAVE_REFRESCO);
    await solicitar<void>('/autenticacion/cerrar-sesion', 'POST', {
      tokenRefresco: tokenRefresco ?? undefined,
    });
  } finally {
    tokenAcceso = null;
    await AlmacenSeguro.deleteItemAsync(CLAVE_REFRESCO);
  }
}

export const consultarYo = () => solicitar<Usuario>('/yo', 'GET');

/** Pide el código al correo de la otra organización; la organización la decide el servidor por el dominio (A-13). */
export const solicitarOrganizacion = (correo: string) =>
  solicitar<EnvioCodigo>('/membresias', 'POST', { correo });

/** Con el código correcto se crea la membresía: aprobada o pendiente según la organización. */
export const confirmarOrganizacion = (correo: string, codigo: string) =>
  solicitar<{ membresia: Membresia }>('/membresias/confirmar', 'POST', {
    correo,
    codigo,
  });

/** Cambia la organización activa y guarda el token de acceso nuevo; el de refresco no cambia. */
export async function cambiarOrganizacionActiva(
  organizacionId: string,
): Promise<void> {
  const r = await solicitar<{ tokenAcceso: string }>(
    '/yo/organizacion-activa',
    'PUT',
    { organizacionId },
  );
  tokenAcceso = r.tokenAcceso;
}

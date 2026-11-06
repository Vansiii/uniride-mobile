import * as AlmacenSeguro from 'expo-secure-store';
import { cabecerasFirma } from '@/dispositivo/firma';

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
// Dispositivo de la cuenta con sesión; se olvida al cerrarla para no firmar con el de otra persona.
let dispositivoId: string | null = null;

async function enviar(
  ruta: string,
  metodo: string,
  cuerpo?: unknown,
  cabeceras: Record<string, string> = {},
): Promise<Response> {
  // Un formulario multipart lleva su propio Content-Type, con el límite entre partes.
  const formulario = cuerpo instanceof FormData;
  try {
    return await fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: {
        ...(formulario ? {} : { 'Content-Type': 'application/json' }),
        ...(tokenAcceso ? { Authorization: `Bearer ${tokenAcceso}` } : {}),
        ...cabeceras,
      },
      body:
        cuerpo === undefined
          ? undefined
          : formulario
            ? cuerpo
            : JSON.stringify(cuerpo),
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

/** Siempre responde igual, tenga o no cuenta el correo (HU-34 CA-2); no se puede saber cuál fue el caso. */
export async function solicitarRecuperacion(
  correo: string,
): Promise<EnvioCodigo> {
  return leer<EnvioCodigo>(
    await enviar('/autenticacion/recuperar-contrasena', 'POST', { correo }),
  );
}

/** Con el código correcto cambia la contraseña y el servidor cierra todas las sesiones; no inicia sesión. */
export async function restablecerContrasena(
  correo: string,
  codigo: string,
  contrasenaNueva: string,
): Promise<void> {
  return leer<void>(
    await enviar('/autenticacion/restablecer-contrasena', 'POST', {
      correo,
      codigo,
      contrasenaNueva,
    }),
  );
}

export async function cerrarSesion(): Promise<void> {
  try {
    const tokenRefresco = await AlmacenSeguro.getItemAsync(CLAVE_REFRESCO);
    await solicitar<void>('/autenticacion/cerrar-sesion', 'POST', {
      tokenRefresco: tokenRefresco ?? undefined,
    });
  } finally {
    tokenAcceso = null;
    dispositivoId = null;
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

/** Lo que ve el dueño de su vehículo: nunca trae la foto ni su clave (D-20). */
export interface Vehiculo {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  color: string;
  capacidad: number;
}

/** Foto elegida; solo existe en memoria hasta el envío (dato sensible, RN-5). */
export interface FotoVehiculo {
  uri: string;
  /** Tipo que informa el selector; el servidor lo comprueba por los bytes. */
  tipo: string;
  /** En web, el archivo mismo: allí un `uri` no se puede enviar como parte del formulario. */
  archivo?: Blob;
}

export interface DatosVehiculo {
  placa: string;
  marca: string;
  modelo: string;
  color: string;
  capacidad: number;
  aceptaUsoFoto: boolean;
  foto: FotoVehiculo;
}

/** La placa se normaliza en el servidor (CA-3): se envía como la escribió la persona. */
export function registrarVehiculo(datos: DatosVehiculo): Promise<Vehiculo> {
  const formulario = new FormData();
  formulario.append('placa', datos.placa);
  formulario.append('marca', datos.marca);
  formulario.append('modelo', datos.modelo);
  formulario.append('color', datos.color);
  formulario.append('capacidad', String(datos.capacidad));
  formulario.append('aceptaUsoFoto', String(datos.aceptaUsoFoto));
  formulario.append(
    'foto',
    datos.foto.archivo ??
      ({
        uri: datos.foto.uri,
        name: 'foto',
        type: datos.foto.tipo,
      } as unknown as Blob),
  );
  return solicitar<Vehiculo>('/vehiculos', 'POST', formulario);
}

/** `null` si todavía no registró un vehículo (404). */
export async function consultarMiVehiculo(): Promise<Vehiculo | null> {
  try {
    return await solicitar<Vehiculo>('/vehiculos/mio', 'GET');
  } catch (error) {
    if (error instanceof ErrorApi && error.estado === 404) return null;
    throw error;
  }
}

export interface MiDispositivo {
  id: string;
  modelo: string;
  vinculadoEn: string;
  activo: boolean;
}

/** Valor de un solo uso con el que la app pide el token de Play Integrity. */
export const pedirDesafioAtestacion = () =>
  solicitar<{ desafio: string; expiraEn: string }>(
    '/dispositivos/desafio-atestacion',
    'POST',
  );

/** El servidor valida la atestación y guarda solo la llave PÚBLICA; la privada nunca sale del Keystore. */
export async function vincularDispositivo(datos: {
  desafio: string;
  tokenIntegridad: string;
  llavePublicaPem: string;
  modelo: string;
}): Promise<{ id: string; estado: 'vinculado' }> {
  const r = await solicitar<{ id: string; estado: 'vinculado' }>(
    '/dispositivos/vincular',
    'POST',
    datos,
  );
  dispositivoId = r.id;
  return r;
}

/** `null` si todavía no vinculó un teléfono (404). */
export async function consultarMiDispositivo(): Promise<MiDispositivo | null> {
  try {
    const d = await solicitar<MiDispositivo>(
      '/dispositivos/mi-dispositivo',
      'GET',
    );
    dispositivoId = d.id;
    return d;
  } catch (error) {
    if (error instanceof ErrorApi && error.estado === 404) return null;
    throw error;
  }
}

/**
 * Petición sensible (billetera, publicar viaje, reservar, handshakes): lleva la firma del dispositivo (A-08).
 * Cada intento se firma de nuevo: el nonce es de un solo uso y la ventana es de 30 s.
 */
export async function solicitarFirmado<T>(
  ruta: string,
  metodo: string,
  cuerpo?: unknown,
): Promise<T> {
  const id = dispositivoId ?? (await consultarMiDispositivo())?.id;
  if (!id) throw new ErrorApi(0, 'DISPOSITIVO_NO_VINCULADO');
  const url = new URL(`${BASE}${ruta}`);
  const texto = cuerpo === undefined ? '' : JSON.stringify(cuerpo);
  const intentar = async () =>
    enviar(
      ruta,
      metodo,
      cuerpo,
      await cabecerasFirma(id, metodo, url.pathname + url.search, texto),
    );
  let respuesta = await intentar();
  if (respuesta.status === 401 && tokenAcceso && (await renovarSesion()))
    respuesta = await intentar();
  return leer<T>(respuesta);
}

export type EstadoIdentidad =
  | 'no_verificada'
  | 'en_revision'
  | 'verificada'
  | 'rechazada'
  | 'bloqueada_temporal';

/** Único dato de identidad que sale de la API: nunca la foto, el documento ni su hash (HU-08 CA-8). */
export interface EstadoVerificacion {
  estado: EstadoIdentidad;
  verificadoEn: string | null;
  bloqueadoHasta: string | null;
}

/** Carnet tomado en vivo; solo existe en memoria hasta el envío (dato sensible). */
export interface FotoCarnet {
  uri: string;
  tipo: string;
  /** En web, el archivo mismo: allí un `uri` no se puede enviar como parte del formulario. */
  archivo?: Blob;
}

export const consultarEstadoIdentidad = () =>
  solicitar<EstadoVerificacion>('/identidad/estado', 'GET');

/** Abre la sesión de Face Liveness que la app ejecutará antes de enviar la verificación. */
export const crearSesionLiveness = () =>
  solicitar<{ sesionId: string }>('/identidad/liveness-sesion', 'POST');

export function verificarIdentidad(datos: {
  numeroDocumento: string;
  aceptaConsentimiento: boolean;
  sesionId: string;
  fotoCarnet: FotoCarnet;
}): Promise<{ estado: EstadoIdentidad; verificadoEn: string }> {
  const formulario = new FormData();
  formulario.append('numeroDocumento', datos.numeroDocumento);
  formulario.append('aceptaConsentimiento', String(datos.aceptaConsentimiento));
  formulario.append('sesionId', datos.sesionId);
  formulario.append(
    'fotoCarnet',
    datos.fotoCarnet.archivo ??
      ({
        uri: datos.fotoCarnet.uri,
        name: 'carnet',
        type: datos.fotoCarnet.tipo,
      } as unknown as Blob),
  );
  return solicitar('/identidad/verificar', 'POST', formulario);
}

/** Billetera de la persona (HU-12): el saldo es texto tal cual lo envía la API; nunca se convierte a número. */
export interface Billetera {
  id: string;
  direccion: string;
  saldoUrc: string;
  /** `null` fuera de Polygon Amoy (nodo local): no hay enlace que mostrar. */
  exploradorUrl: string | null;
}

/** Lectura firmada: pide la huella. `null` si todavía no tiene billetera (404). */
export async function consultarMiBilletera(): Promise<Billetera | null> {
  try {
    return await solicitarFirmado<Billetera>('/billetera/mia', 'GET');
  } catch (error) {
    if (error instanceof ErrorApi && error.codigo === 'BILLETERA_NO_ENCONTRADA')
      return null;
    throw error;
  }
}

/** Reintento de la creación automática; idempotente: si ya existía devuelve la misma billetera. */
export const crearBilletera = () =>
  solicitarFirmado<Billetera>('/billetera', 'POST');

import * as Location from 'expo-location';
import * as AlmacenSeguro from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import { useSyncExternalStore } from 'react';
import {
  enviarPosiciones,
  ErrorApi,
  type PosicionEncuentro,
} from '@/api/cliente';
import type { RolTrayecto } from '@/dispositivo/keystore';
import { t } from '@/i18n';
import { aPosicion } from '@/servicios/ubicacion';

/**
 * Seguimiento del viaje (HU-23 CA-1, CA-2, CA-12): una sola tarea de ubicación cada 15 s, con servicio en primer plano
 * para seguir con la pantalla apagada, alimenta una cola por ruta. Quien conduce un viaje y va de pasajero en otro
 * tiene dos rutas, cada una firmada con la llave de trayecto de su rol, sin huella. Sin señal la cola espera y se
 * envía con la hora original; un 409 (bajada aceptada, viaje terminado) para esa ruta.
 */
export const TAREA = 'uniride.seguimiento';
export const INTERVALO_MS = 15_000;
const CLAVE = 'uniride.seguimiento';
/** El servidor acepta de 1 a 60 puntos por lote. */
const LOTE = 60;
// ponytail: cola en memoria (plan §7); 6 h de puntos como tope. Persistirla si el teléfono muestra pérdidas.
const TOPE_COLA = 1440;

export interface Seguimiento {
  rol: RolTrayecto;
  /** Viaje (conductor) o reserva (pasajero). */
  id: string;
  llaveTrayectoId: string;
}

export interface EstadoRuta {
  pendientes: number;
  sinConexion: boolean;
  /** La llave dejó de valer (otro teléfono vinculado): los puntos esperan hasta registrar otra. */
  firmaVencida: boolean;
}

interface Entrada extends EstadoRuta {
  seguimiento: Seguimiento;
  cola: PosicionEncuentro[];
}

interface Foto {
  rutas: Record<string, EstadoRuta>;
  /** `false` si Android no dejó arrancar la ubicación en segundo plano. */
  enMarcha: boolean;
}

export const rutaDe = ({ rol, id }: Pick<Seguimiento, 'rol' | 'id'>) =>
  `/${rol === 'conductor' ? 'viajes' : 'reservas'}/${encodeURIComponent(id)}/posiciones`;

const entradas = new Map<string, Entrada>();
let cargado: Promise<void> | null = null;
let enviando: Promise<void> | null = null;
let enMarcha = true;
let foto: Foto = { rutas: {}, enMarcha };
const oyentes = new Set<() => void>();

function publicar() {
  const rutas: Record<string, EstadoRuta> = {};
  for (const [ruta, e] of entradas)
    rutas[ruta] = {
      pendientes: e.cola.length,
      sinConexion: e.sinConexion,
      firmaVencida: e.firmaVencida,
    };
  foto = { rutas, enMarcha };
  oyentes.forEach((o) => o());
}

/** Con la app cerrada, Android despierta la tarea sin memoria: lo activo se lee del almacén seguro. */
function cargar(): Promise<void> {
  cargado ??= AlmacenSeguro.getItemAsync(CLAVE)
    .then((texto) => {
      for (const s of JSON.parse(texto ?? '[]') as Seguimiento[])
        if (!entradas.has(rutaDe(s))) entradas.set(rutaDe(s), nueva(s, []));
    })
    .catch(() => undefined);
  return cargado;
}

const guardar = () =>
  AlmacenSeguro.setItemAsync(
    CLAVE,
    JSON.stringify([...entradas.values()].map((e) => e.seguimiento)),
  ).catch(() => undefined);

const nueva = (
  seguimiento: Seguimiento,
  cola: PosicionEncuentro[],
): Entrada => ({
  seguimiento,
  cola,
  pendientes: cola.length,
  sinConexion: false,
  firmaVencida: false,
});

async function arrancar() {
  try {
    if (!(await Location.hasStartedLocationUpdatesAsync(TAREA)))
      await Location.startLocationUpdatesAsync(TAREA, {
        accuracy: Location.Accuracy.High,
        timeInterval: INTERVALO_MS,
        distanceInterval: 0,
        deferredUpdatesInterval: INTERVALO_MS,
        pausesUpdatesAutomatically: false,
        foregroundService: {
          notificationTitle: t('presencia.trayecto.notificacion_titulo'),
          notificationBody: t('presencia.trayecto.compartiendo'),
          killServiceOnDestroy: false,
        },
      });
    enMarcha = true;
  } catch {
    enMarcha = false;
  }
}

/** Empieza (o sigue, con otra llave) a enviar las posiciones de ese viaje o reserva. Lo ya guardado no se pierde. */
export async function iniciarSeguimiento(s: Seguimiento): Promise<void> {
  await cargar();
  const ruta = rutaDe(s);
  entradas.set(ruta, nueva(s, entradas.get(ruta)?.cola ?? []));
  await guardar();
  await arrancar();
  publicar();
  void enviarCola();
}

/** Tras «Permitir todo el tiempo»: vuelve a pedir la ubicación en segundo plano si hay algo que seguir. */
export async function reanudarSeguimiento(): Promise<void> {
  await cargar();
  if (entradas.size) await arrancar();
  publicar();
}

/** La bajada ya se aceptó o el servidor dijo que no hay más que enviar (CA-12). */
export async function detenerSeguimiento(
  s: Pick<Seguimiento, 'rol' | 'id'>,
): Promise<void> {
  await cargar();
  entradas.delete(rutaDe(s));
  await guardar();
  if (!entradas.size)
    await Location.stopLocationUpdatesAsync(TAREA).catch(() => undefined);
  publicar();
}

/** La llave de trayecto vigente de ese viaje o reserva, para el código de bajada sin otra huella. */
export async function llaveDelSeguimiento(
  s: Pick<Seguimiento, 'rol' | 'id'>,
): Promise<string | null> {
  await cargar();
  return entradas.get(rutaDe(s))?.seguimiento.llaveTrayectoId ?? null;
}

/** Envía lo pendiente, de lo más viejo a lo más nuevo. Antes de la bajada: lo que llega después no se evalúa. */
export function enviarCola(): Promise<void> {
  enviando ??= (async () => {
    try {
      for (const [ruta, e] of [...entradas]) await vaciar(ruta, e);
    } finally {
      enviando = null;
      publicar();
    }
  })();
  return enviando;
}

async function vaciar(ruta: string, e: Entrada) {
  while (e.cola.length) {
    const lote = e.cola.slice(0, LOTE);
    try {
      await enviarPosiciones(
        e.seguimiento.rol,
        e.seguimiento.llaveTrayectoId,
        ruta,
        lote,
      );
      e.cola.splice(0, lote.length);
      e.sinConexion = false;
      e.firmaVencida = false;
    } catch (error) {
      const codigo = error instanceof ErrorApi ? error.codigo : '';
      if (error instanceof ErrorApi && error.estado === 409)
        return detenerSeguimiento(e.seguimiento);
      e.sinConexion = codigo === 'SIN_CONEXION';
      e.firmaVencida = codigo === 'FIRMA_TRAYECTO_INVALIDA';
      return;
    }
  }
}

/** Puntos nuevos del GPS a cada cola activa; exportado para las pruebas. */
export async function alRecibir(lecturas: Location.LocationObject[]) {
  await cargar();
  const puntos = lecturas.map(aPosicion);
  for (const e of entradas.values()) {
    e.cola.push(...puntos);
    e.cola.splice(0, Math.max(0, e.cola.length - TOPE_COLA));
  }
  publicar();
  await enviarCola();
}

// Debe definirse al cargar el módulo: Android la llama también con la app cerrada.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  TAREA,
  async ({ data, error }) => {
    if (!error && data?.locations?.length) await alRecibir(data.locations);
  },
);

// El tercero lo pide el render en servidor de la versión web.
const leerFoto = () => foto;
const suscribir = (oyente: () => void) => {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
};

/** Estado de ese viaje o reserva para la pantalla; `ruta` es `undefined` si ya no se comparte. */
export function useSeguimiento(s: Pick<Seguimiento, 'rol' | 'id'>) {
  const f = useSyncExternalStore(suscribir, leerFoto, leerFoto);
  return { ruta: f.rutas[rutaDe(s)], enMarcha: f.enMarcha };
}

/** Solo para pruebas: vuelve al estado de un arranque. */
export function reiniciarParaPruebas() {
  entradas.clear();
  cargado = null;
  enviando = null;
  enMarcha = true;
  publicar();
}

import { router } from 'expo-router';
import {
  consultarDistanciaConductor,
  consultarMisReservas,
  consultarMisViajes,
  consultarPasajerosDelViaje,
  consultarReserva,
  consultarSaldo,
  type MiViaje,
  type Reserva,
} from '@/api/cliente';
import { viajeAnclado } from '@/componentes/ViajeActivo';
import { formatearDia, formatearHoraLocal } from '@/formato';
import {
  respuestaAyuda,
  respuestaCancelarLista,
  respuestaCancelarNada,
  respuestaCancelarNumeroInvalido,
  respuestaCancelarVistaPrevia,
  respuestaConductor,
  respuestaEstadoConductor,
  respuestaEstadoReserva,
  respuestaProximoViaje,
  respuestaSaldo,
} from './respuestas';

export interface CancelableItem {
  tipo: 'reserva' | 'viaje';
  id: string;
  hora: string;
  destino: string;
  devolucionEstimada?: string;
}

/** Almacena los cancelables activos para responder a la elección "el primero" / "el 2" por voz. */
class EstadoCancelables {
  private lista: CancelableItem[] = [];

  guardar(items: CancelableItem[]) {
    this.lista = items;
  }

  obtener(): CancelableItem[] {
    return this.lista;
  }

  limpiar() {
    this.lista = [];
  }
}

export const cancelablesActivos = new EstadoCancelables();

/** CA-1, CA-2: ejecuta la consulta de saldo y navega a Billetera. */
export async function ejecutarAccionSaldo(
  hablar?: (texto: string) => Promise<void>,
): Promise<string> {
  router.push('/(pestanas)/billetera');
  try {
    const s = await consultarSaldo();
    const mensaje = respuestaSaldo({
      tieneBilletera: true,
      disponible: s.saldoDisponible,
      enGarantia: s.saldoBloqueadoEscrow,
    });
    if (hablar) await hablar(mensaje);
    return mensaje;
  } catch {
    const mensaje = respuestaSaldo({ tieneBilletera: false });
    if (hablar) await hablar(mensaje);
    return mensaje;
  }
}

/** CA-3, CA-4, CA-7: ejecuta la consulta de la ubicación del conductor y navega. */
export async function ejecutarAccionConductor(
  hablar?: (texto: string) => Promise<void>,
): Promise<string> {
  try {
    const [reservas, viajes] = await Promise.all([
      consultarMisReservas().catch(() => []),
      consultarMisViajes().catch(() => []),
    ]);

    const anclado = viajeAnclado(reservas, viajes);

    if (anclado?.reserva && anclado.reserva.estado === 'confirmada') {
      const resId = anclado.reserva.reservaId;
      router.push({
        pathname: '/reserva/[id]',
        params: { id: resId, porVoz: '1' },
      });

      try {
        const dist = await consultarDistanciaConductor(resId);
        const mensaje = respuestaConductor({
          disponible: dist.disponible,
          distanciaM: dist.distanciaM,
          enPuntoDeEncuentro: dist.enPuntoDeEncuentro,
          horaSalida: formatearHoraLocal(anclado.reserva.viaje.fechaHoraSalida),
          origenNombre: anclado.reserva.viaje.origenNombre,
        });
        if (hablar) await hablar(mensaje);
        return mensaje;
      } catch {
        const mensaje = respuestaConductor({
          disponible: false,
          distanciaM: null,
          enPuntoDeEncuentro: false,
          horaSalida: formatearHoraLocal(anclado.reserva.viaje.fechaHoraSalida),
          origenNombre: anclado.reserva.viaje.origenNombre,
        });
        if (hablar) await hablar(mensaje);
        return mensaje;
      }
    }

    if (anclado?.reserva) {
      router.push({
        pathname: '/reserva/[id]',
        params: { id: anclado.reserva.reservaId, porVoz: '1' },
      });
      const mensaje = respuestaEstadoReserva({
        estado: anclado.reserva.estado,
        horaSalida: formatearHoraLocal(anclado.reserva.viaje.fechaHoraSalida),
        origenNombre: anclado.reserva.viaje.origenNombre,
      });
      if (hablar) await hablar(mensaje);
      return mensaje;
    }

    const proximo = buscarProximo(reservas, viajes);
    const mensaje = respuestaProximoViaje(proximo);
    if (hablar) await hablar(mensaje);
    return mensaje;
  } catch {
    const mensaje = respuestaProximoViaje(null);
    if (hablar) await hablar(mensaje);
    return mensaje;
  }
}

/** CA-5, CA-6: ejecuta la consulta del estado del viaje. */
export async function ejecutarAccionEstadoViaje(
  hablar?: (texto: string) => Promise<void>,
): Promise<string> {
  try {
    const [reservas, viajes] = await Promise.all([
      consultarMisReservas().catch(() => []),
      consultarMisViajes().catch(() => []),
    ]);

    const anclado = viajeAnclado(reservas, viajes);

    if (anclado?.viaje) {
      const vId = anclado.viaje.id;
      router.push({
        pathname: '/viajes/[id]',
        params: { id: vId, porVoz: '1' },
      });

      let confirmados = 0;
      let abordados = 0;
      try {
        const pas = await consultarPasajerosDelViaje(vId);
        confirmados = pas.filter((p) => p.estado === 'confirmada').length;
        abordados = pas.filter((p) => p.estado === 'abordada').length;
      } catch {}

      const mensaje = respuestaEstadoConductor({
        horaSalida: formatearHoraLocal(anclado.viaje.fechaHoraSalida),
        confirmados,
        abordados,
      });
      if (hablar) await hablar(mensaje);
      return mensaje;
    }

    if (anclado?.reserva) {
      router.push({
        pathname: '/reserva/[id]',
        params: { id: anclado.reserva.reservaId, porVoz: '1' },
      });
      const mensaje = respuestaEstadoReserva({
        estado: anclado.reserva.estado,
        horaSalida: formatearHoraLocal(anclado.reserva.viaje.fechaHoraSalida),
        origenNombre: anclado.reserva.viaje.origenNombre,
      });
      if (hablar) await hablar(mensaje);
      return mensaje;
    }

    const proximo = buscarProximo(reservas, viajes);
    const mensaje = respuestaProximoViaje(proximo);
    if (hablar) await hablar(mensaje);
    return mensaje;
  } catch {
    const mensaje = respuestaProximoViaje(null);
    if (hablar) await hablar(mensaje);
    return mensaje;
  }
}

/** CA-12: navega a la pantalla de Ayuda y lee la ayuda. */
export async function ejecutarAccionAyuda(
  hablar?: (texto: string) => Promise<void>,
): Promise<string> {
  router.push('/ayuda');
  const mensaje = respuestaAyuda();
  if (hablar) await hablar(mensaje);
  return mensaje;
}

/** CA-8, CA-9, CA-10: proceso de cancelación por voz con confirmación biométrica (HU-20). */
export async function ejecutarAccionCancelar(
  n?: number,
  hablar?: (texto: string) => Promise<void>,
): Promise<{
  tipo: 'nada' | 'confirmar' | 'elegir' | 'repreguntar';
  mensaje: string;
}> {
  try {
    const [reservas, viajes] = await Promise.all([
      consultarMisReservas().catch(() => []),
      consultarMisViajes().catch(() => []),
    ]);

    // RN-7: Cancelables = reservas propias confirmadas + viajes propios publicados/reservados sin abordajes
    const cancelables: CancelableItem[] = [];

    reservas
      .filter((r) => r.estado === 'confirmada')
      .forEach((r) => {
        cancelables.push({
          tipo: 'reserva',
          id: r.reservaId,
          hora: formatearHoraLocal(r.viaje.fechaHoraSalida),
          destino: r.viaje.destinoNombre,
          devolucionEstimada: String(r.monto),
        });
      });

    viajes
      .filter((v) => v.estado === 'publicado' || v.estado === 'reservado')
      .forEach((v) => {
        cancelables.push({
          tipo: 'viaje',
          id: v.id,
          hora: formatearHoraLocal(v.fechaHoraSalida),
          destino: v.destinoNombre,
        });
      });

    // CA-10: nada que cancelar
    if (cancelables.length === 0) {
      cancelablesActivos.limpiar();
      const msg = respuestaCancelarNada();
      if (hablar) await hablar(msg);
      return { tipo: 'nada', mensaje: msg };
    }

    // CA-8: exactamente un cancelable
    if (cancelables.length === 1) {
      cancelablesActivos.limpiar();
      const item = cancelables[0];
      return await abrirConfirmacionCancelacion(item, hablar);
    }

    // CA-9: dos o más cancelables
    if (n !== undefined) {
      if (n < 1 || n > cancelables.length) {
        const msg = respuestaCancelarNumeroInvalido(cancelables.length);
        if (hablar) await hablar(msg);
        return { tipo: 'repreguntar', mensaje: msg };
      }
      cancelablesActivos.limpiar();
      const item = cancelables[n - 1];
      return await abrirConfirmacionCancelacion(item, hablar);
    }

    // Sin número especificado: listar y pedir elección
    cancelablesActivos.guardar(cancelables);
    const msg = respuestaCancelarLista(
      cancelables.map((c) => ({ hora: c.hora, destino: c.destino })),
    );
    if (hablar) await hablar(msg);
    return { tipo: 'elegir', mensaje: msg };
  } catch {
    const msg = respuestaCancelarNada();
    if (hablar) await hablar(msg);
    return { tipo: 'nada', mensaje: msg };
  }
}

async function abrirConfirmacionCancelacion(
  item: CancelableItem,
  hablar?: (texto: string) => Promise<void>,
): Promise<{ tipo: 'confirmar'; mensaje: string }> {
  let devolucion = item.devolucionEstimada ?? '0.00';
  if (item.tipo === 'reserva') {
    try {
      const detalle = await consultarReserva(item.id);
      if (detalle.cancelacion?.montoPasajero) {
        devolucion = detalle.cancelacion.montoPasajero;
      }
    } catch {}
    router.push({
      pathname: '/cancelar',
      params: { reservaId: item.id },
    });
  } else {
    router.push({
      pathname: '/cancelar',
      params: { viajeId: item.id },
    });
  }

  const msg = respuestaCancelarVistaPrevia(devolucion);
  if (hablar) await hablar(msg);
  return { tipo: 'confirmar', mensaje: msg };
}

function buscarProximo(
  reservas: Reserva[],
  viajes: MiViaje[],
  ahora = Date.now(),
): { dia: string; hora: string; destino: string } | null {
  const futuros: { salida: number; destino: string }[] = [];

  reservas
    .filter((r) => r.estado === 'confirmada')
    .forEach((r) => {
      const s = Date.parse(r.viaje.fechaHoraSalida);
      if (s > ahora) {
        futuros.push({ salida: s, destino: r.viaje.destinoNombre });
      }
    });

  viajes
    .filter((v) => v.estado === 'publicado' || v.estado === 'reservado')
    .forEach((v) => {
      const s = Date.parse(v.fechaHoraSalida);
      if (s > ahora) {
        futuros.push({ salida: s, destino: v.destinoNombre });
      }
    });

  if (futuros.length === 0) return null;
  futuros.sort((a, b) => a.salida - b.salida);
  const prox = futuros[0];
  const iso = new Date(prox.salida).toISOString();

  return {
    dia: formatearDia(iso),
    hora: formatearHoraLocal(iso),
    destino: prox.destino,
  };
}

import { formatearMonto } from '../formato';

export function formatoMontoUrc(monto: number | string): string {
  const str = typeof monto === 'number' ? monto.toFixed(2) : monto;
  return formatearMonto(str);
}

export function formatoDistanciaMetros(metros: number): string {
  if (metros >= 1000) {
    const km = Math.round((metros / 1000) * 10) / 10;
    return `${String(km).replace('.', ',')} km`;
  }
  return `${metros} metros`;
}

/** CA-1, CA-2: respuesta sobre el saldo disponible y en garantía. */
export function respuestaSaldo(params: {
  tieneBilletera: boolean;
  disponible?: number | string;
  enGarantia?: number | string;
}): string {
  if (!params.tieneBilletera) {
    return 'Aún no tienes billetera.';
  }
  const disp = formatoMontoUrc(params.disponible ?? '0.00');
  const gar = formatoMontoUrc(params.enGarantia ?? '0.00');
  return `Tienes ${disp} URC disponibles y ${gar} en garantía.`;
}

/** CA-3, CA-4: respuesta sobre la distancia del conductor. */
export function respuestaConductor(params: {
  disponible: boolean;
  distanciaM: number | null;
  enPuntoDeEncuentro: boolean;
  horaSalida?: string;
  origenNombre?: string;
}): string {
  if (!params.disponible) {
    const hora = params.horaSalida ?? 'las 07:00';
    const origen = params.origenNombre ?? 'el punto de encuentro';
    return `Aún no tenemos la ubicación de tu conductor. Tu viaje sale a las ${hora} desde ${origen}.`;
  }

  if (params.enPuntoDeEncuentro || (params.distanciaM !== null && params.distanciaM <= 50)) {
    return 'Tu conductor ya está en el punto de encuentro.';
  }

  const dist = formatoDistanciaMetros(params.distanciaM ?? 0);
  return `Tu conductor está a ${dist} del punto de encuentro.`;
}

/** CA-5, RN-5: respuesta según el estado de la reserva. */
export function respuestaEstadoReserva(params: {
  estado: string;
  horaSalida?: string;
  origenNombre?: string;
  montoDevuelto?: number | string;
}): string {
  switch (params.estado) {
    case 'confirmada': {
      const hora = params.horaSalida ? ` para las ${params.horaSalida}` : '';
      return `Tu reserva está confirmada${hora}.`;
    }
    case 'abordada':
      return 'Estás a bordo. Tu ubicación se comparte cada 15 s.';
    case 'verificada':
      return 'Tu viaje quedó verificado. El pago al conductor está en camino.';
    case 'pagada':
      return 'Tu viaje terminó y quedó pagado.';
    case 'cancelada': {
      if (params.montoDevuelto !== undefined) {
        return `Tu reserva está cancelada. Te devolvimos ${formatoMontoUrc(params.montoDevuelto)} URC.`;
      }
      return 'Tu reserva está cancelada.';
    }
    case 'expirada': {
      if (params.montoDevuelto !== undefined) {
        return `Tu reserva venció porque no se verificó el abordaje. Te devolvimos ${formatoMontoUrc(params.montoDevuelto)} URC.`;
      }
      return 'Tu reserva venció porque no se verificó el abordaje.';
    }
    case 'verificacion_fallida':
      return 'No pudimos verificar tu viaje. Tu dinero sigue en garantía.';
    default:
      return 'Estado de viaje no disponible.';
  }
}

/** CA-6: respuesta para el conductor con viaje en curso o reservado. */
export function respuestaEstadoConductor(params: {
  horaSalida: string;
  confirmados: number;
  abordados: number;
}): string {
  const pasConfirmados =
    params.confirmados === 1
      ? '1 pasajero confirmado'
      : `${params.confirmados} pasajeros confirmados`;
  return `Tu viaje de las ${params.horaSalida} tiene ${pasConfirmados} y ${params.abordados} a bordo.`;
}

/** CA-7: respuesta cuando no hay viaje del momento pero sí próximo o ninguno. */
export function respuestaProximoViaje(proximo: {
  dia: string;
  hora: string;
  destino: string;
} | null): string {
  if (!proximo) {
    return 'No tienes viajes próximos.';
  }
  return `Tu próximo viaje sale ${proximo.dia} a las ${proximo.hora} a ${proximo.destino}.`;
}

/** CA-8: confirmación de cancelación de HU-20. */
export function respuestaCancelarVistaPrevia(montoDevuelto: number | string): string {
  return `Si cancelas ahora te devolvemos ${formatoMontoUrc(montoDevuelto)} URC. Confirma con tu huella.`;
}

const ORDINALES_TEXTO = [
  'primero',
  'segundo',
  'tercero',
  'cuarto',
  'quinto',
  'sexto',
  'séptimo',
  'octavo',
  'noveno',
  'décimo',
];

/** CA-9: lista de viajes cancelables cuando hay 2 o más. */
export function respuestaCancelarLista(
  viajes: { hora: string; destino: string }[],
): string {
  const partes = viajes.map((v, i) => {
    const ord = ORDINALES_TEXTO[i] ?? `número ${i + 1}`;
    return `el ${ord} a las ${v.hora} a ${v.destino}`;
  });
  return `Tienes ${viajes.length} viajes: ${partes.join(', ')}. ¿Cuál cancelo?`;
}

/** CA-10: nada que se pueda cancelar. */
export function respuestaCancelarNada(): string {
  return 'No tienes viajes que se puedan cancelar.';
}

/** CA-9: número de cancelación inválido. */
export function respuestaCancelarNumeroInvalido(total: number): string {
  return `Tienes ${total} viajes cancelables. ¿Cuál cancelo?`;
}

/** CA-12: texto de ayuda con comandos disponibles. */
export function respuestaAyuda(): string {
  return 'Puedes pedirme: buscar un viaje, reservar, tu saldo, dónde está tu conductor, cómo va tu viaje o cancelar tu viaje.';
}


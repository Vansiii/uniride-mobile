import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { consultarReserva, type ReservaDetalle } from '@/api/cliente';
import { formatearMonto } from '@/formato';
import { con, t } from '@/i18n';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';
import { EnlaceExplorador } from './FilaMovimiento';
import { EtiquetaEstado } from './Mensajes';

// ponytail: sondeo fijo mientras el pago no se confirma (el worker del backend corre cada 5 s); un aviso del servidor lo haría inmediato.
export const CONSULTA_PAGO_MS = 5000;

/** Estados de la reserva que ya tienen pago (verificada: en camino; pagada: confirmado). */
export const PAGABLES = new Set<string>(['verificada', 'pagada']);

/**
 * HU-24 CA-1: el pago de una reserva verificada, según el servidor. Conductor: «Recibirás» → «Recibiste»; pasajero:
 * pago al conductor *Pendiente* → *Pagado*. Con el enlace al explorador si la API lo trae. No muestra nada antes de la
 * verificación.
 */
export function EstadoPago({
  reservaId,
  rol,
}: {
  reservaId: string;
  rol: 'conductor' | 'pasajero';
}) {
  const [reserva, setReserva] = useState<ReservaDetalle>();

  // Booleano siempre: un `undefined → false` cambiaría la dependencia y repetiría la consulta al instante.
  const terminado =
    reserva?.pago?.estado === 'confirmado' ||
    reserva?.pago?.estado === 'fallido' ||
    (reserva !== undefined && !PAGABLES.has(reserva.estado));

  useEffect(() => {
    if (terminado) return;
    let vigente = true;
    const leer = () =>
      consultarReserva(reservaId)
        .then((r) => vigente && setReserva(r))
        // Sin conexión se vuelve a preguntar en el siguiente turno.
        .catch(() => undefined);
    void leer();
    const reloj = setInterval(() => void leer(), CONSULTA_PAGO_MS);
    return () => {
      vigente = false;
      clearInterval(reloj);
    };
  }, [reservaId, terminado]);

  if (!reserva || !PAGABLES.has(reserva.estado)) return null;

  const pago = reserva.pago;
  const confirmado = pago?.estado === 'confirmado';
  // RN-1: el conductor recibe el 100 % del pasaje.
  const monto = formatearMonto(pago?.monto ?? reserva.monto);
  const titulo =
    rol === 'pasajero'
      ? 'billetera.pago.al_conductor'
      : confirmado
        ? 'billetera.pago.recibiste'
        : 'billetera.pago.recibiras';

  return (
    <View style={estilos.tarjeta} accessibilityLiveRegion="polite">
      <View style={estilos.fila}>
        <Text style={estilos.titulo}>{con(titulo, { monto })}</Text>
        {confirmado ? (
          <EtiquetaEstado
            dominio="reserva"
            estado="pagada"
            texto={t('billetera.pago.pagado')}
          />
        ) : (
          <EtiquetaEstado
            dominio="movimiento"
            estado={pago?.estado ?? 'pendiente'}
            texto={t(
              `billetera.historial.estado.${pago?.estado ?? 'pendiente'}`,
            )}
          />
        )}
      </View>
      {!pago || pago.estado === 'pendiente' ? (
        <Text style={estilos.secundario}>{t('billetera.pago.pendiente')}</Text>
      ) : null}
      {pago?.exploradorUrl && <EnlaceExplorador url={pago.exploradorUrl} />}
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    alignSelf: 'stretch',
    gap: espacio(2),
    padding: espacio(4),
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
  },
  fila: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacio(2),
  },
  titulo: { ...tipografia.cuerpoEnfasis, color: colores.texto, flexShrink: 1 },
  secundario: { ...tipografia.secundario, color: colores.textoSecundario },
});

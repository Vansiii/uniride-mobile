import { StyleSheet, Text, View } from 'react-native';
import type { Reserva } from '@/api/cliente';
import { formatearDia, formatearHoraLocal, formatearMonto } from '@/formato';
import { con, t } from '@/i18n';
import {
  colores,
  espacio,
  radio,
  sombraTarjeta,
  tipografia,
} from '@/tema/tokens';
import { Toque } from './Animado';
import { EtiquetaEstado } from './Mensajes';
import { Trayecto } from './TarjetaViaje';

/** Una reserva del pasajero: día y hora, estado, trayecto, conductor y lo que está en garantía (HU-19 CA-14). */
export function TarjetaReserva({
  reserva,
  alPresionar,
}: {
  reserva: Reserva;
  alPresionar: () => void;
}) {
  const dia = formatearDia(reserva.viaje.fechaHoraSalida);
  const hora = formatearHoraLocal(reserva.viaje.fechaHoraSalida);
  const monto = formatearMonto(reserva.monto);
  const estado = t(`reservas.estado.${reserva.estado}`);
  return (
    <Toque
      escala={0.97}
      accessibilityRole="button"
      accessibilityLabel={con('reservas.mis_viajes.reserva_accesible', {
        conductor: reserva.viaje.conductor,
        origen: reserva.viaje.origenNombre,
        destino: reserva.viaje.destinoNombre,
        dia,
        hora,
        estado,
        monto,
      })}
      onPress={alPresionar}
      style={estilos.tarjeta}
    >
      <View style={estilos.cabecera}>
        <Text style={estilos.hora}>
          {dia} · {hora}
        </Text>
        <EtiquetaEstado
          dominio="reserva"
          estado={reserva.estado}
          texto={estado}
        />
      </View>
      <Trayecto
        origen={reserva.viaje.origenNombre}
        destino={reserva.viaje.destinoNombre}
      />
      <View style={estilos.cabecera}>
        <Text style={estilos.secundario}>{reserva.viaje.conductor}</Text>
        <Text style={estilos.enfasis}>
          {monto} {t('billetera.pantalla.unidad')}
        </Text>
      </View>
    </Toque>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    gap: espacio(3),
    padding: espacio(4),
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
    ...sombraTarjeta,
  },
  cabecera: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacio(2),
  },
  hora: { ...tipografia.subtitulo, color: colores.texto },
  enfasis: { ...tipografia.cuerpoEnfasis, color: colores.texto },
  secundario: { ...tipografia.secundario, color: colores.textoSecundario },
});

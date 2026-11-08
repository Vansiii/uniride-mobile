import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ViajeEncontrado } from '@/api/cliente';
import {
  formatearDistancia,
  formatearHoraLocal,
  formatearMonto,
} from '@/formato';
import { con, t } from '@/i18n';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';
import { EtiquetaEstado } from './Mensajes';

export const precioUrc = (precio: number) =>
  `${formatearMonto(precio.toFixed(2))} ${t('billetera.pantalla.unidad')}`;

export const asientosLibres = (cupos: number) =>
  cupos === 1
    ? t('viajes.buscar.asiento_libre')
    : con('viajes.buscar.asientos_libres', { cantidad: cupos });

export const nombreVehiculo = (v: ViajeEncontrado['vehiculo']) =>
  `${v.marca} ${v.modelo} ${v.color}`;

export function Trayecto({
  origen,
  destino,
}: {
  origen: string;
  destino: string;
}) {
  return (
    <View style={estilos.trayecto}>
      <View style={estilos.parada}>
        <View style={[estilos.punto, estilos.puntoOrigen]} />
        <Text style={estilos.lugar}>{origen}</Text>
      </View>
      <View style={estilos.parada}>
        <View style={[estilos.punto, estilos.puntoDestino]} />
        <Text style={estilos.lugar}>{destino}</Text>
      </View>
    </View>
  );
}

/** D-17: sin reseñas se dice «Nuevo», nunca estrellas vacías. */
export function InsigniasConductor({
  conductor,
}: {
  conductor: Pick<ViajeEncontrado['conductor'], 'verificado' | 'esNuevo'>;
}) {
  return (
    <View style={estilos.insignias}>
      {conductor.verificado && (
        <EtiquetaEstado
          dominio="viaje"
          estado="verificado"
          texto={t('viajes.buscar.verificado')}
        />
      )}
      {conductor.esNuevo && (
        <EtiquetaEstado
          dominio="viaje"
          estado="nuevo"
          texto={t('viajes.buscar.nuevo')}
        />
      )}
    </View>
  );
}

export function Avatar({ nombre }: { nombre: string }) {
  return (
    <View style={estilos.avatar}>
      <Text style={estilos.inicial}>{nombre.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

/** Toda la tarjeta lleva al detalle; no reserva: eso mueve dinero (DESIGN_SYSTEM §8.7). La placa va por CA-2. */
export function TarjetaViaje({
  viaje,
  alPresionar,
}: {
  viaje: ViajeEncontrado;
  alPresionar: () => void;
}) {
  const hora = formatearHoraLocal(viaje.fechaHoraSalida);
  const precio = precioUrc(viaje.precioPorAsiento);
  const distancia = formatearDistancia(viaje.distanciaKm);
  const libres = asientosLibres(viaje.cuposDisponibles);
  const vehiculo = nombreVehiculo(viaje.vehiculo);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={con('viajes.buscar.tarjeta_accesible', {
        hora,
        origen: viaje.origenNombre,
        distancia,
        destino: viaje.destinoNombre,
        precio,
        asientos: libres,
        conductor: viaje.conductor.nombre,
        vehiculo,
        placa: viaje.vehiculo.placa,
      })}
      onPress={alPresionar}
      style={({ pressed }) => [
        estilos.tarjeta,
        pressed && { backgroundColor: colores.primarioSuave },
      ]}
    >
      <View style={estilos.cabecera}>
        <Text style={estilos.hora}>{hora}</Text>
        <Text style={estilos.enfasis}>{precio}</Text>
      </View>
      <Trayecto
        origen={con('viajes.buscar.origen_distancia', {
          origen: viaje.origenNombre,
          distancia,
        })}
        destino={viaje.destinoNombre}
      />
      <View style={estilos.pie}>
        <View style={estilos.conductor}>
          <Avatar nombre={viaje.conductor.nombre} />
          <Text style={[estilos.enfasis, estilos.encoge]}>
            {viaje.conductor.nombre}
          </Text>
        </View>
        <InsigniasConductor conductor={viaje.conductor} />
        <View style={estilos.cabecera}>
          <Text style={[estilos.secundario, estilos.encoge]}>
            {vehiculo} · {viaje.vehiculo.placa}
          </Text>
          <Text style={[estilos.secundario, estilos.fijo]}>{libres}</Text>
        </View>
      </View>
    </Pressable>
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
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacio(2),
  },
  hora: { ...tipografia.titulo, color: colores.texto },
  enfasis: { ...tipografia.cuerpoEnfasis, color: colores.texto },
  secundario: { ...tipografia.secundario, color: colores.textoSecundario },
  trayecto: { gap: espacio(1) },
  parada: { flexDirection: 'row', gap: espacio(2) },
  punto: { width: 10, height: 10, marginTop: 7, borderRadius: 5 },
  puntoOrigen: { backgroundColor: colores.primario },
  puntoDestino: { backgroundColor: colores.exito },
  lugar: { ...tipografia.cuerpo, flex: 1, color: colores.texto },
  pie: {
    gap: espacio(2),
    paddingTop: espacio(3),
    borderTopWidth: 1,
    borderTopColor: colores.borde,
  },
  conductor: { flexDirection: 'row', alignItems: 'center', gap: espacio(2) },
  encoge: { flexShrink: 1 },
  fijo: { flexShrink: 0 },
  insignias: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio(1) },
  avatar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radio.completo,
    backgroundColor: colores.primarioSuave,
  },
  inicial: { ...tipografia.etiqueta, color: colores.primarioTexto },
});

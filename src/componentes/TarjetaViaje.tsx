import { StyleSheet, Text, View } from 'react-native';
import type { ViajeEncontrado } from '@/api/cliente';
import {
  formatearDistancia,
  formatearHoraLocal,
  formatearMonto,
} from '@/formato';
import { con, t } from '@/i18n';
import {
  colores,
  espacio,
  radio,
  tipografia,
  sombraTarjeta,
} from '@/tema/tokens';
import { Toque } from './Animado';
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
      <View style={estilos.riel} accessibilityElementsHidden>
        <View style={[estilos.punto, estilos.puntoOrigen]} />
        <View style={estilos.linea} />
        <View style={[estilos.punto, estilos.puntoDestino]} />
      </View>
      <View style={estilos.paradas}>
        <Text style={estilos.lugar}>{origen}</Text>
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
    <Toque
      escala={0.97}
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
      style={estilos.tarjeta}
    >
      <View style={estilos.cabecera}>
        <Text style={estilos.hora}>{hora}</Text>
        <View style={estilos.precio}>
          <Text style={estilos.textoPrecio}>{precio}</Text>
        </View>
      </View>
      <Trayecto
        origen={con('viajes.buscar.origen_distancia', {
          origen: viaje.origenNombre,
          distancia,
        })}
        destino={viaje.destinoNombre}
      />
      <View style={estilos.pie}>
        <View style={estilos.cabecera}>
          <View style={[estilos.conductor, estilos.encoge]}>
            <Avatar nombre={viaje.conductor.nombre} />
            <Text style={[estilos.enfasis, estilos.encoge]} numberOfLines={1}>
              {viaje.conductor.nombre}
            </Text>
          </View>
          <View
            style={[
              estilos.cupos,
              viaje.cuposDisponibles === 1 && estilos.cuposUltimo,
            ]}
          >
            <Text
              style={[
                estilos.textoCupos,
                viaje.cuposDisponibles === 1 && estilos.textoCuposUltimo,
              ]}
            >
              {libres}
            </Text>
          </View>
        </View>
        <InsigniasConductor conductor={viaje.conductor} />
        <Text style={estilos.secundario}>
          {vehiculo} · {viaje.vehiculo.placa}
        </Text>
      </View>
    </Toque>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    gap: espacio(4),
    padding: espacio(4),
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
    ...sombraTarjeta,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacio(2),
  },
  hora: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colores.texto,
  },
  precio: {
    paddingHorizontal: espacio(3),
    paddingVertical: espacio(1),
    borderRadius: radio.completo,
    backgroundColor: colores.primarioSuave,
  },
  textoPrecio: { ...tipografia.cuerpoEnfasis, color: colores.primarioTexto },
  enfasis: { ...tipografia.cuerpoEnfasis, color: colores.texto },
  secundario: { ...tipografia.secundario, color: colores.textoSecundario },
  trayecto: { flexDirection: 'row', gap: espacio(3) },
  riel: { alignItems: 'center', paddingVertical: 6 },
  punto: { width: 10, height: 10, borderRadius: 5 },
  puntoOrigen: { backgroundColor: colores.primario },
  puntoDestino: { backgroundColor: colores.exito },
  linea: {
    flex: 1,
    width: 2,
    marginVertical: 2,
    borderRadius: 1,
    backgroundColor: colores.borde,
  },
  paradas: { flex: 1, gap: espacio(3) },
  lugar: { ...tipografia.cuerpo, color: colores.texto },
  pie: {
    gap: espacio(2),
    paddingTop: espacio(3),
    borderTopWidth: 1,
    borderTopColor: colores.borde,
  },
  conductor: { flexDirection: 'row', alignItems: 'center', gap: espacio(2) },
  encoge: { flexShrink: 1 },
  cupos: {
    flexShrink: 0,
    paddingHorizontal: espacio(2),
    paddingVertical: 2,
    borderRadius: radio.completo,
    backgroundColor: colores.fondoSutil,
  },
  cuposUltimo: { backgroundColor: colores.avisoSuave },
  textoCupos: { ...tipografia.pequeno, color: colores.textoSecundario },
  textoCuposUltimo: { color: colores.avisoTexto },
  insignias: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio(1) },
  avatar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radio.completo,
    backgroundColor: colores.primarioSuave,
  },
  inicial: { ...tipografia.cuerpoEnfasis, color: colores.primarioTexto },
});

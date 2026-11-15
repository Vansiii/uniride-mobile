import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  consultarPasajerosDelViaje,
  MiViaje,
  PasajeroViaje,
} from '@/api/cliente';
import { Esqueleto } from '@/componentes/Animado';
import { Boton } from '@/componentes/Boton';
import { Aviso, EtiquetaEstado } from '@/componentes/Mensajes';
import {
  asientosLibres,
  precioUrc,
  Trayecto,
} from '@/componentes/TarjetaViaje';
import { formatearDia, formatearHoraLocal } from '@/formato';
import { t } from '@/i18n';
import {
  colores,
  espacio,
  radio,
  sombraTarjeta,
  tipografia,
} from '@/tema/tokens';

/**
 * Un viaje que ofrezco (HU-19 CA-14, RN-9): sus asientos, la acción del momento y, a pedido, el nombre de pila y el
 * estado de cada pasajero. En «Mis viajes» y, si es el viaje activo, arriba en Buscar (DESIGN_SYSTEM N7).
 */
export function TarjetaMiViaje({ viaje }: { viaje: MiViaje }) {
  const [pasajeros, setPasajeros] = useState<PasajeroViaje[] | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [falla, setFalla] = useState(false);
  const enCurso = viaje.estado === 'en_curso';

  const alternar = () => {
    if (abierto) return setAbierto(false);
    setAbierto(true);
    setCargando(true);
    setFalla(false);
    consultarPasajerosDelViaje(viaje.id)
      .then(setPasajeros)
      .catch(() => setFalla(true))
      .finally(() => setCargando(false));
  };

  return (
    <View style={estilos.tarjeta}>
      <View style={estilos.cabecera}>
        <Text style={estilos.hora}>
          {formatearDia(viaje.fechaHoraSalida)} ·{' '}
          {formatearHoraLocal(viaje.fechaHoraSalida)}
        </Text>
        <EtiquetaEstado
          dominio="viaje"
          estado={viaje.estado}
          texto={t(`viajes.estado.${viaje.estado}`)}
        />
      </View>
      <Trayecto origen={viaje.origenNombre} destino={viaje.destinoNombre} />
      <View style={estilos.cabecera}>
        <Text style={estilos.secundario}>
          {asientosLibres(viaje.cuposDisponibles)}
        </Text>
        <Text style={estilos.enfasis}>{precioUrc(viaje.precioPorAsiento)}</Text>
      </View>
      {/* HU-23 (N7): en curso, la acción del momento es el viaje (seguimiento y bajada). */}
      {enCurso && (
        <Boton
          icono="near_me"
          etiqueta={t('presencia.trayecto.ver_viaje')}
          alPresionar={() =>
            router.push(`/viaje-activo/${viaje.id}?rol=conductor`)
          }
        />
      )}
      {/* HU-22: con reservas, el conductor muestra el código (en curso, para quien falte subir); la ventana la decide el servidor (CA-11). */}
      {(viaje.estado === 'reservado' || enCurso) && (
        <Boton
          variante={enCurso ? 'secundario' : 'primario'}
          icono="qr_code_2"
          etiqueta={t('reservas.mis_viajes.mostrar_codigo')}
          alPresionar={() => router.push(`/abordaje/mostrar/${viaje.id}`)}
        />
      )}
      <Boton
        variante="secundario"
        icono={abierto ? 'expand_less' : 'expand_more'}
        etiqueta={t(
          abierto
            ? 'reservas.mis_viajes.ocultar_pasajeros'
            : 'reservas.mis_viajes.ver_pasajeros',
        )}
        alPresionar={alternar}
      />
      {abierto && (
        <View style={estilos.pasajeros}>
          {cargando && <Esqueleto alto={44} redondeo={radio.m} />}
          {falla && (
            <Aviso tono="peligro">
              {t('reservas.mis_viajes.pasajeros_error')}
            </Aviso>
          )}
          {pasajeros?.length === 0 && !cargando && (
            <Text style={estilos.secundario}>
              {t('reservas.mis_viajes.sin_pasajeros')}
            </Text>
          )}
          {pasajeros?.map((p) => (
            <View key={p.reservaId} style={estilos.cabecera}>
              <Text style={estilos.enfasis}>{p.nombre}</Text>
              <EtiquetaEstado
                dominio="reserva"
                estado={p.estado}
                texto={t(`reservas.estado.${p.estado}`)}
              />
            </View>
          ))}
        </View>
      )}
    </View>
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
  pasajeros: { gap: espacio(2) },
  hora: { ...tipografia.subtitulo, color: colores.texto },
  enfasis: { ...tipografia.cuerpoEnfasis, color: colores.texto },
  secundario: { ...tipografia.secundario, color: colores.textoSecundario },
});

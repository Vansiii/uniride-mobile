import { Redirect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  consultarMisReservas,
  consultarMisViajes,
  consultarPasajerosDelViaje,
  MiViaje,
  PasajeroViaje,
  Reserva,
} from '@/api/cliente';
import { Entra, Esqueleto } from '@/componentes/Animado';
import { Boton } from '@/componentes/Boton';
import { Aviso, EtiquetaEstado } from '@/componentes/Mensajes';
import { TarjetaReserva } from '@/componentes/TarjetaReserva';
import {
  asientosLibres,
  precioUrc,
  Trayecto,
} from '@/componentes/TarjetaViaje';
import { useSesion } from '@/contexto/sesion';
import { useAlEnfocar } from '@/hooks/useAlEnfocar';
import { formatearDia, formatearHoraLocal } from '@/formato';
import { t } from '@/i18n';
import {
  colores,
  espacio,
  radio,
  sombraTarjeta,
  tipografia,
} from '@/tema/tokens';

/** Un viaje que ofrezco: sus asientos y, a pedido, el nombre de pila y el estado de cada pasajero (HU-19 CA-14, RN-9). */
function ViajePublicado({ viaje }: { viaje: MiViaje }) {
  const [pasajeros, setPasajeros] = useState<PasajeroViaje[] | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [falla, setFalla] = useState(false);

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
      {/* HU-22: con reservas, el conductor muestra el código; la ventana de abordaje la decide el servidor (CA-11). */}
      {(viaje.estado === 'reservado' || viaje.estado === 'en_curso') && (
        <Boton
          icono="qr_code_2"
          etiqueta={t('reservas.mis_viajes.mostrar_codigo')}
          alPresionar={() => router.push(`/abordaje/mostrar/${viaje.id}`)}
        />
      )}
      {/* HU-23: con pasajeros a bordo, el seguimiento y la bajada. */}
      {viaje.estado === 'en_curso' && (
        <Boton
          variante="secundario"
          icono="near_me"
          etiqueta={t('presencia.trayecto.ver_viaje')}
          alPresionar={() =>
            router.push(`/viaje-activo/${viaje.id}?rol=conductor`)
          }
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

/** «Mis viajes» (HU-19 CA-14): lo que reservé como pasajero y lo que ofrezco como conductor. */
export default function MisViajesPantalla() {
  const { usuario } = useSesion();
  // Otra persona nunca ve las reservas que quedaron en memoria de la anterior: se monta de cero.
  return <Contenido key={usuario?.id} />;
}

function Contenido() {
  const { cargando, usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const [reservas, setReservas] = useState<Reserva[]>();
  const [viajes, setViajes] = useState<MiViaje[]>();
  const [falla, setFalla] = useState(false);

  const cargar = useCallback(
    () =>
      Promise.all([consultarMisReservas(), consultarMisViajes()])
        .then(([r, v]) => {
          setReservas(r);
          setViajes(v);
          setFalla(false);
        })
        .catch(() => setFalla(true)),
    [],
  );
  // Las pestañas se quedan montadas: al volver (p. ej. tras reservar) se relee.
  const conSesion = !cargando && Boolean(usuario);
  useAlEnfocar(
    useCallback(() => {
      if (conSesion) void cargar();
    }, [conSesion, cargar]),
  );

  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;

  const vacio = reservas?.length === 0 && viajes?.length === 0;
  return (
    <ScrollView
      style={estilos.raiz}
      contentContainerStyle={[
        estilos.contenido,
        { paddingTop: top + espacio(4) },
      ]}
    >
      <Text style={estilos.titulo} accessibilityRole="header">
        {t('reservas.mis_viajes.titulo')}
      </Text>

      {falla && (
        <>
          <Aviso tono="peligro">{t('reservas.mis_viajes.error')}</Aviso>
          <Boton
            variante="secundario"
            icono="refresh"
            etiqueta={t('comun.acciones.reintentar')}
            alPresionar={() => void cargar()}
          />
        </>
      )}

      {!reservas && !viajes && !falla && (
        <View
          style={estilos.seccion}
          accessibilityLabel={t('comun.estados.cargando')}
        >
          <Esqueleto alto={150} redondeo={radio.l} />
          <Esqueleto alto={150} redondeo={radio.l} />
        </View>
      )}

      {vacio && (
        <Entra style={estilos.vacio}>
          <Text style={estilos.secundario}>
            {t('reservas.mis_viajes.sin_reservas')}
          </Text>
          <Boton
            icono="search"
            etiqueta={t('reservas.mis_viajes.buscar')}
            alPresionar={() => router.push('/')}
          />
          <Boton
            variante="secundario"
            icono="add_circle"
            etiqueta={t('reservas.mis_viajes.publicar')}
            alPresionar={() => router.push('/publicar')}
          />
        </Entra>
      )}

      {reservas && reservas.length > 0 && (
        <View style={estilos.seccion}>
          <Text style={estilos.subtitulo} accessibilityRole="header">
            {t('reservas.mis_viajes.reservas_titulo')}
          </Text>
          {reservas.map((r) => (
            <TarjetaReserva
              key={r.reservaId}
              reserva={r}
              alPresionar={() => router.push(`/reserva/${r.reservaId}`)}
            />
          ))}
        </View>
      )}

      {viajes && viajes.length > 0 && (
        <View style={estilos.seccion}>
          <Text style={estilos.subtitulo} accessibilityRole="header">
            {t('reservas.mis_viajes.publicados_titulo')}
          </Text>
          {viajes.map((v) => (
            <ViajePublicado key={v.id} viaje={v} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondoSutil },
  contenido: { gap: espacio(4), padding: espacio(4), paddingBottom: 120 },
  titulo: { ...tipografia.pantalla, color: colores.texto },
  subtitulo: { ...tipografia.titulo, color: colores.texto },
  seccion: { gap: espacio(3) },
  vacio: { gap: espacio(3), alignItems: 'stretch' },
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

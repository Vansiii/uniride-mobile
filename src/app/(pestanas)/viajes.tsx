import { Redirect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  consultarMisReservas,
  consultarMisViajes,
  MiViaje,
  Reserva,
} from '@/api/cliente';
import { Entra, Esqueleto } from '@/componentes/Animado';
import { Boton } from '@/componentes/Boton';
import { BotonVoz } from '@/componentes/BotonVoz';
import { Aviso } from '@/componentes/Mensajes';
import { PanelVoz } from '@/componentes/PanelVoz';
import { TarjetaMiViaje } from '@/componentes/TarjetaMiViaje';
import { TarjetaReserva } from '@/componentes/TarjetaReserva';
import { TarjetaAnclada, viajeAnclado } from '@/componentes/ViajeActivo';
import { useSesion } from '@/contexto/sesion';
import { useAlEnfocar } from '@/hooks/useAlEnfocar';
import { t } from '@/i18n';
import { useVoz } from '@/voz/useVoz';
import { espacio, radio, tipografia } from '@/tema/tokens';
import { crearEstilos } from '@/tema/useEstilos';

/** «Mis viajes» (HU-19 CA-14): lo que reservé como pasajero y lo que ofrezco como conductor. */
export default function MisViajesPantalla() {
  const { usuario } = useSesion();
  // Otra persona nunca ve las reservas que quedaron en memoria de la anterior: se monta de cero.
  return <Contenido key={usuario?.id} />;
}

function Contenido() {
  const estilos = useEstilos();
  const { cargando, usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const [reservas, setReservas] = useState<Reserva[]>();
  const [viajes, setViajes] = useState<MiViaje[]>();
  const [falla, setFalla] = useState(false);
  const voz = useVoz();

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
  // DESIGN_SYSTEM N7: el viaje del momento va arriba con su acción y no se repite en su lista.
  const anclado = viajeAnclado(reservas ?? [], viajes ?? []);
  const misReservas = reservas?.filter((r) => r !== anclado?.reserva);
  const misViajes = viajes?.filter((v) => v !== anclado?.viaje);
  return (
    <ScrollView
      style={estilos.raiz}
      contentContainerStyle={[
        estilos.contenido,
        { paddingTop: top + espacio(4) },
      ]}
    >
      <View style={estilos.filaEncabezado}>
        <Text style={estilos.titulo} accessibilityRole="header">
          {t('reservas.mis_viajes.titulo')}
        </Text>
        <BotonVoz alPresionar={voz.iniciarEscucha} />
      </View>

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

      {anclado && <TarjetaAnclada anclado={anclado} />}

      {misReservas && misReservas.length > 0 && (
        <View style={estilos.seccion}>
          <Text style={estilos.subtitulo} accessibilityRole="header">
            {t('reservas.mis_viajes.reservas_titulo')}
          </Text>
          {misReservas.map((r) => (
            <TarjetaReserva
              key={r.reservaId}
              reserva={r}
              alPresionar={() => router.push(`/reserva/${r.reservaId}`)}
            />
          ))}
        </View>
      )}

      {misViajes && misViajes.length > 0 && (
        <View style={estilos.seccion}>
          <Text style={estilos.subtitulo} accessibilityRole="header">
            {t('reservas.mis_viajes.publicados_titulo')}
          </Text>
          {misViajes.map((v) => (
            <TarjetaMiViaje key={v.id} viaje={v} />
          ))}
        </View>
      )}
      <PanelVoz
        visible={voz.estado !== 'inactivo'}
        estado={voz.estado}
        transcripcion={voz.transcripcion}
        mensaje={voz.mensaje}
        fallosSeguidos={voz.fallosSeguidos}
        alCerrar={voz.cerrar}
        alReintentar={voz.reintentar}
        alUsarTeclado={voz.cerrar}
      />
    </ScrollView>
  );
}

const useEstilos = crearEstilos((colores) => ({
  raiz: { flex: 1, backgroundColor: colores.fondoSutil },
  contenido: { gap: espacio(4), padding: espacio(4), paddingBottom: 120 },
  filaEncabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titulo: { ...tipografia.pantalla, color: colores.texto },
  subtitulo: { ...tipografia.titulo, color: colores.texto },
  seccion: { gap: espacio(3) },
  vacio: { gap: espacio(3), alignItems: 'stretch' },
  secundario: { ...tipografia.secundario, color: colores.textoSecundario },
}));

import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  consultarDistanciaConductor,
  consultarReserva,
  type DistanciaConductor,
  ErrorApi,
  EstadoReserva,
  ReservaDetalle,
} from '@/api/cliente';
import { Esqueleto } from '@/componentes/Animado';
import { EstadoPago, PAGABLES } from '@/componentes/EstadoPago';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { BotonVoz } from '@/componentes/BotonVoz';
import { ZonaAccion } from '@/componentes/Estructura';
import { Ilustracion } from '@/componentes/Ilustracion';
import { Aviso, EtiquetaEstado } from '@/componentes/Mensajes';
import { PanelVoz } from '@/componentes/PanelVoz';
import { Trayecto } from '@/componentes/TarjetaViaje';
import { AccionDeReserva } from '@/componentes/ViajeActivo';
import { useSesion } from '@/contexto/sesion';
import { formatearDia, formatearHoraLocal, formatearMonto } from '@/formato';
import { con, t } from '@/i18n';
import { formatoDistanciaMetros } from '@/voz/respuestas';
import { useVoz } from '@/voz/useVoz';
import {
  colores,
  espacio,
  radio,
  sombraTarjeta,
  tipografia,
} from '@/tema/tokens';

const TEXTOS: Partial<Record<EstadoReserva, [string, string]>> = {
  pendiente: [
    'reservas.resultado.pendiente_titulo',
    'reservas.resultado.pendiente_texto',
  ],
  confirmada: [
    'reservas.resultado.confirmada_titulo',
    'reservas.resultado.confirmada_texto',
  ],
  fallida: [
    'reservas.resultado.fallida_titulo',
    'reservas.resultado.fallida_texto',
  ],
  cancelada: [
    'reservas.resultado.cancelada_titulo',
    'reservas.resultado.cancelada_texto',
  ],
  expirada: [
    'reservas.resultado.expirada_titulo',
    'reservas.resultado.expirada_texto',
  ],
};

// ponytail: intervalo fijo mientras la reserva está pendiente; la cola del backend reintenta con espera creciente.
const CONSULTA_MS = 3000;
const AVISO_DEMORA_MS = 30_000;

/**
 * Resultado y estado de la reserva (HU-19): Pendiente mientras el pasaje se registra en garantía, Confirmada o
 * «No se completó». Solo el servidor dice el estado; la app lo pregunta cada pocos segundos mientras esté pendiente.
 */
export default function ReservaPantalla() {
  const { cargando, usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reserva, setReserva] = useState<ReservaDetalle | null>(null);
  const [distanciaConductor, setDistanciaConductor] =
    useState<DistanciaConductor | null>(null);
  const [falla, setFalla] = useState<string>();
  const [demorada, setDemorada] = useState(false);
  const voz = useVoz();

  const leer = useCallback(
    () =>
      consultarReserva(id)
        .then((r) => {
          setReserva(r);
          setFalla(undefined);
          if (r.estado === 'confirmada') {
            consultarDistanciaConductor(id)
              .then(setDistanciaConductor)
              .catch(() => setDistanciaConductor(null));
          } else {
            setDistanciaConductor(null);
          }
        })
        .catch((error: unknown) => {
          // Sin conexión no se pierde nada: se vuelve a preguntar. Un rechazo (404, 403) no se arregla solo.
          if (error instanceof ErrorApi && error.codigo === 'SIN_CONEXION')
            return setFalla(t('comun.errores.sin_conexion'));
          setFalla(
            t(
              error instanceof ErrorApi && error.estado === 404
                ? 'reservas.resultado.no_encontrada'
                : 'comun.errores.desconocido',
            ),
          );
        }),
    [id],
  );

  const conSesion = !cargando && Boolean(usuario);
  useEffect(() => {
    if (conSesion) void leer();
  }, [conSesion, leer]);

  // Pendiente: se pregunta de nuevo. Sin conexión también, salvo que la reserva ya no exista.
  const pendiente = reserva?.estado === 'pendiente';
  const reintentable = !reserva && falla === t('comun.errores.sin_conexion');
  useEffect(() => {
    if (!conSesion || !(pendiente || reintentable)) return;
    const reloj = setInterval(() => void leer(), CONSULTA_MS);
    return () => clearInterval(reloj);
  }, [conSesion, pendiente, reintentable, leer]);

  // "Seguimos intentando" es para cuando el nodo falla (RN-7): el camino normal no llega a verlo.
  useEffect(() => {
    if (!pendiente) return;
    const reloj = setTimeout(() => setDemorada(true), AVISO_DEMORA_MS);
    return () => {
      clearTimeout(reloj);
      setDemorada(false);
    };
  }, [pendiente]);

  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;

  const monto = reserva ? formatearMonto(reserva.monto) : '';
  const estado = reserva?.estado;
  // Lo que dice cada estado; los que traen HU-22 a HU-24 solo nombran el estado.
  const [titulo, texto] = (estado && TEXTOS[estado]) ?? [
    'reservas.resultado.titulo',
    'reservas.resultado.otro_estado_texto',
  ];

  return (
    <View style={estilos.raiz}>
      <StatusBar style="dark" />
      <View style={[estilos.barra, { paddingTop: top }]}>
        <BotonIcono
          icono="close"
          etiqueta={t('comun.acciones.cerrar')}
          alPresionar={() => router.replace('/viajes')}
        />
        <BotonVoz alPresionar={voz.iniciarEscucha} />
      </View>

      {!reserva && (
        <View style={estilos.centrado}>
          {falla ? (
            <>
              <Aviso tono="peligro">{falla}</Aviso>
              <Boton
                variante="secundario"
                icono="refresh"
                etiqueta={t('comun.acciones.reintentar')}
                alPresionar={() => void leer()}
              />
            </>
          ) : (
            <View
              style={estilos.esqueletos}
              accessibilityLabel={t('comun.estados.cargando')}
            >
              <Esqueleto alto={140} redondeo={radio.xl} />
              <Esqueleto alto={110} redondeo={radio.l} />
            </View>
          )}
        </View>
      )}

      {reserva && (
        <>
          <ScrollView contentContainerStyle={estilos.contenido}>
            <Ilustracion
              icono={
                estado === 'fallida'
                  ? 'error'
                  : estado === 'pendiente'
                    ? 'hourglass_top'
                    : 'check_circle'
              }
              color={
                estado === 'fallida'
                  ? colores.peligro
                  : estado === 'pendiente'
                    ? colores.primario
                    : colores.exito
              }
            />
            {/* La etiqueta se alinea sola al inicio; envuelta queda centrada. */}
            <View>
              <EtiquetaEstado
                dominio="reserva"
                estado={reserva.estado}
                texto={t(`reservas.estado.${reserva.estado}`)}
              />
            </View>
            <Text style={estilos.titulo} accessibilityRole="header">
              {t(titulo)}
            </Text>
            <Text style={estilos.texto}>
              {con(texto, {
                monto,
                estado: t(`reservas.estado.${reserva.estado}`).toLowerCase(),
              })}
            </Text>
            {pendiente && demorada && (
              <Aviso tono="info">
                {t('reservas.resultado.pendiente_demora')}
              </Aviso>
            )}

            <View style={estilos.tarjeta}>
              <Text style={estilos.subtitulo}>
                {formatearDia(reserva.viaje.fechaHoraSalida)} ·{' '}
                {formatearHoraLocal(reserva.viaje.fechaHoraSalida)}
              </Text>
              <Trayecto
                origen={reserva.viaje.origenNombre}
                destino={reserva.viaje.destinoNombre}
              />
              <View style={estilos.fila}>
                <Text style={estilos.secundario}>
                  {t('reservas.resultado.conductor')}
                </Text>
                <Text style={estilos.enfasis}>{reserva.viaje.conductor}</Text>
              </View>
              {reserva.estado === 'confirmada' && distanciaConductor && (
                <View style={estilos.fila}>
                  <Text style={estilos.secundario}>
                    Ubicación del conductor
                  </Text>
                  <Text style={estilos.enfasis}>
                    {distanciaConductor.disponible
                      ? distanciaConductor.enPuntoDeEncuentro
                        ? 'En el punto de encuentro'
                        : `A ${formatoDistanciaMetros(distanciaConductor.distanciaM ?? 0)}`
                      : 'Sin ubicación reciente'}
                  </Text>
                </View>
              )}
              {/* HU-24: verificada, el pasaje deja la garantía y va al conductor: lo dice EstadoPago. */}
              {!PAGABLES.has(reserva.estado) && (
                <View style={estilos.fila}>
                  <Text style={estilos.secundario}>
                    {t('reservas.resultado.en_garantia')}
                  </Text>
                  <Text style={estilos.enfasis}>
                    {monto} {t('billetera.pantalla.unidad')}
                  </Text>
                </View>
              )}
            </View>
            {PAGABLES.has(reserva.estado) && (
              <EstadoPago reservaId={id} rol="pasajero" alLeer={setReserva} />
            )}
            {reserva.reembolso && (
              <Aviso
                tono={
                  reserva.reembolso.estado === 'confirmado' ? 'exito' : 'info'
                }
              >
                {t(
                  reserva.reembolso.estado === 'confirmado'
                    ? 'reservas.resultado.reembolso_confirmado'
                    : 'reservas.resultado.reembolso_en_camino',
                )}
                {` (${reserva.reembolso.montoPasajero} URC)`}
              </Aviso>
            )}
            {reserva.exploradorUrl && (
              <Boton
                variante="texto"
                icono="open_in_new"
                etiqueta={t('reservas.resultado.transaccion')}
                alPresionar={() =>
                  void Linking.openURL(reserva.exploradorUrl as string)
                }
              />
            )}
          </ScrollView>
          <ZonaAccion>
            {estado === 'fallida' && (
              <Boton
                anchoCompleto
                icono="refresh"
                etiqueta={t('reservas.resultado.intentar_otra_vez')}
                alPresionar={() =>
                  router.replace(`/viajes/${reserva.viaje.id}`)
                }
              />
            )}
            {/* HU-22: cada pasajero hace su abordaje (RN-7); la ventana la decide el servidor. */}
            {/* HU-23: a bordo, el seguimiento y la bajada. */}
            {reserva && <AccionDeReserva reserva={reserva} anchoCompleto />}
            {/* HU-21: una reserva pagada se califica una vez, dentro de los 7 días. */}
            {estado === 'pagada' && (
              <Boton
                anchoCompleto
                icono="check_circle"
                etiqueta={con('calificaciones.boton', {
                  nombre: reserva.viaje.conductor,
                })}
                alPresionar={() =>
                  router.push(`/calificar/${reserva.reservaId}` as never)
                }
              />
            )}
            {/* HU-20: cancelar reserva confirmada */}
            {estado === 'confirmada' &&
              reserva.cancelacion?.cancelable !== false && (
                <Boton
                  anchoCompleto
                  variante="secundario"
                  icono="cancel"
                  etiqueta={t('reservas.cancelar.boton_confirmar')}
                  alPresionar={() =>
                    router.push(
                      `/cancelar?reservaId=${reserva.reservaId}` as never,
                    )
                  }
                />
              )}
            <Boton
              anchoCompleto
              variante={
                estado === 'fallida' ||
                estado === 'confirmada' ||
                estado === 'abordada'
                  ? 'secundario'
                  : 'primario'
              }
              etiqueta={t('reservas.resultado.ver_mis_viajes')}
              alPresionar={() => router.replace('/viajes')}
            />
          </ZonaAccion>
        </>
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
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondoSutil },
  barra: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacio(2),
  },
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio(3),
    padding: espacio(4),
  },
  esqueletos: { gap: espacio(3), alignSelf: 'stretch' },
  contenido: {
    flexGrow: 1,
    gap: espacio(3),
    alignItems: 'center',
    padding: espacio(6),
  },
  titulo: {
    ...tipografia.pantalla,
    color: colores.texto,
    textAlign: 'center',
  },
  texto: {
    ...tipografia.cuerpo,
    color: colores.textoSecundario,
    textAlign: 'center',
  },
  tarjeta: {
    alignSelf: 'stretch',
    gap: espacio(2),
    padding: espacio(4),
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
    ...sombraTarjeta,
  },
  fila: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacio(2),
  },
  subtitulo: { ...tipografia.subtitulo, color: colores.texto },
  enfasis: { ...tipografia.cuerpoEnfasis, color: colores.texto },
  secundario: { ...tipografia.secundario, color: colores.textoSecundario },
});

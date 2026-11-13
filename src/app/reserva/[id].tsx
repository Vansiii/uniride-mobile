import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  consultarReserva,
  ErrorApi,
  EstadoReserva,
  ReservaDetalle,
} from '@/api/cliente';
import { Esqueleto } from '@/componentes/Animado';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { ZonaAccion } from '@/componentes/Estructura';
import { Ilustracion } from '@/componentes/Ilustracion';
import { Aviso, EtiquetaEstado } from '@/componentes/Mensajes';
import { Trayecto } from '@/componentes/TarjetaViaje';
import { useSesion } from '@/contexto/sesion';
import { formatearDia, formatearHoraLocal, formatearMonto } from '@/formato';
import { con, t } from '@/i18n';
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
  const [falla, setFalla] = useState<string>();
  const [demorada, setDemorada] = useState(false);

  const leer = useCallback(
    () =>
      consultarReserva(id)
        .then((r) => {
          setReserva(r);
          setFalla(undefined);
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
              <View style={estilos.fila}>
                <Text style={estilos.secundario}>
                  {t('reservas.resultado.en_garantia')}
                </Text>
                <Text style={estilos.enfasis}>
                  {monto} {t('billetera.pantalla.unidad')}
                </Text>
              </View>
            </View>
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
            <Boton
              anchoCompleto
              variante={estado === 'fallida' ? 'secundario' : 'primario'}
              etiqueta={t('reservas.resultado.ver_mis_viajes')}
              alPresionar={() => router.replace('/viajes')}
            />
          </ZonaAccion>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondoSutil },
  barra: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
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

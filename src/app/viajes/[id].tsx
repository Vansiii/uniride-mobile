import { StatusBar } from 'expo-status-bar';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  consultarViaje,
  DetalleViaje,
  ErrorApi,
  viajesEncontrados,
} from '@/api/cliente';
import { Entra, Esqueleto } from '@/componentes/Animado';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { ZonaAccion } from '@/componentes/Estructura';
import { Icono } from '@/componentes/Icono';
import { MapaRuta } from '@/componentes/MapaRuta';
import { Aviso, EtiquetaEstado } from '@/componentes/Mensajes';
import {
  Avatar,
  InsigniasConductor,
  nombreVehiculo,
  precioUrc,
  Trayecto,
} from '@/componentes/TarjetaViaje';
import { useSesion } from '@/contexto/sesion';
import {
  formatearDia,
  formatearDistancia,
  formatearHoraLocal,
} from '@/formato';
import { con, t } from '@/i18n';
import {
  colores,
  espacio,
  radio,
  tipografia,
  sombraTarjeta,
} from '@/tema/tokens';

/** Detalle del viaje (HU-18): solo nombre de pila y datos públicos del vehículo (RN-4). Reservar llega con HU-19. */
export default function DetalleViajePantalla() {
  const { cargando, usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [viaje, setViaje] = useState<DetalleViaje | null>(null);
  // Por un enlace o tras la búsqueda se puede llegar a uno cancelado, en curso o que ya salió.
  const [disponible, setDisponible] = useState(true);
  const [falla, setFalla] = useState<string>();
  // Distancia e insignias vienen solo en la búsqueda; si se llegó por otro camino, no se muestran.
  const encontrado = viajesEncontrados.get(id);

  const leer = useCallback(
    () =>
      consultarViaje(id)
        .then((v) => {
          setViaje(v);
          setDisponible(
            ['publicado', 'reservado'].includes(v.estado) &&
              Date.parse(v.fechaHoraSalida) > Date.now(),
          );
        })
        .catch((error: unknown) => {
          const codigo = error instanceof ErrorApi ? error.codigo : '';
          setFalla(
            t(
              codigo === 'VIAJE_NO_ENCONTRADO'
                ? 'viajes.buscar.no_encontrado'
                : codigo === 'NO_AUTORIZADO'
                  ? 'viajes.buscar.sin_membresia'
                  : codigo === 'SIN_CONEXION'
                    ? 'comun.errores.sin_conexion'
                    : 'comun.errores.desconocido',
            ),
          );
        }),
    [id],
  );

  // Al entrar por un enlace la sesión todavía se está restaurando: sin token la API respondería 401.
  const conSesion = !cargando && Boolean(usuario);
  useEffect(() => {
    if (conSesion) void leer();
  }, [conSesion, leer]);

  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;

  return (
    <View style={estilos.raiz}>
      <StatusBar style="dark" />
      <View style={[estilos.encabezado, { paddingTop: top + espacio(2) }]}>
        <View style={estilos.botonVolver}>
          <BotonIcono
            icono="arrow_back"
            etiqueta={t('comun.acciones.volver')}
            color={colores.texto}
            alPresionar={() => router.back()}
          />
        </View>
        <Text style={estilos.titulo} accessibilityRole="header">
          {t('viajes.buscar.titulo_detalle')}
        </Text>
      </View>

      {!viaje && (
        <View style={estilos.centrado}>
          {falla ? (
            <>
              <Aviso tono="peligro">{falla}</Aviso>
              <Boton
                variante="secundario"
                icono="refresh"
                etiqueta={t('comun.acciones.reintentar')}
                alPresionar={() => {
                  setFalla(undefined);
                  void leer();
                }}
              />
            </>
          ) : (
            <View
              style={estilos.esqueletos}
              accessibilityLabel={t('comun.estados.cargando')}
            >
              <Esqueleto alto={220} redondeo={radio.xl} />
              <Esqueleto alto={110} redondeo={radio.l} />
              <Esqueleto alto={110} redondeo={radio.l} />
            </View>
          )}
        </View>
      )}

      {viaje && (
        <>
          <ScrollView
            contentContainerStyle={estilos.contenido}
            showsVerticalScrollIndicator={false}
          >
            <View style={estilos.portada}>
              <MapaRuta
                origen={viaje.origen}
                destino={viaje.destino}
                alto={300}
                redondeo={0}
              />
            </View>
            <View style={estilos.hoja}>
              {!disponible && (
                <Aviso tono="info">{t('viajes.buscar.no_encontrado')}</Aviso>
              )}
              <Entra indice={0} style={estilos.tarjeta}>
                <View style={estilos.fila}>
                  <Text style={estilos.subtitulo}>
                    {formatearDia(viaje.fechaHoraSalida)} ·{' '}
                    {formatearHoraLocal(viaje.fechaHoraSalida)}
                  </Text>
                  {encontrado && (
                    <EtiquetaEstado
                      dominio="viaje"
                      estado="distancia"
                      texto={formatearDistancia(encontrado.distanciaKm)}
                    />
                  )}
                </View>
                <Trayecto
                  origen={viaje.origen.nombre}
                  destino={viaje.destino.nombre}
                />
              </Entra>

              <Entra indice={1} style={estilos.tarjeta}>
                <View style={estilos.conductor}>
                  <Avatar nombre={viaje.conductor.nombre} />
                  <Text style={[estilos.enfasis, estilos.encoge]}>
                    {viaje.conductor.nombre}
                  </Text>
                </View>
                {encontrado && (
                  <InsigniasConductor conductor={encontrado.conductor} />
                )}
                <View style={estilos.conductor}>
                  <View style={estilos.baldosa}>
                    <Icono nombre="directions_car" color={colores.primario} />
                  </View>
                  <View style={estilos.encoge}>
                    <Text style={estilos.enfasis}>
                      {nombreVehiculo(viaje.vehiculo)}
                    </Text>
                    <Text style={estilos.secundario}>
                      {viaje.vehiculo.placa}
                    </Text>
                  </View>
                </View>
              </Entra>

              <Entra indice={2} style={estilos.tarjeta}>
                <View style={estilos.fila}>
                  <Text style={estilos.secundario}>
                    {t('viajes.buscar.precio_asiento')}
                  </Text>
                  <Text style={estilos.precio}>
                    {precioUrc(viaje.precioPorAsiento)}
                  </Text>
                </View>
                <View style={estilos.fila}>
                  <Text style={estilos.secundario}>
                    {t('viajes.buscar.disponibles')}
                  </Text>
                  <Text style={estilos.enfasis}>
                    {con('viajes.buscar.de_total', {
                      libres: viaje.cuposDisponibles,
                      total: viaje.cuposTotales,
                    })}
                  </Text>
                </View>
              </Entra>

              <Entra indice={3}>
                <Aviso tono="info">
                  {con('viajes.buscar.garantia', {
                    conductor: viaje.conductor.nombre,
                  })}
                </Aviso>
              </Entra>
            </View>
          </ScrollView>
          <ZonaAccion>
            <Boton
              anchoCompleto
              deshabilitado
              etiqueta={t('viajes.buscar.reservar_pronto')}
              alPresionar={() => undefined}
            />
          </ZonaAccion>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondoSutil },
  // Flota sobre el mapa de portada.
  encabezado: {
    position: 'absolute',
    zIndex: 2,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(2),
    paddingHorizontal: espacio(3),
  },
  botonVolver: {
    borderRadius: radio.completo,
    backgroundColor: colores.superficie,
    ...sombraTarjeta,
  },
  titulo: {
    ...tipografia.etiqueta,
    paddingHorizontal: espacio(3),
    paddingVertical: espacio(2),
    borderRadius: radio.completo,
    color: colores.texto,
    backgroundColor: colores.superficie,
    overflow: 'hidden',
  },
  esqueletos: {
    gap: espacio(3),
    padding: espacio(4),
    paddingTop: 100,
    alignSelf: 'stretch',
  },
  portada: { height: 300 },
  hoja: {
    gap: espacio(3),
    marginTop: -espacio(7),
    padding: espacio(4),
    borderTopLeftRadius: radio.xl,
    borderTopRightRadius: radio.xl,
    backgroundColor: colores.fondoSutil,
  },
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio(3),
    padding: espacio(4),
  },
  contenido: { paddingBottom: espacio(4) },
  tarjeta: {
    gap: espacio(2),
    padding: espacio(4),
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
    ...sombraTarjeta,
  },
  mapa: {
    overflow: 'hidden',
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    ...sombraTarjeta,
  },
  baldosa: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radio.m,
    backgroundColor: colores.primarioSuave,
  },
  precio: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: colores.primarioTexto,
  },
  fila: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacio(2),
  },
  conductor: { flexDirection: 'row', alignItems: 'center', gap: espacio(2) },
  encoge: { flexShrink: 1 },
  subtitulo: { ...tipografia.subtitulo, color: colores.texto },
  enfasis: { ...tipografia.cuerpoEnfasis, color: colores.texto },
  secundario: { ...tipografia.secundario, color: colores.textoSecundario },
});

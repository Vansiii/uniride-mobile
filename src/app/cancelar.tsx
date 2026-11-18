import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  cancelarReserva,
  cancelarViaje,
  consultarPasajerosDelViaje,
  consultarReserva,
  consultarViaje,
  DetalleViaje,
  ErrorApi,
  PasajeroViaje,
  ReservaCanceladaResultado,
  ReservaDetalle,
  ViajeCanceladoResultado,
} from '@/api/cliente';
import { Esqueleto } from '@/componentes/Animado';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { ZonaAccion } from '@/componentes/Estructura';
import { Ilustracion } from '@/componentes/Ilustracion';
import { Aviso, EtiquetaEstado } from '@/componentes/Mensajes';
import { Trayecto } from '@/componentes/TarjetaViaje';
import { useSesion } from '@/contexto/sesion';
import { ErrorKeystore } from '@/dispositivo/keystore';
import { formatearDia, formatearHoraLocal, formatearMonto } from '@/formato';
import { con, t } from '@/i18n';
import { espacio, radio, sombraTarjeta, tipografia } from '@/tema/tokens';
import { crearEstilos, useColores } from '@/tema/useEstilos';
import { BarraEstado } from '@/componentes/BarraEstado';

export default function CancelarPantalla() {
  const colores = useColores();
  const estilos = useEstilos();
  const { cargando: cargandoSesion, usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const { reservaId, viajeId } = useLocalSearchParams<{
    reservaId?: string;
    viajeId?: string;
  }>();

  // Estados para cancelar reserva (pasajero)
  const [reserva, setReserva] = useState<ReservaDetalle | null>(null);
  const [resultadoReserva, setResultadoReserva] =
    useState<ReservaCanceladaResultado | null>(null);

  // Estados para cancelar viaje (conductor)
  const [viaje, setViaje] = useState<DetalleViaje | null>(null);
  const [pasajeros, setPasajeros] = useState<PasajeroViaje[]>([]);
  const [resultadoViaje, setResultadoViaje] =
    useState<ViajeCanceladoResultado | null>(null);

  const [cargando, setCargando] = useState(true);
  const [cancelando, setCancelando] = useState(false);
  const [aviso, setAviso] = useState<{
    texto: string;
    tono: 'info' | 'peligro' | 'aviso';
  } | null>(null);

  useEffect(() => {
    let cancelado = false;
    if (!cargandoSesion && usuario) {
      (async () => {
        try {
          if (reservaId) {
            const r = await consultarReserva(reservaId);
            if (!cancelado) setReserva(r);
          } else if (viajeId) {
            const [v, p] = await Promise.all([
              consultarViaje(viajeId),
              consultarPasajerosDelViaje(viajeId),
            ]);
            if (!cancelado) {
              setViaje(v);
              setPasajeros(p);
            }
          }
        } catch (err) {
          if (!cancelado) {
            setAviso({
              texto: t(
                err instanceof ErrorApi && err.estado === 404
                  ? reservaId
                    ? 'reservas.resultado.no_encontrada'
                    : 'viajes.detalle.no_encontrado'
                  : 'comun.errores.desconocido',
              ),
              tono: 'peligro',
            });
          }
        } finally {
          if (!cancelado) setCargando(false);
        }
      })();
    }
    return () => {
      cancelado = true;
    };
  }, [cargandoSesion, usuario, reservaId, viajeId]);

  if (cargandoSesion) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;

  // Acción de cancelar reserva con biometría
  const ejecutarCancelarReserva = async () => {
    if (!reserva || !reservaId) return;
    const porcentajeEsperado = reserva.cancelacion?.porcentajePasajero ?? 100;

    setCancelando(true);
    setAviso(null);
    try {
      const res = await cancelarReserva(reservaId, porcentajeEsperado);
      setResultadoReserva(res);
    } catch (err) {
      if (
        err instanceof ErrorKeystore &&
        err.codigo === 'BIOMETRIA_CANCELADA'
      ) {
        setAviso({
          texto: con('comun.biometria.no_confirmado', {
            accion: t('comun.biometria.accion.cancelar_reserva'),
          }),
          tono: 'info',
        });
        return;
      }

      if (
        err instanceof ErrorApi &&
        (err.codigo === 'POLITICA_CAMBIO' ||
          (err.datos as Record<string, unknown>)?.error === 'POLITICA_CAMBIO')
      ) {
        // CA-4: cambió la política entre la vista previa y la confirmación
        const datos = err.datos as Record<string, unknown>;
        const nueva =
          ((datos?.detalles as Record<string, unknown>)?.cancelacion as {
            porcentajePasajero: number;
            montoPasajero: string;
            montoConductor: string;
          }) ??
          (datos?.cancelacion as {
            porcentajePasajero: number;
            montoPasajero: string;
            montoConductor: string;
          });

        if (nueva && reserva) {
          setReserva({
            ...reserva,
            cancelacion: {
              cancelable: true,
              porcentajePasajero: nueva.porcentajePasajero,
              montoPasajero: nueva.montoPasajero,
              montoConductor: nueva.montoConductor,
            },
          });
        }
        setAviso({
          texto: t('reservas.cancelar.politica_cambio'),
          tono: 'aviso',
        });
        return;
      }

      setAviso({
        texto: t(
          err instanceof ErrorApi && err.codigo === 'NO_CANCELABLE'
            ? 'reservas.cancelar.no_cancelable'
            : 'comun.errores.desconocido',
        ),
        tono: 'peligro',
      });
    } finally {
      setCancelando(false);
    }
  };

  // Acción de cancelar viaje con biometría
  const ejecutarCancelarViaje = async () => {
    if (!viajeId) return;

    setCancelando(true);
    setAviso(null);
    try {
      const res = await cancelarViaje(viajeId);
      setResultadoViaje(res);
    } catch (err) {
      if (
        err instanceof ErrorKeystore &&
        err.codigo === 'BIOMETRIA_CANCELADA'
      ) {
        setAviso({
          texto: con('comun.biometria.no_confirmado', {
            accion: t('comun.biometria.accion.cancelar_viaje'),
          }),
          tono: 'info',
        });
        return;
      }

      setAviso({
        texto: t(
          err instanceof ErrorApi && err.codigo === 'NO_CANCELABLE'
            ? 'viajes.cancelar.no_cancelable'
            : 'comun.errores.desconocido',
        ),
        tono: 'peligro',
      });
    } finally {
      setCancelando(false);
    }
  };

  // 1. Vista de éxito de reserva cancelada
  if (resultadoReserva) {
    return (
      <View style={estilos.raiz}>
        <BarraEstado />
        <View style={[estilos.barra, { paddingTop: top }]}>
          <BotonIcono
            icono="close"
            etiqueta={t('comun.acciones.cerrar')}
            alPresionar={() => router.replace('/viajes')}
          />
        </View>
        <ScrollView contentContainerStyle={estilos.contenido}>
          <Ilustracion icono="check_circle" color={colores.exito} />
          <Text style={estilos.titulo} accessibilityRole="header">
            {t('reservas.cancelar.exito_titulo')}
          </Text>
          <Text style={estilos.texto}>
            {t('reservas.cancelar.exito_texto')}
          </Text>
          <View style={estilos.tarjeta}>
            <View style={estilos.fila}>
              <Text style={estilos.secundario}>
                {t('billetera.historial.tipo.reembolso_reserva')}
              </Text>
              <Text style={estilos.enfasis}>
                +{formatearMonto(resultadoReserva.reembolso.montoPasajero)}{' '}
                {t('billetera.pantalla.unidad')}
              </Text>
            </View>
            <EtiquetaEstado
              dominio="movimiento"
              estado={resultadoReserva.reembolso.estado}
              texto={t(
                resultadoReserva.reembolso.estado === 'confirmado'
                  ? 'reservas.resultado.reembolso_confirmado'
                  : 'reservas.resultado.reembolso_en_camino',
              )}
            />
          </View>
        </ScrollView>
        <ZonaAccion>
          <Boton
            anchoCompleto
            etiqueta={t('reservas.cancelar.volver_inicio')}
            alPresionar={() => router.replace('/viajes')}
          />
        </ZonaAccion>
      </View>
    );
  }

  // 2. Vista de éxito de viaje cancelado
  if (resultadoViaje) {
    return (
      <View style={estilos.raiz}>
        <BarraEstado />
        <View style={[estilos.barra, { paddingTop: top }]}>
          <BotonIcono
            icono="close"
            etiqueta={t('comun.acciones.cerrar')}
            alPresionar={() => router.replace('/viajes')}
          />
        </View>
        <ScrollView contentContainerStyle={estilos.contenido}>
          <Ilustracion icono="check_circle" color={colores.exito} />
          <Text style={estilos.titulo} accessibilityRole="header">
            {t('viajes.cancelar.exito_titulo')}
          </Text>
          <Text style={estilos.texto}>{t('viajes.cancelar.exito_texto')}</Text>
          <View style={estilos.tarjeta}>
            <Text style={estilos.enfasis}>
              {con('viajes.cancelar.resumen_pasajeros', {
                total: resultadoViaje.reservasCanceladas,
              })}
            </Text>
          </View>
        </ScrollView>
        <ZonaAccion>
          <Boton
            anchoCompleto
            etiqueta={t('reservas.cancelar.volver_inicio')}
            alPresionar={() => router.replace('/viajes')}
          />
        </ZonaAccion>
      </View>
    );
  }

  return (
    <View style={estilos.raiz}>
      <BarraEstado />
      <View style={[estilos.barra, { paddingTop: top }]}>
        <BotonIcono
          icono="arrow_back"
          etiqueta={t('comun.acciones.volver')}
          alPresionar={() => router.back()}
        />
      </View>

      {cargando && (
        <View style={estilos.centrado}>
          <Esqueleto alto={120} redondeo={radio.xl} />
          <Esqueleto alto={90} redondeo={radio.l} />
        </View>
      )}

      {!cargando && (
        <>
          <ScrollView contentContainerStyle={estilos.contenido}>
            {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

            {/* Cancelación de reserva por pasajero */}
            {reserva && (
              <>
                <Text style={estilos.titulo} accessibilityRole="header">
                  {t('reservas.cancelar.titulo')}
                </Text>
                <Text style={estilos.texto}>
                  {t('reservas.cancelar.intro')}
                </Text>

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
                    <Text style={estilos.enfasis}>
                      {reserva.viaje.conductor}
                    </Text>
                  </View>
                </View>

                {reserva.cancelacion && (
                  <View style={estilos.tarjetaPolitica}>
                    <Text style={estilos.politicaTitulo}>
                      {t('reservas.cancelar.politica_titulo')}
                    </Text>
                    <Text style={estilos.politicaTexto}>
                      {t('reservas.cancelar.politica_texto')}
                    </Text>

                    <View style={estilos.filaMonto}>
                      <Text style={estilos.montoGrande}>
                        {con('reservas.cancelar.devolucion_pasajero', {
                          monto: formatearMonto(
                            reserva.cancelacion.montoPasajero,
                          ),
                        })}
                      </Text>
                    </View>

                    {parseFloat(reserva.cancelacion.montoConductor) > 0 && (
                      <View style={estilos.fila}>
                        <Text style={estilos.secundario}>
                          {con('reservas.cancelar.compensacion_conductor', {
                            monto: formatearMonto(
                              reserva.cancelacion.montoConductor,
                            ),
                          })}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}

            {/* Cancelación de viaje por conductor */}
            {viaje && (
              <>
                <Text style={estilos.titulo} accessibilityRole="header">
                  {t('viajes.cancelar.titulo')}
                </Text>
                <Text style={estilos.texto}>{t('viajes.cancelar.intro')}</Text>

                <View style={estilos.tarjeta}>
                  <Text style={estilos.subtitulo}>
                    {formatearDia(viaje.fechaHoraSalida)} ·{' '}
                    {formatearHoraLocal(viaje.fechaHoraSalida)}
                  </Text>
                  <Trayecto
                    origen={
                      viaje.origen?.nombre ??
                      (viaje as unknown as { origenNombre: string })
                        .origenNombre
                    }
                    destino={
                      viaje.destino?.nombre ??
                      (viaje as unknown as { destinoNombre: string })
                        .destinoNombre
                    }
                  />
                </View>

                <View style={estilos.tarjeta}>
                  <Text style={estilos.enfasis}>
                    {pasajeros.length > 0
                      ? con('viajes.cancelar.resumen_pasajeros', {
                          total: pasajeros.length,
                        })
                      : t('viajes.cancelar.sin_pasajeros')}
                  </Text>
                  {pasajeros.map((p) => (
                    <View key={p.reservaId} style={estilos.fila}>
                      <Text style={estilos.secundario}>{p.nombre}</Text>
                      <EtiquetaEstado
                        dominio="reserva"
                        estado={p.estado}
                        texto={t(`reservas.estado.${p.estado}`)}
                      />
                    </View>
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          <ZonaAccion>
            {reserva && (
              <Boton
                anchoCompleto
                variante="secundario"
                icono="cancel"
                etiqueta={t('reservas.cancelar.boton_confirmar')}
                cargando={cancelando}
                deshabilitado={cancelando}
                alPresionar={() => void ejecutarCancelarReserva()}
              />
            )}
            {viaje && (
              <Boton
                anchoCompleto
                variante="secundario"
                icono="cancel"
                etiqueta={t('viajes.cancelar.boton_confirmar')}
                cargando={cancelando}
                deshabilitado={cancelando}
                alPresionar={() => void ejecutarCancelarViaje()}
              />
            )}
          </ZonaAccion>
        </>
      )}
    </View>
  );
}

const useEstilos = crearEstilos((colores) => ({
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
  contenido: {
    flexGrow: 1,
    gap: espacio(4),
    padding: espacio(4),
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
    gap: espacio(2),
    padding: espacio(4),
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
    ...sombraTarjeta,
  },
  tarjetaPolitica: {
    gap: espacio(2),
    padding: espacio(4),
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.primarioSuave,
    backgroundColor: colores.primarioSuave,
  },
  politicaTitulo: {
    ...tipografia.cuerpoEnfasis,
    color: colores.primarioTexto,
  },
  politicaTexto: {
    ...tipografia.secundario,
    color: colores.primarioTexto,
  },
  filaMonto: {
    marginTop: espacio(2),
    alignItems: 'center',
  },
  montoGrande: {
    ...tipografia.titulo,
    color: colores.primarioTexto,
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
}));

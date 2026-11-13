import { StatusBar } from 'expo-status-bar';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  consultarSaldo,
  consultarViaje,
  DetalleViaje,
  ErrorApi,
  reservarAsiento,
  Saldo,
  viajesEncontrados,
} from '@/api/cliente';
import { Entra, Esqueleto } from '@/componentes/Animado';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { BotonRevincular } from '@/componentes/BotonRevincular';
import { ConfirmacionBiometrica } from '@/componentes/ConfirmacionBiometrica';
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
import { fallaDeFirma, useAccionSensible } from '@/hooks/useAccionSensible';
import { useAlEnfocar } from '@/hooks/useAlEnfocar';
import {
  formatearDia,
  formatearDistancia,
  formatearHoraLocal,
  formatearMonto,
} from '@/formato';
import { con, t } from '@/i18n';
import { nuevaClaveReserva } from '@/viajes/clave';
import {
  colores,
  espacio,
  radio,
  tipografia,
  sombraTarjeta,
} from '@/tema/tokens';

type FallaReserva = {
  texto: string;
  tono: 'info' | 'peligro';
  accion?: 'identidad' | 'vincular' | 'mis_viajes';
  revincular?: 'llave_anulada' | 'sin_llave';
};

const centavos = (monto: string | number) => Math.round(Number(monto) * 100);
const montoDe = (c: number) => formatearMonto((c / 100).toFixed(2));

/** Traduce el error a lo que ve la persona; nunca muestra códigos técnicos (DESIGN_SYSTEM §13.4). */
function fallaDeReserva(error: unknown): FallaReserva {
  const deFirma = fallaDeFirma(error, 'reservar');
  if (deFirma) return deFirma;
  const peligro = (clave: string): FallaReserva => ({
    texto: t(clave),
    tono: 'peligro',
  });
  if (!(error instanceof ErrorApi)) return peligro('viajes.reservar.error');
  switch (error.codigo) {
    case 'SIN_ASIENTOS':
      return peligro('viajes.reservar.sin_asientos');
    case 'VIAJE_PROPIO':
      return { texto: t('viajes.reservar.viaje_propio'), tono: 'info' };
    case 'YA_RESERVADO':
      return {
        texto: t('viajes.reservar.ya_reservado'),
        tono: 'info',
        accion: 'mis_viajes',
      };
    case 'VIAJE_NO_DISPONIBLE':
    case 'CONDUCTOR_SIN_BILLETERA':
    case 'VIAJE_NO_ENCONTRADO':
      return peligro('viajes.reservar.no_disponible');
    case 'IDENTIDAD_NO_VERIFICADA':
    case 'BILLETERA_NO_ENCONTRADA':
      return {
        texto: t('viajes.reservar.identidad_requerida'),
        tono: 'info',
        accion: 'identidad',
      };
    case 'FIRMA_DISPOSITIVO_INVALIDA':
    case 'DISPOSITIVO_NO_VINCULADO':
      return {
        texto: t('viajes.reservar.vincular_requerido'),
        tono: 'info',
        accion: 'vincular',
      };
    case 'CUENTA_SUSPENDIDA':
      return peligro('viajes.reservar.cuenta_suspendida');
    default:
      return peligro('viajes.reservar.error');
  }
}

/** Detalle del viaje (HU-18): solo nombre de pila y datos públicos del vehículo (RN-4). Reservar y pagar es HU-19. */
export default function DetalleViajePantalla() {
  const { cargando, usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [viaje, setViaje] = useState<DetalleViaje | null>(null);
  // Por un enlace o tras la búsqueda se puede llegar a uno cancelado, en curso o que ya salió.
  const [disponible, setDisponible] = useState(true);
  const [falla, setFalla] = useState<string>();
  // HU-19: saldo para mostrar el faltante, falla de la reserva y la clave que hace idempotente el reintento (CA-4).
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [faltanteServidor, setFaltanteServidor] = useState<string>();
  const [fallaReserva, setFallaReserva] = useState<FallaReserva | null>(null);
  const clave = useRef<string | undefined>(undefined);
  const accion = useAccionSensible('reservar');
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

  // Al volver de recargar el saldo se relee: la misma confirmación sigue ahí (CA-2). Sin sesión no se pide nada.
  const leerSaldo = useCallback(
    () =>
      consultarSaldo()
        .then(setSaldo)
        .catch(() => setSaldo(null)),
    [],
  );
  useAlEnfocar(
    useCallback(() => {
      // Lo que dijo el servidor vale hasta que la persona vuelve (de recargar, por ejemplo): entonces se vuelve a mirar.
      setFaltanteServidor(undefined);
      if (conSesion) void leerSaldo();
    }, [conSesion, leerSaldo]),
  );

  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;

  /** Con saldo conocido el faltante sale de aquí; el servidor decide siempre (RN-4: cuenta los bloqueos pendientes). */
  const faltante = viaje
    ? faltanteServidor !== undefined
      ? centavos(faltanteServidor)
      : saldo
        ? Math.max(
            0,
            centavos(viaje.precioPorAsiento) - centavos(saldo.saldoDisponible),
          )
        : 0
    : 0;

  const reservar = async () => {
    if (!viaje || accion.ocupado()) return;
    setFallaReserva(null);
    try {
      clave.current ??= nuevaClaveReserva();
      const miClave = clave.current;
      const creada = await accion.ejecutar(
        (opciones) => reservarAsiento(viaje.id, miClave, opciones),
        viaje.precioPorAsiento.toFixed(2),
      );
      if (creada) router.replace(`/reserva/${creada.reservaId}`);
    } catch (error) {
      if (error instanceof ErrorApi && error.codigo === 'SALDO_INSUFICIENTE') {
        setFaltanteServidor(String(error.datos.faltante ?? '0'));
        return;
      }
      setFallaReserva(fallaDeReserva(error));
      // Otra persona se llevó el asiento o el viaje cambió: se muestra como quedó.
      if (
        error instanceof ErrorApi &&
        ['SIN_ASIENTOS', 'VIAJE_NO_DISPONIBLE'].includes(error.codigo)
      )
        void leer();
    }
  };

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
            {fallaReserva && (
              <Aviso tono={fallaReserva.tono}>{fallaReserva.texto}</Aviso>
            )}
            {fallaReserva?.revincular && (
              <BotonRevincular motivo={fallaReserva.revincular} />
            )}
            {fallaReserva?.accion === 'identidad' && (
              <Boton
                icono="verified_user"
                anchoCompleto
                etiqueta={t('billetera.pantalla.verificar')}
                alPresionar={() => router.push('/identidad')}
              />
            )}
            {fallaReserva?.accion === 'vincular' && (
              <Boton
                icono="smartphone"
                anchoCompleto
                etiqueta={t('billetera.pantalla.vincular')}
                alPresionar={() => router.push('/dispositivo')}
              />
            )}
            {fallaReserva?.accion === 'mis_viajes' && (
              <Boton
                variante="secundario"
                anchoCompleto
                etiqueta={t('viajes.reservar.ver_mis_viajes')}
                alPresionar={() => router.push('/viajes')}
              />
            )}
            {!disponible ? (
              <Boton
                anchoCompleto
                deshabilitado
                etiqueta={t('viajes.reservar.no_disponible_boton')}
                alPresionar={() => undefined}
              />
            ) : faltante > 0 ? (
              <>
                <Aviso tono="aviso">
                  {con('viajes.reservar.faltante', {
                    monto: montoDe(faltante),
                  })}
                </Aviso>
                <Boton
                  anchoCompleto
                  icono="account_balance_wallet"
                  etiqueta={t('viajes.reservar.recargar')}
                  alPresionar={() => router.push('/recargar')}
                />
              </>
            ) : (
              <>
                {saldo && (
                  <View style={estilos.fila}>
                    <Text style={estilos.secundario}>
                      {t('viajes.reservar.saldo_despues')}
                    </Text>
                    <Text style={estilos.enfasis}>
                      {montoDe(
                        centavos(saldo.saldoDisponible) -
                          centavos(viaje.precioPorAsiento),
                      )}{' '}
                      {t('billetera.pantalla.unidad')}
                    </Text>
                  </View>
                )}
                <ConfirmacionBiometrica
                  estado={accion.estado}
                  enviando={t('viajes.reservar.enviando')}
                  etiqueta={con('viajes.reservar.boton', {
                    precio: precioUrc(viaje.precioPorAsiento),
                  })}
                  alConfirmar={() => void reservar()}
                />
              </>
            )}
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

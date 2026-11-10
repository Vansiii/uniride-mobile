import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  type TextInputInstance,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  consultarEstadoIdentidad,
  consultarLimitesViaje,
  consultarMiDispositivo,
  consultarMiVehiculo,
  ErrorApi,
  LimitesViaje,
  publicarViaje,
  Vehiculo,
} from '@/api/cliente';
import { Entra } from '@/componentes/Animado';
import { AjusteHora } from '@/componentes/AjusteHora';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { BandaMarca, ZonaAccion } from '@/componentes/Estructura';
import { Icono } from '@/componentes/Icono';
import { Ilustracion } from '@/componentes/Ilustracion';
import { MapaRuta } from '@/componentes/MapaRuta';
import { BotonRevincular } from '@/componentes/BotonRevincular';
import { Aviso, EtiquetaEstado } from '@/componentes/Mensajes';
import { SelectorFecha } from '@/componentes/SelectorFecha';
import { SelectorLugar } from '@/componentes/SelectorLugar';
import { useSesion } from '@/contexto/sesion';
import { ErrorKeystore, fallaDeLlave } from '@/dispositivo/keystore';
import { formatearDia, formatearHoraLocal, formatearMonto } from '@/formato';
import { con, t } from '@/i18n';
import { Lugar } from '@/servicios/geocoding';
import {
  colores,
  espacio,
  radio,
  tipografia,
  sombraElevada,
  sombraTarjeta,
} from '@/tema/tokens';
import {
  ANTICIPACION_MAXIMA_DIAS,
  escribirHora,
  leerSalida,
  medianoche,
  salidaPorOmision,
} from '@/viajes/salida';

const MINUTO_MS = 60_000;
const DIA_MS = 24 * 60 * MINUTO_MS;
// RN-5: se valida aquí para no gastar una huella en algo que el servidor va a rechazar; decide el servidor.
const ANTICIPACION_MINIMA_MS = 15 * MINUTO_MS;
const CAPACIDAD_MAXIMA = 6;

interface Requisitos {
  vehiculo: Vehiculo | null;
  identidad: boolean;
  dispositivo: boolean;
  limites: LimitesViaje;
}

/** En el orden de la pantalla: el primero con error es adonde se lleva a la persona. */
const CAMPOS = ['origen', 'destino', 'hora', 'precio'] as const;
type CampoFormulario = (typeof CAMPOS)[number];
type Errores = Partial<Record<CampoFormulario, string>>;
const MAXIMO_ERRORES_SIN_AVISO = 2;
/** El rechazo del servidor que se señala en un campo; los demás van en un aviso arriba. */
const CAMPO_DEL_ERROR: Record<string, CampoFormulario> = {
  HORARIO_INVALIDO: 'hora',
  PRECIO_FUERA_DE_RANGO: 'precio',
  LUGARES_IGUALES: 'destino',
};

interface Falla {
  titulo?: string;
  texto: string;
  tono: 'info' | 'peligro';
  vincular?: boolean;
  revincular?: 'llave_anulada' | 'sin_llave';
}

interface Publicado {
  salida: string;
  origen: string;
  destino: string;
  cupos: number;
  precio: number;
  organizacion: string;
}

/** "15" o "12,50": como en el prototipo, sin decimales si no los tiene. */
const urc = (monto: number) =>
  Number.isInteger(monto) ? String(monto) : formatearMonto(monto.toFixed(2));

/** Por omisión, la primera media hora que cumple la anticipación mínima. */
const salidaPublicable = () =>
  salidaPorOmision(Date.now() + ANTICIPACION_MINIMA_MS);

function horarioPermitido(salida: Date) {
  const faltaMs = salida.getTime() - Date.now();
  return (
    faltaMs >= ANTICIPACION_MINIMA_MS &&
    faltaMs <= ANTICIPACION_MAXIMA_DIAS * DIA_MS
  );
}

/** Qué decir de una salida no permitida; si solo le faltan minutos, desde qué hora se puede. */
function errorHorario(salida: Date): string | undefined {
  if (horarioPermitido(salida)) return undefined;
  const ahora = Date.now();
  if (salida.getTime() < ahora || salida.getTime() > ahora + DIA_MS)
    return t('viajes.publicar.horario_invalido');
  // Un minuto de holgura: la hora sugerida debe seguir valiendo cuando termine de escribirla.
  return con('viajes.publicar.horario_pronto', {
    hora: formatearHoraLocal(
      new Date(
        Math.ceil((ahora + ANTICIPACION_MINIMA_MS + MINUTO_MS) / MINUTO_MS) *
          MINUTO_MS,
      ).toISOString(),
    ),
  });
}

function leerPrecio(texto: string, limites: LimitesViaje): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const precio = Number(limpio);
  return precio < limites.precioMinimo || precio > limites.precioMaximo
    ? null
    : precio;
}

/** Publicar viaje (HU-17): los requisitos que faltan (CA-6) o el formulario de una pantalla, firmado con la huella (CA-7). */
export default function PublicarPantalla() {
  const { usuario } = useSesion();
  // Otra persona en la misma pestaña nunca ve lo que quedó en memoria de la anterior: se monta de cero.
  return <Contenido key={usuario?.id} />;
}

function Contenido() {
  const { cargando, usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const [requisitos, setRequisitos] = useState<Requisitos | null>(null);
  const [sinConsulta, setSinConsulta] = useState(false);
  const [suspendida, setSuspendida] = useState(false);
  const [sinMembresia, setSinMembresia] = useState(false);
  const [origen, setOrigen] = useState<Lugar | null>(null);
  const [destino, setDestino] = useState<Lugar | null>(null);
  const [{ fecha, hora }, setSalida] = useState(salidaPublicable);
  const [cupos, setCupos] = useState(1);
  const [precio, setPrecio] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [falla, setFalla] = useState<Falla | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [publicado, setPublicado] = useState<Publicado | null>(null);
  const desplazable = useRef<ScrollViewInstance>(null);
  const posiciones = useRef<Partial<Record<CampoFormulario, number>>>({});
  const entradaOrigen = useRef<TextInputInstance>(null);
  const entradaDestino = useRef<TextInputInstance>(null);
  const entradaHora = useRef<TextInputInstance>(null);
  const entradaPrecio = useRef<TextInputInstance>(null);
  // Dos toques seguidos no piden dos huellas.
  const ocupado = useRef(false);

  const aprobada = Boolean(
    usuario?.membresias.some((m) => m.estado === 'aprobada'),
  );
  const organizacion =
    usuario?.membresias.find(
      (m) => m.organizacionId === usuario.organizacionActiva,
    )?.organizacion ?? '';

  const leer = useCallback(async () => {
    try {
      const [vehiculo, identidad, dispositivo, limites] = await Promise.all([
        consultarMiVehiculo(),
        consultarEstadoIdentidad(),
        consultarMiDispositivo(),
        consultarLimitesViaje(),
      ]);
      setRequisitos({
        vehiculo,
        identidad: identidad.estado === 'verificada',
        dispositivo: Boolean(dispositivo?.activo),
        limites,
      });
      setSinConsulta(false);
      setSuspendida(false);
      setSinMembresia(false);
    } catch (error) {
      if (error instanceof ErrorApi && error.codigo === 'CUENTA_SUSPENDIDA')
        return setSuspendida(true);
      // Aprobada en otra organización, pero ya no en la activa: el servidor respondió, no es la red.
      if (error instanceof ErrorApi && error.codigo === 'NO_AUTORIZADO')
        return setSinMembresia(true);
      // Con datos ya vistos se conservan: el servidor vuelve a decidir al publicar.
      setSinConsulta(true);
    }
  }, []);

  // Al volver de registrar el vehículo o verificarse, o tras cambiar de organización, se ve lo vigente sin perder lo escrito.
  // Un aviso de lo que había fallado ya no vale: quizá se fue a resolverlo.
  useFocusEffect(
    useCallback(() => {
      setFalla(null);
      // La pestaña sigue montada de un día para otro: una fecha que ya pasó no está entre las opciones.
      setSalida((s) =>
        s.fecha < medianoche(new Date()) ? salidaPublicable() : s,
      );
      if (!cargando && aprobada) void leer();
    }, [cargando, aprobada, leer]),
  );

  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;
  if (!aprobada) return <Redirect href="/estado-membresia" />;

  if (publicado) {
    const asientos =
      publicado.cupos === 1
        ? t('viajes.publicar.asiento_opcion_uno')
        : con('viajes.publicar.asiento_opcion', { cantidad: publicado.cupos });
    return (
      <View style={[estilos.raiz, { paddingTop: top }]}>
        <ScrollView contentContainerStyle={estilos.resultado}>
          <Ilustracion icono="check_circle" color={colores.exito} />
          <Text style={estilos.tituloResultado} accessibilityRole="header">
            {t('viajes.publicar.resultado_titulo')}
          </Text>
          <Text style={estilos.textoCentrado}>
            {con('viajes.publicar.resultado_texto', {
              organizacion: publicado.organizacion,
            })}
          </Text>
          <View style={estilos.tarjeta}>
            <View style={estilos.filaResumen}>
              <Text style={estilos.enfasis}>
                {formatearDia(publicado.salida)} ·{' '}
                {formatearHoraLocal(publicado.salida)}
              </Text>
              <EtiquetaEstado
                dominio="viaje"
                estado="publicado"
                texto={t('viajes.publicar.estado_publicado')}
              />
            </View>
            <View style={estilos.parada}>
              <View style={[estilos.punto, estilos.puntoOrigen]} />
              <Text style={estilos.valorParada}>{publicado.origen}</Text>
            </View>
            <View style={estilos.parada}>
              <View style={[estilos.punto, estilos.puntoDestino]} />
              <Text style={estilos.valorParada}>{publicado.destino}</Text>
            </View>
            <Text style={estilos.secundario}>
              {con('viajes.publicar.resultado_resumen', {
                asientos,
                precio: formatearMonto(publicado.precio.toFixed(2)),
              })}
            </Text>
          </View>
        </ScrollView>
        <ZonaAccion enPestanas>
          <Boton
            anchoCompleto
            etiqueta={t('viajes.publicar.listo')}
            alPresionar={() => {
              setPublicado(null);
              setOrigen(null);
              setDestino(null);
              setPrecio('');
              setCupos(1);
              setSalida(salidaPublicable());
            }}
          />
        </ZonaAccion>
      </View>
    );
  }

  // Sin formulario: firmar pide la huella, y el servidor rechazaría la publicación.
  if (suspendida) {
    return (
      <View style={[estilos.centrado, { paddingTop: top }]}>
        <Aviso tono="peligro">{t('viajes.publicar.cuenta_suspendida')}</Aviso>
      </View>
    );
  }

  if (sinMembresia) {
    return (
      <View style={[estilos.centrado, { paddingTop: top }]}>
        <Aviso tono="peligro">
          {t('viajes.publicar.sin_membresia_activa')}
        </Aviso>
        <Boton
          variante="secundario"
          etiqueta={t('viajes.publicar.elegir_organizacion')}
          alPresionar={() => router.push('/organizaciones')}
        />
      </View>
    );
  }

  if (!requisitos) {
    return (
      <View style={[estilos.centrado, { paddingTop: top }]}>
        {sinConsulta ? (
          <>
            <Aviso tono="peligro">{t('comun.errores.sin_conexion')}</Aviso>
            <Boton
              variante="secundario"
              icono="refresh"
              etiqueta={t('comun.acciones.reintentar')}
              alPresionar={() => {
                setSinConsulta(false);
                void leer();
              }}
            />
          </>
        ) : (
          <ActivityIndicator
            color={colores.primario}
            size="large"
            accessibilityLabel={t('comun.estados.cargando')}
          />
        )}
      </View>
    );
  }

  const { vehiculo, identidad, dispositivo, limites } = requisitos;

  // CA-6: la pestaña nunca se oculta; explica qué falta y cómo conseguirlo (DESIGN_SYSTEM §6.1).
  if (!vehiculo || !identidad || !dispositivo) {
    const pasos = [
      {
        clave: 'vehiculo',
        hecho: Boolean(vehiculo),
        ruta: '/vehiculo',
        accion: t('vehiculos.registro.ver'),
        detalleHecho:
          vehiculo &&
          `${vehiculo.marca} ${vehiculo.modelo} · ${vehiculo.placa}`,
      },
      {
        clave: 'identidad',
        hecho: identidad,
        ruta: '/identidad',
        accion: t('identidad.verificacion.ver'),
      },
      {
        clave: 'dispositivo',
        hecho: dispositivo,
        ruta: '/dispositivo',
        accion: t('dispositivo.vinculacion.ver'),
      },
    ] as const;
    const actual = pasos.findIndex((p) => !p.hecho);
    return (
      <View style={estilos.raizSutil}>
        <ScrollView>
          <BandaMarca>
            <Text style={estilos.tituloBanda} accessibilityRole="header">
              {t('viajes.publicar.pestana')}
            </Text>
            <Text style={estilos.textoBanda}>
              {con('viajes.publicar.requisitos_titulo', { organizacion })}
            </Text>
          </BandaMarca>
          <View style={estilos.pasos}>
            {pasos.map((p, i) => (
              <View key={p.clave} style={estilos.paso}>
                {p.hecho ? (
                  <Icono nombre="check_circle" color={colores.exito} />
                ) : (
                  <View style={estilos.numero}>
                    <Text style={estilos.textoNumero}>{i + 1}</Text>
                  </View>
                )}
                <View style={estilos.textosPaso}>
                  <Text style={estilos.enfasis}>
                    {t(
                      `viajes.publicar.requisito_${p.clave}${p.hecho ? '_hecho' : ''}`,
                    )}
                  </Text>
                  <Text style={estilos.secundario}>
                    {p.hecho
                      ? ('detalleHecho' in p && p.detalleHecho) || ''
                      : t(`viajes.publicar.requisito_${p.clave}_texto`)}
                  </Text>
                  {i === actual && (
                    <View style={estilos.accionPaso}>
                      <Boton
                        etiqueta={p.accion}
                        alPresionar={() => router.push(p.ruta)}
                      />
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  const capacidad = vehiculo.capacidad;
  // Si cambió de vehículo, lo elegido nunca pasa de lo que cabe: no se gasta una huella en un rechazo seguro.
  const asientos = Math.min(cupos, capacidad);
  const nombreVehiculo = `${vehiculo.marca} ${vehiculo.modelo}`;

  /** Lleva al campo con error, con foco (DESIGN_SYSTEM §9.2); sin campo, arriba, donde queda el aviso. */
  const irA = (campo?: CampoFormulario) => {
    // En Android, un campo con foco devuelve el desplazamiento hacia él y deja el aviso fuera de la vista.
    if (!campo) Keyboard.dismiss();
    const y = campo ? (posiciones.current[campo] ?? 0) : 0;
    desplazable.current?.scrollTo({ y: Math.max(0, y - espacio(2)) });
    if (campo)
      ({
        origen: entradaOrigen,
        destino: entradaDestino,
        hora: entradaHora,
        precio: entradaPrecio,
      })[campo].current?.focus();
  };
  const ubicar = (campo: CampoFormulario, e: LayoutChangeEvent) => {
    posiciones.current[campo] = e.nativeEvent.layout.y;
  };

  /** Traduce el error a lo que ve la persona; nunca muestra códigos técnicos (DESIGN_SYSTEM §13.4). */
  const atenderError = (error: unknown) => {
    const peligro = (clave: string, titulo?: string) =>
      setFalla({ texto: t(clave), tono: 'peligro', titulo });
    if (error instanceof ErrorKeystore) {
      if (error.codigo === 'BIOMETRIA_CANCELADA')
        return setFalla({
          texto: t('viajes.publicar.biometria_cancelada'),
          tono: 'info',
        });
      const { clave, revincular } = fallaDeLlave(error);
      return setFalla({ texto: t(clave), tono: 'peligro', revincular });
    }
    if (!(error instanceof ErrorApi))
      return peligro('comun.errores.desconocido');
    switch (error.codigo) {
      // Lo que se mostraba ya no vale: se vuelve a leer para no pedir otra huella en vano.
      case 'CUPOS_EXCEDEN_CAPACIDAD':
        void leer();
        return setFalla({
          texto:
            error.datos.maximo === 1
              ? t('viajes.publicar.cupos_exceden_capacidad_uno')
              : con('viajes.publicar.cupos_exceden_capacidad', {
                  maximo: String(error.datos.maximo),
                }),
          tono: 'peligro',
        });
      case 'PRECIO_FUERA_DE_RANGO':
        void leer();
        return setErrores({
          precio: con('viajes.publicar.precio_invalido', {
            minimo: urc(Number(error.datos.minimo)),
            maximo: urc(Number(error.datos.maximo)),
          }),
        });
      case 'HORARIO_INVALIDO':
        return setErrores({ hora: t('viajes.publicar.horario_invalido') });
      case 'LUGARES_IGUALES':
        return setErrores({ destino: t('viajes.publicar.lugares_iguales') });
      case 'VIAJE_SOLAPADO':
        return setFalla({
          titulo: t('viajes.publicar.viaje_solapado_titulo'),
          texto: con('viajes.publicar.viaje_solapado', {
            dia: formatearDia(
              String(error.datos.salidaExistente),
            ).toLowerCase(),
            hora: formatearHoraLocal(String(error.datos.salidaExistente)),
            horas: String(error.datos.margenHoras),
          }),
          tono: 'peligro',
        });
      // CA-6: cambió algo desde que se abrió la pantalla; se vuelve a la lista de lo que falta.
      case 'CUENTA_SUSPENDIDA':
        return setSuspendida(true);
      case 'CONDUCTOR_SIN_VEHICULO':
      case 'IDENTIDAD_NO_VERIFICADA':
      case 'NO_AUTORIZADO':
        void leer();
        return peligro('viajes.publicar.requisito_incompleto');
      case 'FIRMA_DISPOSITIVO_INVALIDA':
      case 'DISPOSITIVO_NO_VINCULADO':
        return setFalla({
          texto: t('viajes.publicar.vincular_requerido'),
          tono: 'info',
          vincular: true,
        });
      case 'PETICION_EXPIRADA':
        return peligro('billetera.pantalla.peticion_expirada');
      case 'SIN_CONEXION':
        return peligro('comun.errores.sin_conexion');
      default:
        return peligro('comun.errores.desconocido');
    }
  };

  const publicar = async () => {
    if (ocupado.current) return;
    const salida = leerSalida(fecha, hora);
    const monto = leerPrecio(precio, limites);
    const lugarRequerido = t('viajes.publicar.lugar_requerido');
    const nuevos: Errores = {
      origen: origen ? undefined : lugarRequerido,
      destino: !destino
        ? lugarRequerido
        : origen?.lat === destino.lat && origen.lng === destino.lng
          ? t('viajes.publicar.lugares_iguales')
          : undefined,
      hora: salida ? errorHorario(salida) : t('viajes.publicar.hora_invalida'),
      precio:
        monto === null
          ? con('viajes.publicar.precio_invalido', {
              minimo: urc(limites.precioMinimo),
              maximo: urc(limites.precioMaximo),
            })
          : undefined,
    };
    setErrores(nuevos);
    setFalla(null);
    if (
      !origen ||
      !destino ||
      !salida ||
      monto === null ||
      Object.values(nuevos).some(Boolean)
    ) {
      if (CAMPOS.filter((c) => nuevos[c]).length > MAXIMO_ERRORES_SIN_AVISO)
        setFalla({
          texto: t('viajes.publicar.varios_errores'),
          tono: 'peligro',
        });
      irA(CAMPOS.find((c) => nuevos[c]));
      return;
    }
    const fechaHoraSalida = salida.toISOString();
    ocupado.current = true;
    setEnviando(true);
    try {
      await publicarViaje({
        origenNombre: origen.nombre,
        origenLat: origen.lat,
        origenLng: origen.lng,
        destinoNombre: destino.nombre,
        destinoLat: destino.lat,
        destinoLng: destino.lng,
        fechaHoraSalida,
        cuposTotales: asientos,
        precioPorAsiento: monto,
      });
      setPublicado({
        salida: fechaHoraSalida,
        origen: origen.nombre,
        destino: destino.nombre,
        cupos: asientos,
        precio: monto,
        organizacion,
      });
    } catch (error) {
      atenderError(error);
      irA(
        error instanceof ErrorApi ? CAMPO_DEL_ERROR[error.codigo] : undefined,
      );
    } finally {
      ocupado.current = false;
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={estilos.raizSutil}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[estilos.encabezado, { paddingTop: top + espacio(3) }]}>
        <Text style={estilos.tituloBarra} accessibilityRole="header">
          {t('viajes.publicar.titulo')}
        </Text>
      </View>
      <ScrollView
        ref={desplazable}
        contentContainerStyle={estilos.contenido}
        keyboardShouldPersistTaps="handled"
      >
        {falla && (
          <Aviso tono={falla.tono} titulo={falla.titulo}>
            {falla.texto}
          </Aviso>
        )}
        {falla?.revincular && <BotonRevincular motivo={falla.revincular} />}
        {falla?.vincular && (
          <Boton
            variante="secundario"
            icono="smartphone"
            etiqueta={t('viajes.publicar.vincular')}
            alPresionar={() => router.push('/dispositivo')}
          />
        )}

        {origen && destino && <MapaRuta origen={origen} destino={destino} />}
        <Entra indice={0} style={estilos.seccion}>
          <Text style={estilos.tituloSeccion} accessibilityRole="header">
            {t('viajes.publicar.seccion_ruta')}
          </Text>
          <View onLayout={(e) => ubicar('origen', e)}>
            <SelectorLugar
              conMapa
              refEntrada={entradaOrigen}
              etiqueta={t('viajes.publicar.origen')}
              lugar={origen}
              error={errores.origen}
              alElegir={(l) => {
                setOrigen(l);
                setErrores((e) => ({ ...e, origen: undefined }));
              }}
            />
          </View>
          <View style={estilos.intercambiar}>
            <BotonIcono
              icono="swap_vert"
              etiqueta={t('viajes.publicar.intercambiar')}
              alPresionar={() => {
                setOrigen(destino);
                setDestino(origen);
                setErrores((e) => ({
                  ...e,
                  origen: undefined,
                  destino: undefined,
                }));
              }}
            />
          </View>
          <View onLayout={(e) => ubicar('destino', e)}>
            <SelectorLugar
              conMapa
              refEntrada={entradaDestino}
              etiqueta={t('viajes.publicar.destino')}
              lugar={destino}
              error={errores.destino}
              alElegir={(l) => {
                setDestino(l);
                setErrores((e) => ({ ...e, destino: undefined }));
              }}
            />
          </View>
        </Entra>

        <Entra indice={1} style={estilos.seccion}>
          <Text style={estilos.tituloSeccion} accessibilityRole="header">
            {t('viajes.publicar.seccion_cuando')}
          </Text>
          <SelectorFecha
            fecha={fecha}
            alElegir={(f) => {
              setSalida((s) => ({ ...s, fecha: f }));
              setErrores((e) => ({ ...e, hora: undefined }));
            }}
          />
          <View onLayout={(e) => ubicar('hora', e)}>
            <Campo
              refEntrada={entradaHora}
              etiqueta={t('viajes.publicar.hora')}
              ayuda={t('viajes.publicar.hora_ayuda')}
              keyboardType="number-pad"
              maxLength={5}
              value={hora}
              onChangeText={(v) => {
                setSalida((s) => ({ ...s, hora: escribirHora(v) }));
                setErrores((e) => ({ ...e, hora: undefined }));
              }}
              error={errores.hora}
            />
            <AjusteHora
              fecha={fecha}
              hora={hora}
              alCambiar={(h) => {
                setSalida((x) => ({ ...x, hora: h }));
                setErrores((e) => ({ ...e, hora: undefined }));
              }}
            />
          </View>
        </Entra>

        <Entra indice={2} style={estilos.seccion}>
          <Text style={estilos.tituloSeccion} accessibilityRole="header">
            {t('viajes.publicar.seccion_precio')}
          </Text>
          <View style={estilos.grupo}>
            <Text style={estilos.etiqueta}>
              {t('viajes.publicar.asientos')}
            </Text>
            <View style={estilos.asientos} accessibilityRole="radiogroup">
              {Array.from({ length: CAPACIDAD_MAXIMA }, (_, i) => i + 1).map(
                (n) => {
                  const disponible = n <= capacidad;
                  const elegido = n === asientos;
                  return (
                    <Pressable
                      key={n}
                      accessibilityRole="radio"
                      accessibilityLabel={
                        n === 1
                          ? t('viajes.publicar.asiento_opcion_uno')
                          : con('viajes.publicar.asiento_opcion', {
                              cantidad: n,
                            })
                      }
                      accessibilityState={{
                        selected: elegido,
                        disabled: !disponible,
                      }}
                      disabled={!disponible}
                      onPress={() => setCupos(n)}
                      style={[
                        estilos.asiento,
                        elegido && estilos.chipElegido,
                        !disponible && estilos.asientoNo,
                      ]}
                    >
                      <Text
                        style={[
                          estilos.textoChip,
                          elegido && estilos.textoChipElegido,
                          !disponible && estilos.textoAsientoNo,
                        ]}
                      >
                        {n}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>
            <Text style={estilos.secundario}>
              {con(
                capacidad === 1
                  ? 'viajes.publicar.asientos_ayuda_uno'
                  : 'viajes.publicar.asientos_ayuda',
                { vehiculo: nombreVehiculo, capacidad },
              )}
            </Text>
          </View>

          <View onLayout={(e) => ubicar('precio', e)}>
            <Campo
              refEntrada={entradaPrecio}
              etiqueta={t('viajes.publicar.precio')}
              ayuda={con('viajes.publicar.precio_ayuda', {
                minimo: urc(limites.precioMinimo),
                maximo: urc(limites.precioMaximo),
                organizacion,
              })}
              keyboardType="decimal-pad"
              value={precio}
              onChangeText={(v) => {
                setPrecio(v);
                setErrores((e) => ({ ...e, precio: undefined }));
              }}
              error={errores.precio}
            />
          </View>
        </Entra>
      </ScrollView>
      <ZonaAccion enPestanas>
        <Boton
          anchoCompleto
          cargando={enviando}
          etiqueta={t(
            enviando
              ? 'viajes.publicar.publicando'
              : 'viajes.publicar.publicar',
          )}
          alPresionar={() => void publicar()}
        />
      </ZonaAccion>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondo },
  raizSutil: { flex: 1, backgroundColor: colores.fondoSutil },
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio(3),
    padding: espacio(4),
    backgroundColor: colores.fondo,
  },
  encabezado: {
    minHeight: 72,
    justifyContent: 'center',
    paddingHorizontal: espacio(4),
    paddingBottom: espacio(2),
  },
  tituloBarra: { ...tipografia.pantalla, color: colores.texto },
  tituloBanda: { ...tipografia.pantalla, color: colores.sobreMarca },
  textoBanda: { ...tipografia.cuerpo, color: colores.sobreMarcaSecundario },
  contenido: {
    flexGrow: 1,
    gap: espacio(4),
    paddingHorizontal: espacio(4),
    paddingBottom: espacio(4),
  },
  intercambiar: { alignItems: 'flex-end', marginVertical: -espacio(3) },
  seccion: {
    gap: espacio(3),
    padding: espacio(4),
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
    ...sombraTarjeta,
  },
  tituloSeccion: { ...tipografia.subtitulo, color: colores.texto },
  grupo: { gap: espacio(2) },
  etiqueta: { ...tipografia.etiqueta, color: colores.texto },
  chipElegido: {
    backgroundColor: colores.primario,
    borderColor: colores.primario,
  },
  textoChip: { ...tipografia.etiqueta, color: colores.texto },
  textoChipElegido: { color: colores.sobrePrimario },
  asientos: { flexDirection: 'row', gap: espacio(2) },
  asiento: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radio.m,
    borderWidth: 1,
    borderColor: colores.bordeCampo,
    backgroundColor: colores.superficie,
  },
  asientoNo: {
    backgroundColor: colores.fondoSutil,
    borderColor: colores.borde,
  },
  textoAsientoNo: { color: colores.textoPlaceholder },
  secundario: { ...tipografia.secundario, color: colores.textoSecundario },
  enfasis: { ...tipografia.cuerpoEnfasis, color: colores.texto },
  parada: { flexDirection: 'row', gap: espacio(2) },
  punto: { width: 10, height: 10, marginTop: 7, borderRadius: 5 },
  puntoOrigen: { backgroundColor: colores.primario },
  puntoDestino: { backgroundColor: colores.exito },
  valorParada: { ...tipografia.cuerpo, flex: 1, color: colores.texto },
  pasos: {
    marginTop: -espacio(6),
    marginHorizontal: espacio(4),
    padding: espacio(4),
    gap: espacio(4),
    borderRadius: radio.l,
    backgroundColor: colores.superficie,
    ...sombraElevada,
  },
  paso: { flexDirection: 'row', gap: espacio(3) },
  numero: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radio.completo,
    backgroundColor: colores.primarioSuave,
  },
  textoNumero: { ...tipografia.etiqueta, color: colores.primarioTexto },
  textosPaso: { flex: 1, gap: 2 },
  accionPaso: { alignSelf: 'flex-start', marginTop: espacio(2) },
  resultado: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio(3),
    padding: espacio(4),
  },
  tituloResultado: { ...tipografia.pantalla, color: colores.texto },
  textoCentrado: {
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
  },
  filaResumen: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacio(2),
  },
});

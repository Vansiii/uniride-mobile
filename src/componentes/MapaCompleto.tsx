import {
  Camera,
  type CameraRef,
  type InitialViewState,
  Map,
  type MapRef,
  NativeUserLocation,
} from '@maplibre/maplibre-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Entra, Esqueleto, Toque } from '@/componentes/Animado';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { ESTILOS, type TipoMapa } from '@/componentes/estiloMapa';
import { Icono } from '@/componentes/Icono';
import { Aviso } from '@/componentes/Mensajes';
import { PinCentral } from '@/componentes/PinCentral';
import { abrirHttps } from '@/enlaces';
import { t } from '@/i18n';
import {
  buscarLugares,
  type Lugar,
  nombreDePunto,
} from '@/servicios/geocoding';
import { obtenerUbicacion, tienePermisoUbicacion } from '@/servicios/ubicacion';
import {
  colores,
  espacio,
  radio,
  sombraElevada,
  tipografia,
} from '@/tema/tokens';

const PLEGAR_ATRIBUCION_MS = 5000;
const ZOOM_MINIMO = 3;
const ZOOM_MAXIMO = 19;
const URL_ATRIBUCION = {
  calles: 'https://www.openstreetmap.org/copyright',
  relieve: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
} as const;

export type Punto = { lat: number; lng: number };

/**
 * Atribución obligatoria de OpenStreetMap. Se ve al abrir y a los 5 s se pliega en una «i» que la vuelve a mostrar,
 * como permiten sus pautas de atribución para mapas en apps.
 */
export function AtribucionMapa({ tipo = 'calles' }: { tipo?: TipoMapa }) {
  const [abierta, setAbierta] = useState(true);

  useEffect(() => {
    if (!abierta) return;
    const plegar = setTimeout(() => setAbierta(false), PLEGAR_ATRIBUCION_MS);
    return () => clearTimeout(plegar);
  }, [abierta]);

  if (!abierta)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('viajes.mapa.creditos')}
        onPress={() => setAbierta(true)}
        hitSlop={espacio(3)}
        style={estilos.info}
      >
        <Icono nombre="info" color={colores.textoSecundario} tamano={16} />
      </Pressable>
    );
  return (
    <Text
      accessibilityRole="link"
      onPress={() => abrirHttps(URL_ATRIBUCION[tipo])}
      style={estilos.atribucion}
    >
      {t(
        tipo === 'calles'
          ? 'viajes.mapa.atribucion'
          : 'viajes.mapa.atribucion_relieve',
      )}
    </Text>
  );
}

/**
 * El mapa a pantalla completa: pellizco, doble toque, rotar con brújula, tipos de mapa y tu ubicación.
 * Con `elegir` funciona como el de Uber o Bolt: el pin queda fijo al centro, se mueve el mapa debajo, la dirección
 * se resuelve sola y una hoja inferior confirma. Tocar el mapa lleva el pin a ese punto; el buscador de arriba salta
 * a un lugar. Los botones de zoom y «Mi ubicación» cubren a quien no puede hacer los gestos.
 */
export function MapaCompleto({
  inicial,
  alCerrar,
  elegir,
  children,
}: {
  inicial: InitialViewState;
  alCerrar: () => void;
  elegir?: { punto: Punto; alElegir: (punto: Punto) => void };
  children?: ReactNode;
}) {
  const { top, bottom } = useSafeAreaInsets();
  const mapa = useRef<MapRef>(null);
  const camara = useRef<CameraRef>(null);
  const [tipo, setTipo] = useState<TipoMapa>('calles');
  const [conPermiso, setConPermiso] = useState(false);
  const [sinUbicacion, setSinUbicacion] = useState(false);
  const [punto, setPunto] = useState(elegir?.punto);
  const [moviendo, setMoviendo] = useState(false);
  // `undefined`: todavía no se pidió; `null`: sin nombre (se muestra «Punto en el mapa»).
  const [nombre, setNombre] = useState<string | null | undefined>(undefined);
  const [resolviendo, setResolviendo] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [resultados, setResultados] = useState<Lugar[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  // Una respuesta vieja de Nominatim no pisa a la de un punto más reciente.
  const version = useRef(0);
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    void tienePermisoUbicacion().then(setConPermiso);
    return () => clearTimeout(espera.current);
  }, []);

  const resolverNombre = (p: Punto, demora = 0) => {
    clearTimeout(espera.current);
    const mia = ++version.current;
    setResolviendo(true);
    espera.current = setTimeout(() => {
      void nombreDePunto(p.lat, p.lng).then((n) => {
        if (mia !== version.current) return;
        setNombre(n);
        setResolviendo(false);
      });
    }, demora);
  };

  const irA = (p: Punto, zoom?: number) => {
    setPunto(p);
    camara.current?.easeTo({
      center: [p.lng, p.lat],
      ...(zoom ? { zoom } : {}),
      duration: 300,
    });
  };

  const irAMiUbicacion = async () => {
    const ubicacion = await obtenerUbicacion(true);
    setSinUbicacion(ubicacion.tipo !== 'ok');
    if (ubicacion.tipo === 'ok') {
      setConPermiso(true);
      const p = { lat: ubicacion.lat, lng: ubicacion.lng };
      if (elegir) {
        irA(p);
        resolverNombre(p);
      } else camara.current?.easeTo({ center: [p.lng, p.lat], duration: 300 });
    }
  };

  const cambiarZoom = async (cambio: number) => {
    const zoom = await mapa.current?.getZoom();
    if (zoom !== undefined)
      camara.current?.zoomTo(zoom + cambio, { duration: 200 });
  };

  const buscar = async () => {
    const texto = consulta.trim();
    if (texto.length < 3 || buscando) return;
    Keyboard.dismiss();
    setBuscando(true);
    try {
      setResultados(await buscarLugares(texto));
    } catch {
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  };

  const elegirResultado = (l: Lugar) => {
    const p = { lat: l.lat, lng: l.lng };
    setResultados(null);
    setConsulta('');
    setNombre(l.nombre);
    irA(p, 17);
  };

  return (
    <Modal animationType="slide" onRequestClose={alCerrar}>
      <View style={estilos.raiz}>
        {/* La vista nativa trae su propia descripción: ocultarla exige un contenedor. Los botones dan las mismas acciones. */}
        <View
          style={StyleSheet.absoluteFill}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Map
            ref={mapa}
            style={StyleSheet.absoluteFill}
            mapStyle={ESTILOS[tipo]}
            logo={false}
            attribution={false}
            compass
            compassPosition={{ top: top + espacio(36), left: espacio(3) }}
            onPress={
              elegir &&
              (({ nativeEvent: { lngLat } }) => {
                const p = { lng: lngLat[0], lat: lngLat[1] };
                irA(p);
                resolverNombre(p);
              })
            }
            onRegionWillChange={elegir && (() => setMoviendo(true))}
            onRegionDidChange={
              elegir &&
              (({ nativeEvent: { center } }) => {
                setMoviendo(false);
                const p = { lng: center[0], lat: center[1] };
                setPunto(p);
                resolverNombre(p, 500);
              })
            }
          >
            <Camera
              ref={camara}
              initialViewState={inicial}
              minZoom={ZOOM_MINIMO}
              maxZoom={ZOOM_MAXIMO}
            />
            {conPermiso && <NativeUserLocation />}
            {children}
          </Map>
        </View>
        {elegir && <PinCentral moviendo={moviendo} />}
        <View
          pointerEvents="box-none"
          style={[
            estilos.zonaAtribucion,
            { bottom: elegir ? 196 + bottom : 0 },
          ]}
        >
          <AtribucionMapa key={tipo} tipo={tipo} />
        </View>

        <View style={[estilos.arriba, { top: top + espacio(3) }]}>
          <View style={estilos.cerrar}>
            <BotonIcono
              icono="close"
              etiqueta={t('comun.acciones.cerrar')}
              color={colores.texto}
              alPresionar={alCerrar}
            />
          </View>
          {elegir && (
            <View style={estilos.buscador}>
              <Icono
                nombre="search"
                color={colores.textoSecundario}
                tamano={20}
              />
              <TextInput
                accessibilityLabel={t('viajes.mapa.buscar_en_mapa')}
                placeholder={t('viajes.mapa.buscar_lugar')}
                placeholderTextColor={colores.textoPlaceholder}
                returnKeyType="search"
                value={consulta}
                onChangeText={(v) => {
                  setConsulta(v);
                  setResultados(null);
                }}
                onSubmitEditing={() => void buscar()}
                style={estilos.entrada}
              />
              {consulta.length > 0 && (
                <BotonIcono
                  icono="close"
                  etiqueta={t('comun.acciones.cerrar')}
                  color={colores.textoSecundario}
                  alPresionar={() => {
                    setConsulta('');
                    setResultados(null);
                  }}
                />
              )}
            </View>
          )}
        </View>

        {resultados && (
          <Entra style={[estilos.resultados, { top: top + espacio(3) + 60 }]}>
            {resultados.length === 0 ? (
              <Text style={estilos.sinResultados}>
                {t('viajes.mapa.sin_resultados')}
              </Text>
            ) : (
              resultados.map((r) => (
                <Toque
                  key={`${r.lat},${r.lng},${r.detalle}`}
                  escala={0.98}
                  accessibilityRole="button"
                  accessibilityLabel={r.detalle}
                  onPress={() => elegirResultado(r)}
                  style={estilos.resultado}
                >
                  <Icono
                    nombre="location_on"
                    color={colores.primario}
                    tamano={20}
                  />
                  <View style={estilos.textosResultado}>
                    <Text style={estilos.nombreResultado} numberOfLines={1}>
                      {r.nombre}
                    </Text>
                    <Text style={estilos.detalleResultado} numberOfLines={1}>
                      {r.detalle}
                    </Text>
                  </View>
                </Toque>
              ))
            )}
          </Entra>
        )}

        <View style={[estilos.controles, { top: top + espacio(19) }]}>
          <BotonIcono
            icono="my_location"
            etiqueta={t('viajes.buscar.usar_ubicacion')}
            color={colores.primario}
            alPresionar={() => void irAMiUbicacion()}
          />
          <BotonIcono
            icono="layers"
            etiqueta={t(
              tipo === 'calles'
                ? 'viajes.mapa.ver_relieve'
                : 'viajes.mapa.ver_calles',
            )}
            color={colores.texto}
            alPresionar={() =>
              setTipo(tipo === 'calles' ? 'relieve' : 'calles')
            }
          />
          <BotonIcono
            icono="add"
            etiqueta={t('viajes.buscar.acercar')}
            color={colores.texto}
            alPresionar={() => void cambiarZoom(1)}
          />
          <BotonIcono
            icono="remove"
            etiqueta={t('viajes.buscar.alejar')}
            color={colores.texto}
            alPresionar={() => void cambiarZoom(-1)}
          />
        </View>

        {(elegir || sinUbicacion) && (
          <Entra
            style={[
              estilos.hoja,
              { paddingBottom: Math.max(bottom, espacio(4)) },
            ]}
          >
            <View style={estilos.asa} />
            {sinUbicacion && (
              <Aviso tono="info">
                {t('viajes.buscar.ubicacion_mapa_fallo')}
              </Aviso>
            )}
            {elegir && punto && (
              <>
                <View style={estilos.lugar}>
                  <View style={estilos.iconoLugar}>
                    <Icono nombre="location_on" color={colores.primario} />
                  </View>
                  <View style={estilos.textosLugar}>
                    <Text style={estilos.pista}>
                      {t('viajes.mapa.mueve_mapa')}
                    </Text>
                    {resolviendo || moviendo ? (
                      <Esqueleto alto={20} ancho="70%" />
                    ) : (
                      <Text style={estilos.direccion} numberOfLines={2}>
                        {nombre ?? t('viajes.buscar.punto_mapa')}
                      </Text>
                    )}
                  </View>
                </View>
                <Boton
                  anchoCompleto
                  etiqueta={t('viajes.buscar.usar_punto')}
                  alPresionar={() => elegir.alElegir(punto)}
                />
              </>
            )}
          </Entra>
        )}
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondoSutil },
  arriba: {
    position: 'absolute',
    left: espacio(3),
    right: espacio(3),
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(2),
  },
  cerrar: {
    borderRadius: radio.completo,
    backgroundColor: colores.superficie,
    ...sombraElevada,
  },
  buscador: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(2),
    paddingLeft: espacio(4),
    paddingRight: espacio(1),
    borderRadius: radio.completo,
    backgroundColor: colores.superficie,
    ...sombraElevada,
  },
  entrada: {
    flex: 1,
    minHeight: 48,
    color: colores.texto,
    ...tipografia.cuerpo,
  },
  resultados: {
    position: 'absolute',
    left: espacio(3),
    right: espacio(3),
    padding: espacio(2),
    borderRadius: radio.l,
    backgroundColor: colores.superficie,
    ...sombraElevada,
  },
  resultado: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(3),
    paddingHorizontal: espacio(2),
    borderRadius: radio.m,
  },
  textosResultado: { flex: 1 },
  nombreResultado: { ...tipografia.cuerpoEnfasis, color: colores.texto },
  detalleResultado: { ...tipografia.pequeno, color: colores.textoSecundario },
  sinResultados: {
    ...tipografia.cuerpo,
    padding: espacio(3),
    color: colores.textoSecundario,
  },
  zonaAtribucion: { position: 'absolute', left: 0, right: 0, height: 24 },
  controles: {
    position: 'absolute',
    right: espacio(3),
    borderRadius: radio.l,
    backgroundColor: colores.superficie,
    ...sombraElevada,
  },
  hoja: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: espacio(3),
    paddingHorizontal: espacio(4),
    paddingTop: espacio(2),
    borderTopLeftRadius: radio.xl,
    borderTopRightRadius: radio.xl,
    backgroundColor: colores.superficie,
    ...sombraElevada,
  },
  asa: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colores.borde,
  },
  lugar: { flexDirection: 'row', alignItems: 'center', gap: espacio(3) },
  iconoLugar: {
    width: 44,
    height: 44,
    borderRadius: radio.completo,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.primarioSuave,
  },
  textosLugar: { flex: 1, gap: 2 },
  pista: { ...tipografia.pequeno, color: colores.textoSecundario },
  direccion: { ...tipografia.subtitulo, color: colores.texto },
  info: {
    position: 'absolute',
    right: espacio(1),
    bottom: espacio(1),
    padding: espacio(1),
    borderRadius: radio.completo,
    backgroundColor: colores.superficie,
  },
  atribucion: {
    ...tipografia.pequeno,
    position: 'absolute',
    right: 0,
    bottom: 0,
    paddingHorizontal: espacio(1),
    color: colores.texto,
    backgroundColor: colores.superficie,
  },
});

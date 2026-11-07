import {
  Camera,
  type CameraRef,
  type InitialViewState,
  Map,
  type MapRef,
  Marker,
  NativeUserLocation,
} from '@maplibre/maplibre-react-native';
import { Image } from 'expo-image';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { ESTILOS, type TipoMapa } from '@/componentes/estiloMapa';
import { Icono } from '@/componentes/Icono';
import { Aviso } from '@/componentes/Mensajes';
import { abrirHttps } from '@/enlaces';
import { t } from '@/i18n';
import { obtenerUbicacion, tienePermisoUbicacion } from '@/servicios/ubicacion';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';

const PLEGAR_ATRIBUCION_MS = 5000;
const ZOOM_MINIMO = 3;
const ZOOM_MAXIMO = 19;
// El dibujo mide 40 × 56 y su cabeza 36 de ancho: a 38 de ancho la cabeza queda en 34.
const ANCHO_PIN = 38;
const ALTO_PIN = (ANCHO_PIN * 56) / 40;
const URL_ATRIBUCION = {
  calles: 'https://www.openstreetmap.org/copyright',
  relieve: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
} as const;

export type Punto = { lat: number; lng: number };

/** Gota en el color de marca. La caja termina en la punta, que es la que marca el punto. */
function PinMapa() {
  return (
    <Image
      source={require('../../assets/images/pin-mapa.svg')}
      style={{ width: ANCHO_PIN, height: ALTO_PIN }}
    />
  );
}

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
 * Con `elegir`, tocar el mapa deja el pin donde se tocó; moverlo o rotarlo no lo mueve del lugar.
 * Los botones de zoom y «Mi ubicación» cubren a quien no puede hacer los gestos.
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
  const mapa = useRef<MapRef>(null);
  const camara = useRef<CameraRef>(null);
  const [tipo, setTipo] = useState<TipoMapa>('calles');
  const [conPermiso, setConPermiso] = useState(false);
  const [sinUbicacion, setSinUbicacion] = useState(false);
  const [punto, setPunto] = useState(elegir?.punto);

  useEffect(() => {
    void tienePermisoUbicacion().then(setConPermiso);
  }, []);

  const irAMiUbicacion = async () => {
    const ubicacion = await obtenerUbicacion(true);
    setSinUbicacion(ubicacion.tipo !== 'ok');
    if (ubicacion.tipo === 'ok') {
      setConPermiso(true);
      if (elegir) setPunto({ lat: ubicacion.lat, lng: ubicacion.lng });
      camara.current?.easeTo({
        center: [ubicacion.lng, ubicacion.lat],
        duration: 300,
      });
    }
  };

  const cambiarZoom = async (cambio: number) => {
    const zoom = await mapa.current?.getZoom();
    if (zoom !== undefined)
      camara.current?.zoomTo(zoom + cambio, { duration: 200 });
  };

  return (
    <Modal animationType="slide" onRequestClose={alCerrar}>
      <SafeAreaView style={estilos.raiz}>
        <View style={estilos.mapa}>
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
              compassPosition={{ top: espacio(19), left: espacio(3) }}
              onPress={
                elegir &&
                (({ nativeEvent: { lngLat } }) =>
                  setPunto({ lng: lngLat[0], lat: lngLat[1] }))
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
              {punto && (
                // La vista anotada no gira con el mapa: el pin queda de pie y su punta sobre el punto.
                <Marker lngLat={[punto.lng, punto.lat]} anchor="bottom">
                  <PinMapa />
                </Marker>
              )}
            </Map>
          </View>
          <AtribucionMapa key={tipo} tipo={tipo} />
          <View style={estilos.cerrar}>
            <BotonIcono
              icono="close"
              etiqueta={t('comun.acciones.cerrar')}
              color={colores.texto}
              alPresionar={alCerrar}
            />
          </View>
          <View style={estilos.controles}>
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
        </View>
        {(elegir || sinUbicacion) && (
          <View style={estilos.pie}>
            {sinUbicacion && (
              <Aviso tono="info">
                {t('viajes.buscar.ubicacion_mapa_fallo')}
              </Aviso>
            )}
            {elegir && punto && (
              <Boton
                anchoCompleto
                etiqueta={t('viajes.buscar.usar_punto')}
                alPresionar={() => elegir.alElegir(punto)}
              />
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondo },
  mapa: { flex: 1, overflow: 'hidden', backgroundColor: colores.fondoSutil },
  cerrar: {
    position: 'absolute',
    top: espacio(3),
    left: espacio(3),
    borderRadius: radio.completo,
    backgroundColor: colores.superficie,
    elevation: 3,
  },
  controles: {
    position: 'absolute',
    top: espacio(3),
    right: espacio(3),
    borderRadius: radio.l,
    backgroundColor: colores.superficie,
    elevation: 3,
  },
  pie: { gap: espacio(3), padding: espacio(4) },
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

import {
  Camera,
  type CameraRef,
  type InitialViewState,
  Map,
  type MapRef,
  Marker,
  NativeUserLocation,
} from '@maplibre/maplibre-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { ESTILOS, type TipoMapa } from '@/componentes/estiloMapa';
import { Aviso } from '@/componentes/Mensajes';
import { abrirHttps } from '@/enlaces';
import { t } from '@/i18n';
import { obtenerUbicacion, tienePermisoUbicacion } from '@/servicios/ubicacion';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';

const ZOOM_MINIMO = 3;
const ZOOM_MAXIMO = 19;
// La cabeza mide lo mismo que antes; la punta larga le da el cuerpo.
const CABEZA_PIN = 34;
const ANCHO_PIN = CABEZA_PIN + 4;
const ALTO_PIN = 58;
const SOMBRA_PIN = 'rgba(26,31,39,0.2)';
const URL_ATRIBUCION = {
  calles: 'https://www.openstreetmap.org/copyright',
  relieve: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
} as const;

export type Punto = { lat: number; lng: number };

/** Una capa del pin: cabeza redonda y, debajo, una punta en triángulo que termina en `punta`. */
function CapaPin({
  diametro,
  arriba,
  mitadPunta,
  inicioPunta,
  punta,
  color,
}: {
  diametro: number;
  arriba: number;
  mitadPunta: number;
  inicioPunta: number;
  punta: number;
  color: string;
}) {
  return (
    <>
      <View
        style={{
          position: 'absolute',
          top: inicioPunta,
          left: ANCHO_PIN / 2 - mitadPunta,
          borderLeftWidth: mitadPunta,
          borderRightWidth: mitadPunta,
          borderTopWidth: punta - inicioPunta,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: arriba,
          left: (ANCHO_PIN - diametro) / 2,
          width: diametro,
          height: diametro,
          borderRadius: diametro / 2,
          backgroundColor: color,
        }}
      />
    </>
  );
}

/** Pin en el color de marca con un contorno de sombra. Su caja termina justo en la punta. */
function PinMapa() {
  return (
    <View style={estilos.pin}>
      <CapaPin
        diametro={CABEZA_PIN + 4}
        arriba={0}
        mitadPunta={13}
        inicioPunta={20}
        punta={ALTO_PIN}
        color={SOMBRA_PIN}
      />
      <CapaPin
        diametro={CABEZA_PIN}
        arriba={2}
        mitadPunta={11}
        inicioPunta={22}
        punta={ALTO_PIN - 1}
        color={colores.primario}
      />
      <View style={estilos.centroPin} />
    </View>
  );
}

/** Atribución siempre a la vista: la de OpenStreetMap es obligatoria. */
export function AtribucionMapa({ tipo = 'calles' }: { tipo?: TipoMapa }) {
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
          <AtribucionMapa tipo={tipo} />
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
  pin: { width: ANCHO_PIN, height: ALTO_PIN },
  // El punto blanco en el centro de la cabeza azul.
  centroPin: {
    position: 'absolute',
    top: ANCHO_PIN / 2 - 6,
    left: ANCHO_PIN / 2 - 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colores.superficie,
  },
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

import {
  Camera,
  type CameraRef,
  type InitialViewState,
  Map,
  type MapRef,
  NativeUserLocation,
} from '@maplibre/maplibre-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { ESTILOS, type TipoMapa } from '@/componentes/estiloMapa';
import { Icono } from '@/componentes/Icono';
import { Aviso } from '@/componentes/Mensajes';
import { abrirHttps } from '@/enlaces';
import { t } from '@/i18n';
import { obtenerUbicacion, tienePermisoUbicacion } from '@/servicios/ubicacion';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';

const ZOOM_MINIMO = 3;
const ZOOM_MAXIMO = 19;
const ALTO_PIN = 48;
const URL_ATRIBUCION = {
  calles: 'https://www.openstreetmap.org/copyright',
  relieve: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
} as const;

export type Punto = { lat: number; lng: number };

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
 * Con `alElegir`, un pin fijo marca el centro. Los botones de zoom cubren a quien no puede hacer los gestos.
 */
export function MapaCompleto({
  inicial,
  alCerrar,
  alElegir,
  children,
}: {
  inicial: InitialViewState;
  alCerrar: () => void;
  alElegir?: (punto: Punto) => void;
  children?: ReactNode;
}) {
  const mapa = useRef<MapRef>(null);
  const camara = useRef<CameraRef>(null);
  const [tipo, setTipo] = useState<TipoMapa>('calles');
  const [conPermiso, setConPermiso] = useState(false);
  const [sinUbicacion, setSinUbicacion] = useState(false);

  useEffect(() => {
    void tienePermisoUbicacion().then(setConPermiso);
  }, []);

  const irAMiUbicacion = async () => {
    const ubicacion = await obtenerUbicacion(true);
    setSinUbicacion(ubicacion.tipo !== 'ok');
    if (ubicacion.tipo === 'ok') {
      setConPermiso(true);
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

  const elegir = async () => {
    const centro = await mapa.current?.getCenter();
    if (centro) alElegir?.({ lng: centro[0], lat: centro[1] });
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
          {alElegir && (
            <View style={estilos.pin} pointerEvents="none">
              <Icono
                nombre="location_on"
                color={colores.primario}
                tamano={ALTO_PIN}
              />
            </View>
          )}
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
        {(alElegir || sinUbicacion) && (
          <View style={estilos.pie}>
            {sinUbicacion && (
              <Aviso tono="info">
                {t('viajes.buscar.ubicacion_mapa_fallo')}
              </Aviso>
            )}
            {alElegir && (
              <Boton
                anchoCompleto
                etiqueta={t('viajes.buscar.usar_punto')}
                alPresionar={() => void elegir()}
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
  // La punta del pin marca el centro del mapa.
  pin: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -ALTO_PIN / 2,
    marginTop: -ALTO_PIN,
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

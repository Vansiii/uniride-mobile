import {
  Camera,
  GeoJSONSource,
  Layer,
  type LngLatBounds,
  Map,
  Marker,
} from '@maplibre/maplibre-react-native';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { ESTILOS } from '@/componentes/estiloMapa';
import {
  AtribucionMapa,
  MapaCompleto,
  type Punto,
} from '@/componentes/MapaCompleto';
import { t } from '@/i18n';
import { colores, radio } from '@/tema/tokens';

const ALTO = 112;
const ZOOM_MAXIMO = 16;
const MARGEN = 28;
const MARGEN_COMPLETO = 80;

/** El recuadro `[oeste, sur, este, norte]` que contiene ambos puntos. */
export function limites(a: Punto, b: Punto): LngLatBounds {
  return [
    Math.min(a.lng, b.lng),
    Math.min(a.lat, b.lat),
    Math.max(a.lng, b.lng),
    Math.max(a.lat, b.lat),
  ];
}

/** Arco suave entre origen y destino (curva de Bézier): se lee como «trayecto» y no como una regla recta. */
export function arco(a: Punto, b: Punto, pasos = 32): [number, number][] {
  const cx = (a.lng + b.lng) / 2 - (b.lat - a.lat) * 0.2;
  const cy = (a.lat + b.lat) / 2 + (b.lng - a.lng) * 0.2;
  return Array.from({ length: pasos + 1 }, (_, i) => {
    const u = i / pasos;
    const v = 1 - u;
    return [
      v * v * a.lng + 2 * v * u * cx + u * u * b.lng,
      v * v * a.lat + 2 * v * u * cy + u * u * b.lat,
    ];
  });
}

/** Punto de origen con un anillo que late: marca «de aquí sales» y da vida al mapa. */
function PuntoOrigen() {
  const onda = useSharedValue(0);
  useEffect(() => {
    onda.set(
      withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }),
        -1,
      ),
    );
  }, [onda]);
  const anillo = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - onda.value),
    transform: [{ scale: 1 + onda.value * 2.2 }],
  }));
  return (
    <View style={estilos.origenCaja}>
      <Animated.View style={[estilos.anillo, anillo]} />
      <View style={[estilos.punto, estilos.puntoOrigen]} />
    </View>
  );
}

function Puntos({ origen, destino }: { origen: Punto; destino: Punto }) {
  const linea = {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: arco(origen, destino),
    },
  };
  return (
    <>
      <GeoJSONSource id="trayecto" data={linea}>
        <Layer
          id="trayecto-borde"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': '#FFFFFF', 'line-width': 9 }}
        />
        <Layer
          id="trayecto-linea"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': colores.primario, 'line-width': 5 }}
        />
      </GeoJSONSource>
      <Marker lngLat={[origen.lng, origen.lat]}>
        <PuntoOrigen />
      </Marker>
      <Marker lngLat={[destino.lng, destino.lat]} anchor="bottom">
        <Image
          source={require('../../assets/images/pin-mapa.svg')}
          style={estilos.pinDestino}
        />
      </Marker>
    </>
  );
}

/**
 * Trayecto en un recuadro fijo dentro de la pantalla (P8: es secundario y no compite con el desplazamiento).
 * Tocarlo lo abre a pantalla completa, con los gestos del mapa.
 */
export function MapaRuta({
  origen,
  destino,
  alto = ALTO,
  redondeo = radio.m,
}: {
  origen: Punto;
  destino: Punto;
  /** Altura del mapa: 112 en tarjetas, mayor como portada. */
  alto?: number;
  redondeo?: number;
}) {
  const [completo, setCompleto] = useState(false);
  const recuadro = limites(origen, destino);

  return (
    <View style={[estilos.mapa, { height: alto, borderRadius: redondeo }]}>
      <View
        style={StyleSheet.absoluteFill}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={ESTILOS.calles}
          // Dentro de una pantalla con desplazamiento, `surface` se dibuja fuera de lugar en Android.
          androidView="texture"
          dragPan={false}
          touchZoom={false}
          touchRotate={false}
          touchPitch={false}
          logo={false}
          attribution={false}
          compass={false}
        >
          <Camera
            bounds={recuadro}
            padding={
              alto > 200
                ? // Portada: deja libre la cabecera flotante arriba y la hoja que sube abajo.
                  { top: 180, bottom: 100, left: 72, right: 72 }
                : {
                    top: MARGEN,
                    bottom: MARGEN,
                    left: MARGEN,
                    right: MARGEN,
                  }
            }
            maxZoom={ZOOM_MAXIMO}
            duration={0}
          />
          <Puntos origen={origen} destino={destino} />
        </Map>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('viajes.mapa.ver_trayecto')}
        onPress={() => setCompleto(true)}
        style={StyleSheet.absoluteFill}
      />
      <AtribucionMapa />
      {completo && (
        <MapaCompleto
          inicial={{
            bounds: recuadro,
            padding: {
              top: MARGEN_COMPLETO,
              bottom: MARGEN_COMPLETO,
              left: MARGEN_COMPLETO,
              right: MARGEN_COMPLETO,
            },
          }}
          alCerrar={() => setCompleto(false)}
        >
          <Puntos origen={origen} destino={destino} />
        </MapaCompleto>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  mapa: {
    height: ALTO,
    overflow: 'hidden',
    borderRadius: radio.m,
    backgroundColor: colores.fondoSutil,
  },
  punto: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colores.superficie,
  },
  puntoOrigen: { backgroundColor: colores.primario },
  origenCaja: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anillo: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colores.primario,
  },
  pinDestino: { width: 30, height: 42 },
  puntoDestino: { backgroundColor: colores.exito },
});

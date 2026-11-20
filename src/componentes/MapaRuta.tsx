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
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { Icono } from '@/componentes/Icono';
import { con, t } from '@/i18n';
import { resumenRuta, useRutaCalles } from '@/servicios/rutas';
import { espacio, radio, sombraTarjeta, tipografia } from '@/tema/tokens';
import { crearEstilos, useColores } from '@/tema/useEstilos';

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
  const estilos = useEstilos();
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

function Puntos({
  origen,
  destino,
  coordenadas,
  aproximada,
}: {
  origen: Punto;
  destino: Punto;
  coordenadas: [number, number][];
  /** Sin ruta por calles: la línea va punteada para no fingir un camino que no se conoce. */
  aproximada: boolean;
}) {
  const colores = useColores();
  const estilos = useEstilos();
  const linea = {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: coordenadas },
  };
  return (
    <>
      <GeoJSONSource id="trayecto" data={linea}>
        <Layer
          id="trayecto-borde"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{
            'line-color': colores.marcaProfundo,
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 5, 16, 11],
            'line-opacity': aproximada ? 0 : 0.35,
          }}
        />
        <Layer
          id="trayecto-linea"
          type="line"
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{
            'line-color': colores.primario,
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 16, 7],
            ...(aproximada && { 'line-dasharray': [1.5, 1.5] }),
          }}
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

/** Recuadro de toda la línea: una ruta por calles puede salirse del rectángulo de sus dos extremos. */
export function limitesDe(coordenadas: [number, number][]): LngLatBounds {
  const lngs = coordenadas.map((c) => c[0]);
  const lats = coordenadas.map((c) => c[1]);
  return [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];
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
  const colores = useColores();
  const estilos = useEstilos();
  const [completo, setCompleto] = useState(false);
  const ruta = useRutaCalles(origen, destino);
  const coordenadas = ruta?.coordenadas ?? arco(origen, destino);
  const recuadro = ruta ? limitesDe(coordenadas) : limites(origen, destino);
  const puntos = (
    <Puntos
      origen={origen}
      destino={destino}
      coordenadas={coordenadas}
      aproximada={ruta === null}
    />
  );

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
          {puntos}
        </Map>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('viajes.mapa.ver_trayecto')}
        onPress={() => setCompleto(true)}
        style={StyleSheet.absoluteFill}
      />
      {ruta !== undefined && (
        <View
          style={[estilos.resumen, alto > 200 && estilos.resumenPortada]}
          pointerEvents="none"
        >
          <Icono
            nombre={ruta ? 'directions_car' : 'route'}
            color={colores.primario}
            tamano={16}
          />
          <Text style={estilos.resumenTexto}>
            {ruta
              ? con('viajes.mapa.duracion_ruta', { resumen: resumenRuta(ruta) })
              : t('viajes.mapa.ruta_aproximada')}
          </Text>
        </View>
      )}
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
          {puntos}
        </MapaCompleto>
      )}
    </View>
  );
}

/** Vista previa fija de un punto (el origen de la búsqueda); tocarla abre el selector a pantalla completa. */
export function MapaPunto({
  punto,
  etiqueta,
  alPresionar,
}: {
  punto: Punto;
  etiqueta: string;
  alPresionar: () => void;
}) {
  const estilos = useEstilos();
  return (
    <View style={estilos.mapa}>
      <View
        style={StyleSheet.absoluteFill}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={ESTILOS.calles}
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
            center={[punto.lng, punto.lat]}
            zoom={ZOOM_MAXIMO - 1}
            duration={0}
          />
          <Marker lngLat={[punto.lng, punto.lat]}>
            <PuntoOrigen />
          </Marker>
        </Map>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={etiqueta}
        onPress={alPresionar}
        style={StyleSheet.absoluteFill}
      />
      <AtribucionMapa />
    </View>
  );
}

const useEstilos = crearEstilos((colores) => ({
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
  resumen: {
    position: 'absolute',
    top: espacio(2),
    left: espacio(2),
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(1),
    paddingHorizontal: espacio(2),
    paddingVertical: espacio(1),
    borderRadius: radio.completo,
    backgroundColor: colores.superficie,
    ...sombraTarjeta,
  },
  // En la portada la cabecera flotante ocupa arriba: el resumen baja sobre la hoja.
  resumenPortada: { top: undefined, bottom: espacio(10) },
  resumenTexto: { ...tipografia.pequeno, color: colores.texto },
}));

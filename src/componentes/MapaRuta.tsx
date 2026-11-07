import {
  Camera,
  type LngLatBounds,
  Map,
  Marker,
} from '@maplibre/maplibre-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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

function Puntos({ origen, destino }: { origen: Punto; destino: Punto }) {
  return (
    <>
      <Marker lngLat={[origen.lng, origen.lat]}>
        <View style={[estilos.punto, estilos.puntoOrigen]} />
      </Marker>
      <Marker lngLat={[destino.lng, destino.lat]}>
        <View style={[estilos.punto, estilos.puntoDestino]} />
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
}: {
  origen: Punto;
  destino: Punto;
}) {
  const [completo, setCompleto] = useState(false);
  const recuadro = limites(origen, destino);

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
            padding={{
              top: MARGEN,
              bottom: MARGEN,
              left: MARGEN,
              right: MARGEN,
            }}
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
  puntoDestino: { backgroundColor: colores.exito },
});

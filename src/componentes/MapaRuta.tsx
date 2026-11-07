import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { abrirHttps } from '@/enlaces';
import { t } from '@/i18n';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';

const ALTO = 112;
const TAM_TESELA = 256;
const ZOOM_MAXIMO = 16;
const MARGEN = 28;
const URL_ATRIBUCION = 'https://www.openstreetmap.org/copyright';
const LATITUD_MAXIMA = 85;

type Punto = { lat: number; lng: number };

/** Píxel de un punto en el mapa mundial de Web Mercator a este zoom. */
export function aPixel({ lat, lng }: Punto, zoom: number) {
  const escala = TAM_TESELA * 2 ** zoom;
  const seno = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * escala,
    y: (0.5 - Math.log((1 + seno) / (1 - seno)) / (4 * Math.PI)) * escala,
  };
}

/** El punto de un píxel de ese mapa, dentro de lo que Web Mercator dibuja. */
export function dePixel({ x, y }: { x: number; y: number }, zoom: number) {
  const escala = TAM_TESELA * 2 ** zoom;
  const lat =
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / escala))) * 180) / Math.PI;
  return {
    lat: Math.max(-LATITUD_MAXIMA, Math.min(LATITUD_MAXIMA, lat)),
    lng: Math.max(-180, Math.min(180, (x / escala) * 360 - 180)),
  };
}

/** Las teselas de OpenStreetMap que cubren el recuadro; `expo-image` las guarda en disco. */
export function Teselas({
  zoom,
  izquierda,
  arriba,
  ancho,
  alto,
}: {
  zoom: number;
  izquierda: number;
  arriba: number;
  ancho: number;
  alto: number;
}) {
  const teselas: { x: number; y: number }[] = [];
  const total = 2 ** zoom;
  if (ancho)
    for (
      let y = Math.max(0, Math.floor(arriba / TAM_TESELA));
      y <= Math.min(total - 1, Math.floor((arriba + alto) / TAM_TESELA));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(izquierda / TAM_TESELA));
        x <= Math.min(total - 1, Math.floor((izquierda + ancho) / TAM_TESELA));
        x++
      )
        teselas.push({ x, y });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {teselas.map(({ x, y }) => (
        <Image
          key={`${zoom}/${x}/${y}`}
          source={{
            uri: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
            headers: { 'User-Agent': 'UniRide/0.1 (app movil)' },
          }}
          style={[
            estilos.tesela,
            {
              left: x * TAM_TESELA - izquierda,
              top: y * TAM_TESELA - arriba,
            },
          ]}
        />
      ))}
    </View>
  );
}

/** Atribución obligatoria de OpenStreetMap. */
export function AtribucionMapa() {
  return (
    <Text
      accessibilityRole="link"
      onPress={() => abrirHttps(URL_ATRIBUCION)}
      style={estilos.atribucion}
    >
      {t('viajes.publicar.atribucion_mapa')}
    </Text>
  );
}

/** El mayor zoom en el que ambos puntos caben dentro del recuadro. */
export function zoomParaVer(a: Punto, b: Punto, ancho: number): number {
  for (let zoom = ZOOM_MAXIMO; zoom > 0; zoom--) {
    const pa = aPixel(a, zoom);
    const pb = aPixel(b, zoom);
    if (
      Math.abs(pa.x - pb.x) <= ancho - 2 * MARGEN &&
      Math.abs(pa.y - pb.y) <= ALTO - 2 * MARGEN
    )
      return zoom;
  }
  return 0;
}

/**
 * Mapa fijo del trayecto con teselas de OpenStreetMap y su atribución obligatoria. Es secundario (P8): no se toca.
 * ponytail: sin librería de mapas (cambiar dependencias requiere autorización); agregarla al necesitar mover el mapa (HU-23).
 */
export function MapaRuta({
  origen,
  destino,
}: {
  origen: Punto;
  destino: Punto;
}) {
  const [ancho, setAncho] = useState(0);
  const zoom = ancho ? zoomParaVer(origen, destino, ancho) : 0;
  const po = aPixel(origen, zoom);
  const pd = aPixel(destino, zoom);
  const izquierda = (po.x + pd.x) / 2 - ancho / 2;
  const arriba = (po.y + pd.y) / 2 - ALTO / 2;

  return (
    <View
      style={estilos.mapa}
      onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
    >
      <View
        style={StyleSheet.absoluteFill}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Teselas
          zoom={zoom}
          izquierda={izquierda}
          arriba={arriba}
          ancho={ancho}
          alto={ALTO}
        />
        {ancho > 0 && (
          <>
            <View
              style={[
                estilos.punto,
                estilos.puntoOrigen,
                { left: po.x - izquierda - 7, top: po.y - arriba - 7 },
              ]}
            />
            <View
              style={[
                estilos.punto,
                estilos.puntoDestino,
                { left: pd.x - izquierda - 7, top: pd.y - arriba - 7 },
              ]}
            />
          </>
        )}
      </View>
      <AtribucionMapa />
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
  tesela: { position: 'absolute', width: TAM_TESELA, height: TAM_TESELA },
  punto: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colores.superficie,
  },
  puntoOrigen: { backgroundColor: colores.primario },
  puntoDestino: { backgroundColor: colores.exito },
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

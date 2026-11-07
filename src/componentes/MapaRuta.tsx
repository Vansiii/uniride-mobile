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

type Punto = { lat: number; lng: number };

/** Píxel de un punto en el mapa mundial de Web Mercator a este zoom. */
function aPixel({ lat, lng }: Punto, zoom: number) {
  const escala = TAM_TESELA * 2 ** zoom;
  const seno = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * escala,
    y: (0.5 - Math.log((1 + seno) / (1 - seno)) / (4 * Math.PI)) * escala,
  };
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

  const teselas: { x: number; y: number }[] = [];
  if (ancho)
    for (
      let y = Math.floor(arriba / TAM_TESELA);
      y <= Math.floor((arriba + ALTO) / TAM_TESELA);
      y++
    )
      for (
        let x = Math.floor(izquierda / TAM_TESELA);
        x <= Math.floor((izquierda + ancho) / TAM_TESELA);
        x++
      )
        teselas.push({ x, y });

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
      <Text
        accessibilityRole="link"
        onPress={() => abrirHttps(URL_ATRIBUCION)}
        style={estilos.atribucion}
      >
        {t('viajes.publicar.atribucion_mapa')}
      </Text>
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

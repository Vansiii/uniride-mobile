import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { Icono } from '@/componentes/Icono';
import {
  aPixel,
  AtribucionMapa,
  dePixel,
  Teselas,
} from '@/componentes/MapaRuta.web';
import { Aviso } from '@/componentes/Mensajes';
import { t } from '@/i18n';
import { obtenerUbicacion } from '@/servicios/ubicacion';
import { colores, espacio, radio } from '@/tema/tokens';

const ZOOM_INICIAL = 16;
const ZOOM_MINIMO = 11;
const ZOOM_MAXIMO = 18;
const ALTO_PIN = 48;

type Punto = { lat: number; lng: number };

/**
 * Elegir un punto moviendo el mapa bajo un pin fijo. Quien no puede usar el mapa tiene el buscador de lugares.
 * Solo navegador: MapLibre para React Native no dibuja en web; el teléfono usa `SelectorMapa.tsx`.
 */
export function SelectorMapa({
  inicial,
  alCancelar,
  alElegir,
}: {
  inicial: Punto;
  alCancelar: () => void;
  alElegir: (punto: Punto) => void;
}) {
  const [centro, setCentro] = useState(inicial);
  const [zoom, setZoom] = useState(ZOOM_INICIAL);
  const [{ ancho, alto }, setTamano] = useState({ ancho: 0, alto: 0 });
  const [sinUbicacion, setSinUbicacion] = useState(false);
  const [arrastre, setArrastre] = useState<{
    toque: { x: number; y: number };
    pixel: { x: number; y: number };
  } | null>(null);

  const irAMiUbicacion = async () => {
    const ubicacion = await obtenerUbicacion(true);
    setSinUbicacion(ubicacion.tipo !== 'ok');
    if (ubicacion.tipo === 'ok')
      setCentro({ lat: ubicacion.lat, lng: ubicacion.lng });
  };

  const pixel = aPixel(centro, zoom);
  return (
    <Modal animationType="slide" onRequestClose={alCancelar}>
      <SafeAreaView style={estilos.raiz}>
        <View
          style={estilos.mapa}
          onLayout={(e) =>
            setTamano({
              ancho: e.nativeEvent.layout.width,
              alto: e.nativeEvent.layout.height,
            })
          }
          onStartShouldSetResponder={() => true}
          onResponderGrant={({ nativeEvent: { pageX, pageY } }) =>
            setArrastre({
              toque: { x: pageX, y: pageY },
              pixel: aPixel(centro, zoom),
            })
          }
          onResponderMove={({ nativeEvent: { pageX, pageY } }) => {
            if (arrastre)
              setCentro(
                dePixel(
                  {
                    x: arrastre.pixel.x - (pageX - arrastre.toque.x),
                    y: arrastre.pixel.y - (pageY - arrastre.toque.y),
                  },
                  zoom,
                ),
              );
          }}
        >
          <Teselas
            zoom={zoom}
            izquierda={pixel.x - ancho / 2}
            arriba={pixel.y - alto / 2}
            ancho={ancho}
            alto={alto}
          />
          <View style={estilos.pin} pointerEvents="none">
            <Icono nombre="location_on" color={colores.primario} tamano={48} />
          </View>
          <AtribucionMapa />
          <View style={estilos.cerrar}>
            <BotonIcono
              icono="close"
              etiqueta={t('comun.acciones.cerrar')}
              color={colores.texto}
              alPresionar={alCancelar}
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
              icono="add"
              etiqueta={t('viajes.buscar.acercar')}
              color={colores.texto}
              alPresionar={() => setZoom((z) => Math.min(z + 1, ZOOM_MAXIMO))}
            />
            <BotonIcono
              icono="remove"
              etiqueta={t('viajes.buscar.alejar')}
              color={colores.texto}
              alPresionar={() => setZoom((z) => Math.max(z - 1, ZOOM_MINIMO))}
            />
          </View>
        </View>
        <View style={estilos.pie}>
          {sinUbicacion && (
            <Aviso tono="info">{t('viajes.buscar.ubicacion_mapa_fallo')}</Aviso>
          )}
          <Boton
            anchoCompleto
            etiqueta={t('viajes.buscar.usar_punto')}
            alPresionar={() => alElegir(centro)}
          />
        </View>
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
});

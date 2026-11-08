import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { colores, degradadoMarca, espacio, radio } from '@/tema/tokens';

/** Esfera lima que flota despacio: da vida a la cabecera sin competir con el contenido. */
function Orbe({
  estilo,
  desplazamiento,
  ms,
}: {
  estilo: object;
  desplazamiento: number;
  ms: number;
}) {
  const valor = useSharedValue(0);
  useEffect(() => {
    valor.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: ms, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
  }, [valor, ms]);
  const animado = useAnimatedStyle(() => ({
    transform: [
      { translateY: valor.value * desplazamiento },
      { translateX: valor.value * -desplazamiento * 0.6 },
      { scale: 1 + valor.value * 0.12 },
    ],
  }));
  return <Animated.View pointerEvents="none" style={[estilo, animado]} />;
}

/**
 * Encabezado expresivo de las zonas de marca (8.12): degradado índigo, esquinas inferiores
 * redondeadas y la U de la marca de fondo. La acción primaria nunca va dentro.
 */
export function BandaMarca({ children }: { children: ReactNode }) {
  const { top } = useSafeAreaInsets();
  return (
    <View style={[estilos.banda, { paddingTop: top + espacio(6) }]}>
      <StatusBar style="light" />
      <View
        style={estilos.u}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Orbe estilo={estilos.orbeA} desplazamiento={18} ms={4200} />
      <Orbe estilo={estilos.orbeB} desplazamiento={-14} ms={5600} />
      {children}
    </View>
  );
}

/** Zona de acción fija abajo, al alcance del pulgar (5.1): una acción primaria (+ una secundaria). */
export function ZonaAccion({
  children,
  enPestanas,
}: {
  children: ReactNode;
  /** Sobre la barra de pestañas, que ya deja el margen del sistema. */
  enPestanas?: boolean;
}) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View
      style={[
        estilos.zona,
        {
          paddingBottom: enPestanas ? espacio(4) : Math.max(bottom, espacio(4)),
        },
      ]}
    >
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  banda: {
    overflow: 'hidden',
    gap: espacio(3),
    paddingHorizontal: espacio(5),
    paddingBottom: espacio(8),
    borderBottomLeftRadius: radio.xl + 8,
    borderBottomRightRadius: radio.xl + 8,
    backgroundColor: colores.primario,
    experimental_backgroundImage: degradadoMarca,
  },
  // La U de la marca asoma por la esquina inferior derecha (decorativa, 12 %).
  u: {
    position: 'absolute',
    right: -24,
    bottom: -24,
    width: 150,
    height: 150,
    borderWidth: 24,
    borderTopWidth: 0,
    borderColor: colores.sobreMarca,
    borderBottomLeftRadius: 75,
    borderBottomRightRadius: 75,
    opacity: 0.12,
  },
  orbeA: {
    position: 'absolute',
    top: -60,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colores.marcaBrillante,
    opacity: 0.35,
  },
  orbeB: {
    position: 'absolute',
    bottom: -40,
    left: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colores.sobreMarca,
    opacity: 0.08,
  },
  zona: {
    gap: espacio(2),
    paddingTop: espacio(3),
    paddingHorizontal: espacio(4),
    borderTopWidth: 1,
    borderTopColor: colores.borde,
    backgroundColor: colores.fondo,
  },
});

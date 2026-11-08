import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { resorte } from '@/tema/tokens';

// El dibujo mide 40 × 56: la punta queda en el borde inferior de la caja.
export const ANCHO_PIN = 44;
export const ALTO_PIN = (ANCHO_PIN * 56) / 40;
const ELEVACION = 16;

/**
 * Pin fijo en el centro del mapa (patrón de Uber o Bolt): se levanta mientras se mueve el mapa y baja con un
 * resorte al soltarlo; su sombra se encoge y se oscurece al despegarse. La punta marca el centro del contenedor.
 */
export function PinCentral({ moviendo }: { moviendo: boolean }) {
  const elevado = useSharedValue(0);
  useEffect(() => {
    elevado.set(withSpring(moviendo ? 1 : 0, resorte));
  }, [moviendo, elevado]);

  const pin = useAnimatedStyle(() => ({
    transform: [{ translateY: -elevado.value * ELEVACION }],
  }));
  const sombra = useAnimatedStyle(() => ({
    opacity: 0.35 - elevado.value * 0.15,
    transform: [{ scaleX: 1 - elevado.value * 0.45 }],
  }));

  return (
    <View
      pointerEvents="none"
      style={estilos.centro}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[estilos.sombra, sombra]} />
      <Animated.View style={[estilos.pin, pin]}>
        <Image
          source={require('../../assets/images/pin-mapa.svg')}
          style={{ width: ANCHO_PIN, height: ALTO_PIN }}
        />
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // La caja del pin termina en su punta, que cae justo en el centro.
  pin: { position: 'absolute', bottom: '50%' },
  sombra: {
    width: 18,
    height: 7,
    marginTop: -3,
    borderRadius: 9,
    backgroundColor: '#0F1729',
  },
});

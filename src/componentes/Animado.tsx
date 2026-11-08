import { ReactNode, useEffect, useState } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colores, radio, resorte } from '@/tema/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Aparece subiendo con un resorte; `indice` escalona a los hermanos (60 ms cada uno). */
export function Entra({
  children,
  indice = 0,
  style,
}: {
  children: ReactNode;
  indice?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(indice * 60)
        .springify()
        .damping(18)
        .stiffness(170)
        .reduceMotion(ReduceMotion.System)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** Pressable con respuesta física: se hunde al tocar y vuelve con un resorte. */
export function Toque({
  children,
  style,
  escala = 0.96,
  ...resto
}: Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  escala?: number;
}) {
  const valor = useSharedValue(1);
  const animado = useAnimatedStyle(() => ({
    transform: [{ scale: valor.value }],
  }));
  return (
    <AnimatedPressable
      {...resto}
      onPressIn={(e) => {
        valor.set(withSpring(escala, resorte));
        resto.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        valor.set(withSpring(1, resorte));
        resto.onPressOut?.(e);
      }}
      style={[style, animado]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Marcador de posición que respira mientras llega el contenido real. */
export function Esqueleto({
  ancho = '100%',
  alto = 16,
  redondeo = radio.s,
  style,
}: {
  ancho?: ViewStyle['width'];
  alto?: number;
  redondeo?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacidad = useSharedValue(0.55);
  useEffect(() => {
    opacidad.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.55, {
            duration: 700,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
      ),
    );
  }, [opacidad]);
  const animado = useAnimatedStyle(() => ({ opacity: opacidad.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: ancho,
          height: alto,
          borderRadius: redondeo,
          backgroundColor: colores.borde,
        },
        animado,
        style,
      ]}
    />
  );
}

/** Número que sube hasta su valor final (cifras de saldo); respeta "reducir movimiento" porque dura 0 si no hay animación. */
export function useConteo(final: number, ms = 900): number {
  const [valor, setValor] = useState(final);
  useEffect(() => {
    const inicio = Date.now();
    let marco = 0;
    const paso = () => {
      const t = Math.min(1, (Date.now() - inicio) / ms);
      const suave = 1 - Math.pow(1 - t, 3);
      setValor(final * suave);
      if (t < 1) marco = requestAnimationFrame(paso);
    };
    marco = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(marco);
  }, [final, ms]);
  return valor;
}

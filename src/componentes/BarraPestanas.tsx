import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {
  colores,
  espacio,
  radio,
  resorte,
  sombraElevada,
  tipografia,
} from '@/tema/tokens';
import { Toque } from './Animado';

const ALTO = 68;
const MARGEN = 5;

/**
 * Barra flotante: una píldora blanca con sombra sobre el contenido; el fondo índigo de la pestaña activa
 * se desliza con un resorte de una a otra y el ícono "salta" al activarse.
 */
export function BarraPestanas({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
}: BottomTabBarProps) {
  const { bottom } = insets;
  const [ancho, setAncho] = useState(0);
  const total = state.routes.length;
  const anchoItem = ancho > 0 ? (ancho - MARGEN * 2) / total : 0;

  const indicador = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(state.index * anchoItem, resorte) }],
    width: anchoItem,
  }));

  return (
    <View
      style={[estilos.zona, { paddingBottom: Math.max(bottom, espacio(2)) }]}
    >
      <View
        style={estilos.barra}
        onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
      >
        {anchoItem > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[estilos.indicador, indicador]}
          />
        )}
        {state.routes.map((ruta, i) => {
          const { options } = descriptors[ruta.key];
          const activa = state.index === i;
          const etiqueta = options.title ?? ruta.name;
          const color = activa
            ? colores.primarioTexto
            : colores.textoSecundario;
          const alPresionar = () => {
            const evento = emitter.emit({
              type: 'tabPress',
              target: ruta.key,
              canPreventDefault: true,
            });
            if (!activa && !evento.defaultPrevented) navigateToTab(ruta.key);
          };
          return (
            <Toque
              key={ruta.key}
              accessibilityRole="tab"
              accessibilityLabel={etiqueta}
              accessibilityState={{ selected: activa }}
              onPress={alPresionar}
              escala={0.9}
              style={estilos.item}
            >
              {options.tabBarIcon?.({ focused: activa, color, size: 24 })}
              <Text style={[estilos.etiqueta, { color }]}>{etiqueta}</Text>
            </Toque>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  zona: {
    paddingHorizontal: espacio(4),
    paddingTop: espacio(2),
    backgroundColor: colores.fondoSutil,
  },
  barra: {
    height: ALTO,
    flexDirection: 'row',
    padding: MARGEN,
    borderRadius: radio.xl + 6,
    backgroundColor: colores.superficie,
    ...sombraElevada,
  },
  indicador: {
    position: 'absolute',
    top: MARGEN,
    left: MARGEN,
    bottom: MARGEN,
    borderRadius: radio.xl,
    backgroundColor: colores.primarioSuave,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  etiqueta: { ...tipografia.pequeno },
});

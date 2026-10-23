import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import { colores, duracion, radio } from '@/tema/tokens';
import { Icono } from './Icono';

interface Props {
  icono: ComponentProps<typeof Icono>['nombre'];
  /** Color del sello: el del estado que comunica. */
  color: string;
}

// ponytail: la U se arma con Views (sin react-native-svg); el trazo animado de 4.7 queda para cuando haya SVG.
/**
 * Escena de trayecto de la marca (8.12): la U, el origen relleno, el anillo de destino y un sello
 * que entra con `entradaResultado` (escala 0,6 → 1). Decorativa.
 */
export function Ilustracion({ icono, color }: Props) {
  const [escala] = useState(() => new Animated.Value(0.6));
  useEffect(() => {
    let vigente = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reducir) => {
        if (!vigente) return;
        if (reducir) return escala.setValue(1);
        Animated.timing(escala, {
          toValue: 1,
          duration: duracion.larga,
          delay: duracion.larga,
          easing: Easing.bezier(0, 0, 0, 1),
          useNativeDriver: true,
        }).start();
      });
    return () => {
      vigente = false;
    };
  }, [escala]);

  return (
    <View
      style={estilos.escena}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={estilos.fondo} />
      <View style={estilos.u} />
      <View style={estilos.corte} />
      <View style={estilos.origen} />
      <View style={estilos.destino} />
      <Animated.View
        style={[
          estilos.sello,
          {
            opacity: escala.interpolate({
              inputRange: [0.6, 1],
              outputRange: [0, 1],
            }),
          },
          { transform: [{ scale: escala }] },
        ]}
      >
        <Icono nombre={icono} color={color} tamano={32} />
      </Animated.View>
    </View>
  );
}

// Coordenadas sobre la caja de 176 × 160 de la escena web (marca/ y Estados.tsx de web/).
const estilos = StyleSheet.create({
  escena: { width: 176, height: 160, alignSelf: 'center' },
  fondo: {
    position: 'absolute',
    left: 16,
    top: 12,
    width: 144,
    height: 144,
    borderRadius: radio.completo,
    backgroundColor: colores.primarioSuave,
  },
  u: {
    position: 'absolute',
    left: 41,
    top: 48,
    width: 94,
    height: 91,
    borderWidth: 14,
    borderTopWidth: 0,
    borderColor: colores.primario,
    borderBottomLeftRadius: 47,
    borderBottomRightRadius: 47,
  },
  // Acorta la pata derecha para dejar aire bajo el anillo de destino.
  corte: {
    position: 'absolute',
    left: 121,
    top: 48,
    width: 14,
    height: 14,
    backgroundColor: colores.primarioSuave,
  },
  origen: {
    position: 'absolute',
    left: 33,
    top: 25,
    width: 30,
    height: 30,
    borderRadius: radio.completo,
    backgroundColor: colores.primario,
  },
  destino: {
    position: 'absolute',
    left: 114,
    top: 26,
    width: 29,
    height: 29,
    borderRadius: radio.completo,
    borderWidth: 7,
    borderColor: colores.marcaBrillante,
  },
  sello: {
    position: 'absolute',
    left: 60,
    top: 62,
    width: 56,
    height: 56,
    borderRadius: radio.completo,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.superficie,
    elevation: 3,
  },
});

import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colores, degradadoMarca, espacio, radio } from '@/tema/tokens';

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
      {children}
    </View>
  );
}

/** Zona de acción fija abajo, al alcance del pulgar (5.1): una acción primaria (+ una secundaria). */
export function ZonaAccion({ children }: { children: ReactNode }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View
      style={[estilos.zona, { paddingBottom: Math.max(bottom, espacio(4)) }]}
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
    borderBottomLeftRadius: radio.xl,
    borderBottomRightRadius: radio.xl,
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
  zona: {
    gap: espacio(2),
    paddingTop: espacio(3),
    paddingHorizontal: espacio(4),
    borderTopWidth: 1,
    borderTopColor: colores.borde,
    backgroundColor: colores.fondo,
  },
});

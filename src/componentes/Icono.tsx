import { SymbolView } from 'expo-symbols';
import type { SymbolViewProps } from 'expo-symbols';
import { View } from 'react-native';

type NombreAndroid = Extract<SymbolViewProps['name'], object>['android'];

interface Props {
  /** Nombre de Material Symbols (4.8). */
  nombre: NonNullable<NombreAndroid>;
  color: string;
  /** 16–20 en línea con texto, 24 por defecto, 48 en resultados (4.4). */
  tamano?: 16 | 20 | 24 | 32 | 48;
}

/** Ícono siempre decorativo: el texto o el `accessibilityLabel` del control dan el significado. */
export function Icono({ nombre, color, tamano = 24 }: Props) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <SymbolView
        name={{ android: nombre, web: nombre }}
        tintColor={color}
        size={tamano}
      />
    </View>
  );
}

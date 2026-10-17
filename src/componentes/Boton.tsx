import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colores, radio, tamano, tipografia } from '@/tema/tokens';

interface Props {
  /** Texto ya traducido con t(); en gerundio cuando `cargando` ("Entrando…"). */
  etiqueta: string;
  alPresionar: () => void;
  variante?: 'primario' | 'secundario' | 'texto';
  /** Bloquea toques repetidos mientras se llama a la API. */
  cargando?: boolean;
  anchoCompleto?: boolean;
}

export function Boton({
  etiqueta,
  alPresionar,
  variante = 'primario',
  cargando = false,
  anchoCompleto = false,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ busy: cargando, disabled: cargando }}
      disabled={cargando}
      onPress={alPresionar}
      style={({ pressed }) => [
        estilos.base,
        estilos[variante],
        pressed && variante === 'primario' && estilos.primarioPresionado,
        anchoCompleto && estilos.completo,
      ]}
    >
      {cargando && (
        <ActivityIndicator
          color={
            variante === 'primario' ? colores.sobrePrimario : colores.primario
          }
        />
      )}
      <Text
        style={[
          estilos.etiqueta,
          variante === 'primario' && { color: colores.sobrePrimario },
        ]}
      >
        {etiqueta}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: tamano.altoControl,
    paddingHorizontal: 16,
    borderRadius: radio.m,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  completo: { alignSelf: 'stretch' },
  primario: { backgroundColor: colores.primario },
  primarioPresionado: { backgroundColor: colores.primarioPresionado },
  secundario: { borderColor: colores.bordeCampo },
  texto: {},
  etiqueta: { ...tipografia.cuerpoEnfasis, color: colores.primario },
});

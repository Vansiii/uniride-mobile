import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colores, espacio, radio, tamano, tipografia } from '@/tema/tokens';
import { Icono } from './Icono';

interface Props {
  /** Texto ya traducido con t(). */
  etiqueta: string;
  marcada: boolean;
  alCambiar: (marcada: boolean) => void;
  error?: string;
}

/** Casilla de consentimiento u opción sí/no (8.9). Área táctil de 48 aunque el cuadro mida 24. */
export function Casilla({ etiqueta, marcada, alCambiar, error }: Props) {
  return (
    <View style={estilos.contenedor}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={etiqueta}
        accessibilityState={{ checked: marcada }}
        onPress={() => alCambiar(!marcada)}
        style={estilos.fila}
      >
        <View
          style={[
            estilos.cuadro,
            marcada && estilos.cuadroMarcado,
            error ? estilos.cuadroError : null,
          ]}
        >
          {marcada && (
            <Icono nombre="check" color={colores.sobrePrimario} tamano={16} />
          )}
        </View>
        <Text style={estilos.etiqueta}>{etiqueta}</Text>
      </Pressable>
      {error && (
        <View style={estilos.filaError}>
          <Icono nombre="error" color={colores.peligro} tamano={16} />
          <Text accessibilityRole="alert" style={estilos.error}>
            {error}
          </Text>
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio(1) },
  fila: {
    minHeight: tamano.tactilMinimo,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(3),
  },
  cuadro: {
    width: 24,
    height: 24,
    borderRadius: radio.s / 2,
    borderWidth: 2,
    borderColor: colores.bordeCampo,
    backgroundColor: colores.superficie,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cuadroMarcado: {
    borderColor: colores.primario,
    backgroundColor: colores.primario,
  },
  cuadroError: { borderColor: colores.peligro },
  etiqueta: { ...tipografia.cuerpo, color: colores.texto, flex: 1 },
  filaError: {
    flexDirection: 'row',
    gap: espacio(1),
    alignItems: 'flex-start',
    paddingLeft: espacio(9),
  },
  error: { ...tipografia.secundario, color: colores.peligro, flex: 1 },
});

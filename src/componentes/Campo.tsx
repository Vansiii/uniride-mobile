import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { colores, radio, tamano, tipografia } from '@/tema/tokens';

interface Props extends TextInputProps {
  /** La etiqueta siempre es visible; nunca se reemplaza por el placeholder. */
  etiqueta: string;
  ayuda?: string;
  error?: string;
}

export function Campo({ etiqueta, ayuda, error, ...resto }: Props) {
  return (
    <View style={estilos.campo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput
        accessibilityLabel={etiqueta}
        placeholderTextColor={colores.textoPlaceholder}
        {...resto}
        style={[estilos.caja, error ? estilos.conError : null]}
      />
      {(error || ayuda) && (
        <Text
          accessibilityRole={error ? 'alert' : undefined}
          style={error ? estilos.error : estilos.ayuda}
        >
          {error ?? ayuda}
        </Text>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { gap: 8 },
  etiqueta: { ...tipografia.etiqueta, color: colores.texto },
  caja: {
    minHeight: tamano.altoControl,
    paddingHorizontal: 12,
    borderRadius: radio.m,
    borderWidth: 1,
    borderColor: colores.bordeCampo,
    backgroundColor: colores.superficie,
    color: colores.texto,
    ...tipografia.cuerpo,
  },
  conError: { borderWidth: 2, borderColor: colores.peligro },
  ayuda: { ...tipografia.secundario, color: colores.textoSecundario },
  error: { ...tipografia.secundario, color: colores.peligro },
});

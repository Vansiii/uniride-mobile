import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatearDia } from '@/formato';
import { t } from '@/i18n';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';
import { ANTICIPACION_MAXIMA_DIAS } from '@/viajes/salida';

const etiquetaFecha = (fecha: Date, indice: number) =>
  indice === 0
    ? t('viajes.publicar.hoy')
    : indice === 1
      ? t('viajes.publicar.manana')
      : formatearDia(fecha.toISOString());

/** Las únicas fechas posibles: hoy y los 7 días siguientes (RN-5 de HU-17). */
export function SelectorFecha({
  fecha,
  alElegir,
  enUnaLinea = false,
}: {
  fecha: Date;
  alElegir: (fecha: Date) => void;
  /** Las fechas se deslizan en vez de ocupar varias filas. */
  enUnaLinea?: boolean;
}) {
  const ahora = new Date();
  const fechas = Array.from(
    { length: ANTICIPACION_MAXIMA_DIAS + 1 },
    (_, dias) =>
      new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + dias),
  );
  const opciones = fechas.map((f, i) => {
    const elegida = f.getTime() === fecha.getTime();
    const etiqueta = etiquetaFecha(f, i);
    return (
      <Pressable
        key={f.getTime()}
        accessibilityRole="radio"
        accessibilityLabel={etiqueta}
        accessibilityState={{ selected: elegida }}
        onPress={() => alElegir(f)}
        style={[estilos.chip, elegida && estilos.chipElegido]}
      >
        <Text style={[estilos.textoChip, elegida && estilos.textoElegido]}>
          {etiqueta}
        </Text>
      </Pressable>
    );
  });
  return (
    <View style={estilos.grupo}>
      <Text style={estilos.etiqueta}>{t('viajes.publicar.fecha')}</Text>
      {enUnaLinea ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="radiogroup"
          contentContainerStyle={estilos.linea}
        >
          {opciones}
        </ScrollView>
      ) : (
        <View style={estilos.chips} accessibilityRole="radiogroup">
          {opciones}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espacio(2) },
  etiqueta: { ...tipografia.etiqueta, color: colores.texto },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio(2) },
  linea: { flexDirection: 'row', gap: espacio(2) },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: espacio(4),
    borderRadius: radio.completo,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
  },
  chipElegido: {
    backgroundColor: colores.primario,
    borderColor: colores.primario,
  },
  textoChip: { ...tipografia.etiqueta, color: colores.texto },
  textoElegido: { color: colores.sobrePrimario },
});

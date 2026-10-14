import { StyleSheet, Text, View } from 'react-native';
import { t } from '@/i18n';

export default function Inicio() {
  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.titulo} accessibilityRole="header">
        {t('aplicacion.nombre')}
      </Text>
      <Text>{t('aplicacion.eslogan')}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  titulo: { fontSize: 32, fontWeight: 'bold' },
});

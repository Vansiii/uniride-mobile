import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSesion } from '@/contexto/sesion';
import { Boton } from '@/componentes/Boton';
import { t } from '@/i18n';
import { colores, radio, tipografia } from '@/tema/tokens';

export default function EstadoMembresia() {
  const { cargando, usuario, cerrar } = useSesion();
  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;
  const rechazada = usuario.membresias.every((m) => m.estado === 'rechazada');
  return (
    <View style={estilos.contenedor}>
      <View style={rechazada ? estilos.etiquetaPeligro : estilos.etiquetaAviso}>
        <Text style={rechazada ? estilos.textoPeligro : estilos.textoAviso}>
          {t(
            rechazada
              ? 'membresias.estado.rechazada'
              : 'membresias.estado.pendiente',
          )}
        </Text>
      </View>
      <Text style={estilos.titulo} accessibilityRole="header">
        {t(
          rechazada
            ? 'membresias.estado.titulo_rechazada'
            : 'membresias.estado.titulo_pendiente',
        )}
      </Text>
      <Text style={estilos.texto}>
        {t(
          rechazada
            ? 'membresias.estado.explicacion_rechazada'
            : 'membresias.estado.explicacion_pendiente',
        )}
      </Text>
      <Boton
        variante="secundario"
        etiqueta={t('autenticacion.sesion.salir')}
        alPresionar={cerrar}
      />
    </View>
  );
}

const pildora = {
  alignSelf: 'flex-start',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: radio.completo,
} as const;

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    gap: 16,
    backgroundColor: colores.fondo,
  },
  etiquetaAviso: { ...pildora, backgroundColor: colores.avisoSuave },
  etiquetaPeligro: { ...pildora, backgroundColor: colores.peligroSuave },
  textoAviso: { fontSize: 12, fontWeight: '500', color: colores.avisoTexto },
  textoPeligro: {
    fontSize: 12,
    fontWeight: '500',
    color: colores.peligroTexto,
  },
  titulo: { ...tipografia.titulo, color: colores.texto },
  texto: { ...tipografia.cuerpo, color: colores.textoSecundario },
});

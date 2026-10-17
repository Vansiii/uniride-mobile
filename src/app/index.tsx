import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSesion } from '@/contexto/sesion';
import { Boton } from '@/componentes/Boton';
import { t } from '@/i18n';
import { colores, tipografia } from '@/tema/tokens';

export default function Inicio() {
  const { cargando, usuario, cerrar } = useSesion();
  if (cargando) {
    return (
      <View style={estilos.contenedor}>
        <ActivityIndicator accessibilityLabel={t('comun.estados.cargando')} />
      </View>
    );
  }
  if (!usuario) return <Redirect href="/iniciar-sesion" />;
  // Pendiente o rechazada en todas sus organizaciones: solo ve el estado de su solicitud (CA-7).
  if (
    usuario.membresias.length > 0 &&
    !usuario.membresias.some((m) => m.estado === 'aprobada')
  ) {
    return <Redirect href="/estado-membresia" />;
  }
  // ponytail: pantalla mínima; las pestañas de la app (DESIGN_SYSTEM §6.1) llegan con HU-18, HU-17 y HU-12.
  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.titulo} accessibilityRole="header">
        {t('aplicacion.nombre')}
      </Text>
      <Text style={estilos.texto}>
        {t('autenticacion.sesion.bienvenida').replace(
          '{nombre}',
          usuario.nombreCompleto,
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

const estilos = StyleSheet.create({
  contenedor: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    gap: 16,
    backgroundColor: colores.fondo,
  },
  titulo: { ...tipografia.titulo, color: colores.texto },
  texto: { ...tipografia.cuerpo, color: colores.texto },
});

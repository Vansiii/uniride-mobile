import { Image } from 'expo-image';
import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSesion } from '@/contexto/sesion';
import { Boton } from '@/componentes/Boton';
import { ZonaAccion } from '@/componentes/Estructura';
import { Ilustracion } from '@/componentes/Ilustracion';
import { EtiquetaEstado } from '@/componentes/Mensajes';
import { t } from '@/i18n';
import { colores, espacio, tipografia } from '@/tema/tokens';

/** Pantalla de resultado (10.1): membresía pendiente o rechazada en todas sus organizaciones. */
export default function EstadoMembresia() {
  const { cargando, usuario, cerrar } = useSesion();
  const { top } = useSafeAreaInsets();
  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;
  const rechazada = usuario.membresias.every((m) => m.estado === 'rechazada');
  return (
    <View style={estilos.raiz}>
      <View style={[estilos.encabezado, { paddingTop: top }]}>
        <Image
          source={require('../../assets/marca/firma-horizontal.svg')}
          style={estilos.logo}
          contentFit="contain"
          accessibilityLabel={t('aplicacion.nombre')}
        />
      </View>
      <ScrollView contentContainerStyle={estilos.resultado}>
        <Ilustracion
          icono={rechazada ? 'cancel' : 'hourglass_top'}
          color={rechazada ? colores.peligro : colores.aviso}
        />
        <View style={estilos.centro}>
          <EtiquetaEstado
            dominio="membresia"
            estado={rechazada ? 'rechazada' : 'pendiente'}
            texto={t(
              rechazada
                ? 'membresias.estado.rechazada'
                : 'membresias.estado.pendiente',
            )}
          />
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
      </ScrollView>
      <ZonaAccion>
        <Boton
          variante="secundario"
          icono="logout"
          anchoCompleto
          etiqueta={t('autenticacion.sesion.salir')}
          alPresionar={cerrar}
        />
      </ZonaAccion>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondo },
  encabezado: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: espacio(4),
  },
  logo: { width: 120, height: 23, marginTop: espacio(4) },
  resultado: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: espacio(3),
    paddingHorizontal: espacio(6),
    paddingVertical: espacio(8),
  },
  centro: { flexDirection: 'row', justifyContent: 'center' },
  titulo: {
    ...tipografia.pantalla,
    color: colores.texto,
    textAlign: 'center',
  },
  texto: {
    ...tipografia.cuerpo,
    color: colores.textoSecundario,
    textAlign: 'center',
  },
});

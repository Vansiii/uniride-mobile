import { Redirect } from 'expo-router';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSesion } from '@/contexto/sesion';
import { Boton } from '@/componentes/Boton';
import { BandaMarca, ZonaAccion } from '@/componentes/Estructura';
import { t } from '@/i18n';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';

export default function Inicio() {
  const { cargando, usuario, cerrar } = useSesion();
  if (cargando) {
    return (
      <View style={estilos.cargando}>
        <ActivityIndicator
          color={colores.primario}
          size="large"
          accessibilityLabel={t('comun.estados.cargando')}
        />
        <Text style={estilos.textoCargando}>{t('comun.estados.cargando')}</Text>
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
    <View style={estilos.raiz}>
      <ScrollView contentContainerStyle={estilos.desplazable}>
        <BandaMarca>
          <Text style={estilos.saludo} accessibilityRole="header">
            {t('autenticacion.sesion.bienvenida').replace(
              '{nombre}',
              usuario.nombreCompleto,
            )}
          </Text>
          <Text style={estilos.eslogan}>{t('aplicacion.eslogan')}</Text>
        </BandaMarca>
        <View style={estilos.tarjeta}>
          <Text style={estilos.subtitulo}>{t('inicio.cuenta')}</Text>
          <View style={estilos.dato}>
            <Text style={estilos.etiqueta}>{t('inicio.nombre')}</Text>
            <Text style={estilos.valor}>{usuario.nombreCompleto}</Text>
          </View>
          <View style={estilos.dato}>
            <Text style={estilos.etiqueta}>{t('inicio.correo')}</Text>
            <Text style={estilos.valor}>{usuario.correo}</Text>
          </View>
        </View>
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
  cargando: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio(3),
    backgroundColor: colores.fondo,
  },
  textoCargando: { ...tipografia.secundario, color: colores.textoSecundario },
  raiz: { flex: 1, backgroundColor: colores.fondoSutil },
  desplazable: { flexGrow: 1, paddingBottom: espacio(6) },
  saludo: { ...tipografia.pantalla, color: colores.sobreMarca },
  eslogan: { ...tipografia.cuerpo, color: colores.sobreMarcaSecundario },
  // Tarjeta que se superpone 24 a la banda (elevación 0,5, 4.6).
  tarjeta: {
    marginTop: -espacio(6),
    marginHorizontal: espacio(4),
    padding: espacio(4),
    gap: espacio(3),
    borderRadius: radio.l,
    backgroundColor: colores.superficie,
    elevation: 3,
  },
  subtitulo: { ...tipografia.subtitulo, color: colores.texto },
  dato: { gap: 2 },
  etiqueta: { ...tipografia.etiqueta, color: colores.textoSecundario },
  valor: { ...tipografia.cuerpo, color: colores.texto },
});

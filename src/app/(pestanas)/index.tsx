import { Redirect, router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSesion } from '@/contexto/sesion';
import { BotonIcono } from '@/componentes/Boton';
import { BandaMarca } from '@/componentes/Estructura';
import { FormularioBusqueda } from '@/componentes/FormularioBusqueda';
import { Icono } from '@/componentes/Icono';
import { t } from '@/i18n';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';

export default function Inicio() {
  const { cargando, usuario } = useSesion();
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
  const organizacion = usuario.membresias.find(
    (m) => m.organizacionId === usuario.organizacionActiva,
  )?.organizacion;
  // ponytail: Tu cuenta sigue aquí hasta que llegue la pestaña Perfil (DESIGN_SYSTEM §6.1).
  return (
    <View style={estilos.raiz}>
      <ScrollView contentContainerStyle={estilos.desplazable}>
        <BandaMarca>
          <View style={estilos.filaBanda}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('inicio.organizacion')}: ${organizacion ?? '—'}`}
              onPress={() => router.push('/organizaciones')}
              style={estilos.chipOrganizacion}
            >
              <Icono
                nombre="corporate_fare"
                color={colores.sobreMarca}
                tamano={16}
              />
              <Text style={estilos.textoChip} numberOfLines={1}>
                {organizacion ?? '—'}
              </Text>
            </Pressable>
            {/* ponytail: la voz llega con HU-27; hasta entonces el botón está en su lugar, desactivado (DESIGN_SYSTEM §8). */}
            <BotonIcono
              icono="mic"
              etiqueta={t('inicio.voz_pronto')}
              color={colores.sobreMarca}
              deshabilitado
              alPresionar={() => {}}
            />
          </View>
          <Text style={estilos.saludo} accessibilityRole="header">
            {t('autenticacion.sesion.bienvenida').replace(
              '{nombre}',
              // Nombre de pila, como lo ven los demás (RN-4 de HU-18).
              usuario.nombreCompleto.trim().split(/\s+/)[0],
            )}
          </Text>
          <Text style={estilos.eslogan}>{t('viajes.buscar.subtitulo')}</Text>
        </BandaMarca>
        <FormularioBusqueda key={usuario.id} />
      </ScrollView>
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
  filaBanda: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacio(2),
  },
  chipOrganizacion: {
    flexShrink: 1,
    alignSelf: 'flex-start',
    minHeight: 32,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(1),
    paddingHorizontal: espacio(3),
    borderRadius: radio.completo,
    borderWidth: 1,
    borderColor: colores.sobreMarcaSecundario,
  },
  textoChip: {
    ...tipografia.etiqueta,
    flexShrink: 1,
    color: colores.sobreMarca,
  },
});

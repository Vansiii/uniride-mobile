import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BandaMarca } from '@/componentes/Estructura';
import { Avatar, FilaAjuste } from '@/componentes/FilaAjuste';
import { useSesion } from '@/contexto/sesion';
import { t } from '@/i18n';
import {
  colores,
  espacio,
  radio,
  sombraTarjeta,
  tipografia,
} from '@/tema/tokens';

/** Perfil (DESIGN_SYSTEM §6.1): la cuenta, la organización activa y los accesos a vehículo, teléfono e identidad. */
export default function Perfil() {
  const { cargando, usuario, cerrar } = useSesion();
  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;
  const organizacion = usuario.membresias.find(
    (m) => m.organizacionId === usuario.organizacionActiva,
  )?.organizacion;
  return (
    <View style={estilos.raiz}>
      <ScrollView contentContainerStyle={estilos.desplazable}>
        <BandaMarca>
          <View style={estilos.persona}>
            <Avatar nombre={usuario.nombreCompleto} grande />
            <View style={estilos.textos}>
              <Text style={estilos.nombre} accessibilityRole="header">
                {usuario.nombreCompleto}
              </Text>
              <Text style={estilos.correo}>{usuario.correo}</Text>
            </View>
          </View>
        </BandaMarca>
        <View style={estilos.grupo}>
          <FilaAjuste
            icono="corporate_fare"
            titulo={t('membresias.lista.ver')}
            detalle={organizacion}
            alPresionar={() => router.push('/organizaciones')}
          />
          <View style={estilos.separador} />
          <FilaAjuste
            icono="directions_car"
            titulo={t('vehiculos.registro.ver')}
            alPresionar={() => router.push('/vehiculo')}
          />
          <View style={estilos.separador} />
          <FilaAjuste
            icono="smartphone"
            titulo={t('dispositivo.vinculacion.ver')}
            alPresionar={() => router.push('/dispositivo')}
          />
          <View style={estilos.separador} />
          <FilaAjuste
            icono="verified_user"
            titulo={t('identidad.verificacion.ver')}
            alPresionar={() => router.push('/identidad')}
          />
        </View>
        <View style={estilos.grupo}>
          <FilaAjuste
            peligro
            icono="logout"
            titulo={t('autenticacion.sesion.salir')}
            alPresionar={cerrar}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondoSutil },
  desplazable: { flexGrow: 1, gap: espacio(4), paddingBottom: espacio(6) },
  persona: { flexDirection: 'row', alignItems: 'center', gap: espacio(4) },
  textos: { flex: 1, gap: 2 },
  nombre: { ...tipografia.titulo, color: colores.sobreMarca },
  correo: { ...tipografia.secundario, color: colores.sobreMarcaSecundario },
  grupo: {
    marginHorizontal: espacio(4),
    paddingVertical: espacio(1),
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
    ...sombraTarjeta,
  },
  separador: {
    height: 1,
    marginLeft: espacio(4) + 40 + espacio(3),
    backgroundColor: colores.borde,
  },
});

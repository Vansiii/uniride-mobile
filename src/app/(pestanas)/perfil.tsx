import { Redirect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  consultarEstadoIdentidad,
  consultarMiDispositivo,
  consultarMiVehiculo,
} from '@/api/cliente';
import { Entra } from '@/componentes/Animado';
import { BandaMarca } from '@/componentes/Estructura';
import { Avatar, FilaAjuste } from '@/componentes/FilaAjuste';
import { useSesion } from '@/contexto/sesion';
import { useAlEnfocar } from '@/hooks/useAlEnfocar';
import { con, t } from '@/i18n';
import {
  colores,
  espacio,
  radio,
  sombraTarjeta,
  tipografia,
} from '@/tema/tokens';

/** Perfil (DESIGN_SYSTEM §6.1): la cuenta, la organización activa y los accesos a vehículo, teléfono e identidad. */
/** Una consulta que falla (sin red, sin sesión) cuenta como «no listo»: nunca rompe el perfil. */
const seguro = <T,>(consulta: () => Promise<T>) =>
  Promise.resolve()
    .then(consulta)
    .catch(() => null);

export default function Perfil() {
  const { cargando, usuario, cerrar } = useSesion();
  const [listos, setListos] = useState<{
    vehiculo: boolean;
    telefono: boolean;
    identidad: boolean;
  } | null>(null);
  const hayUsuario = Boolean(usuario);
  const cargar = useCallback(() => {
    if (!hayUsuario) return;
    let vigente = true;
    void Promise.all([
      seguro(consultarMiVehiculo),
      seguro(consultarMiDispositivo),
      seguro(consultarEstadoIdentidad),
    ]).then(([vehiculo, telefono, identidad]) => {
      if (vigente)
        setListos({
          vehiculo: Boolean(vehiculo),
          telefono: Boolean(telefono),
          identidad:
            (identidad as { estado?: string } | null)?.estado === 'verificada',
        });
    });
    return () => {
      vigente = false;
    };
  }, [hayUsuario]);
  useAlEnfocar(cargar);
  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;
  const organizacion = usuario.membresias.find(
    (m) => m.organizacionId === usuario.organizacionActiva,
  )?.organizacion;
  const hechos = listos ? Object.values(listos).filter(Boolean).length : 0;
  const total = 3;
  const etiqueta = (listo: boolean | undefined, ok: string) =>
    listos
      ? {
          texto: listo ? ok : t('perfil.estado.pendiente'),
          listo: Boolean(listo),
        }
      : undefined;
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
        {listos && (
          <Entra style={estilos.progreso}>
            <View style={estilos.cabeceraProgreso}>
              <Text style={estilos.tituloProgreso}>
                {hechos === total
                  ? t('perfil.progreso_completo')
                  : t('perfil.progreso_titulo')}
              </Text>
              <Text style={estilos.cuentaProgreso}>
                {con('perfil.progreso', { hechos, total })}
              </Text>
            </View>
            <View
              style={estilos.pasos}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[estilos.paso, i < hechos && estilos.pasoHecho]}
                />
              ))}
            </View>
          </Entra>
        )}
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
            estado={etiqueta(listos?.vehiculo, t('perfil.estado.registrado'))}
            alPresionar={() => router.push('/vehiculo')}
          />
          <View style={estilos.separador} />
          <FilaAjuste
            icono="smartphone"
            titulo={t('dispositivo.vinculacion.ver')}
            estado={etiqueta(listos?.telefono, t('perfil.estado.vinculado'))}
            alPresionar={() => router.push('/dispositivo')}
          />
          <View style={estilos.separador} />
          <FilaAjuste
            icono="verified_user"
            titulo={t('identidad.verificacion.ver')}
            estado={etiqueta(listos?.identidad, t('perfil.estado.verificada'))}
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
  progreso: {
    gap: espacio(3),
    marginHorizontal: espacio(4),
    padding: espacio(4),
    borderRadius: radio.l,
    backgroundColor: colores.primarioSuave,
  },
  cabeceraProgreso: { gap: 2 },
  tituloProgreso: { ...tipografia.subtitulo, color: colores.primarioTexto },
  cuentaProgreso: { ...tipografia.secundario, color: colores.textoSecundario },
  pasos: { flexDirection: 'row', gap: espacio(2) },
  paso: {
    flex: 1,
    height: 6,
    borderRadius: radio.completo,
    backgroundColor: colores.borde,
  },
  pasoHecho: { backgroundColor: colores.exito },
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

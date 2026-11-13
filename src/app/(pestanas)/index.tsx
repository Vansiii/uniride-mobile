import { Redirect, router } from 'expo-router';
import type { ComponentProps } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Entra, Toque } from '@/componentes/Animado';
import { useSesion } from '@/contexto/sesion';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { BandaMarca } from '@/componentes/Estructura';
import { FormularioBusqueda } from '@/componentes/FormularioBusqueda';
import { Icono } from '@/componentes/Icono';
import { ViajeActivo } from '@/componentes/ViajeActivo';
import { t } from '@/i18n';
import {
  colores,
  espacio,
  radio,
  sombraTarjeta,
  tipografia,
} from '@/tema/tokens';

/** Atajo cuadrado: ícono en círculo y rótulo corto. */
function Atajo({
  icono,
  etiqueta,
  alPresionar,
}: {
  icono: ComponentProps<typeof Icono>['nombre'];
  etiqueta: string;
  alPresionar: () => void;
}) {
  return (
    <Toque
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={alPresionar}
      style={estilos.atajo}
    >
      <View style={estilos.circuloAtajo}>
        <Icono nombre={icono} color={colores.primario} />
      </View>
      <Text style={estilos.textoAtajo} numberOfLines={1}>
        {etiqueta}
      </Text>
    </Toque>
  );
}

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
      <ScrollView
        contentContainerStyle={estilos.desplazable}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <BandaMarca>
          <View style={estilos.filaBanda}>
            <Toque
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
            </Toque>
            {/* ponytail: la voz llega con HU-27; hasta entonces el botón está en su lugar, desactivado (DESIGN_SYSTEM §8). */}
            <BotonIcono
              icono="mic"
              etiqueta={t('inicio.voz_pronto')}
              color={colores.sobreMarca}
              deshabilitado
              alPresionar={() => {}}
            />
          </View>
          <Entra indice={0}>
            <Text style={estilos.saludo} accessibilityRole="header">
              {t('autenticacion.sesion.bienvenida').replace(
                '{nombre}',
                // Nombre de pila, como lo ven los demás (RN-4 de HU-18).
                usuario.nombreCompleto.trim().split(/\s+/)[0],
              )}
            </Text>
            <Text style={estilos.eslogan}>{t('viajes.buscar.subtitulo')}</Text>
          </Entra>
        </BandaMarca>
        <FormularioBusqueda key={usuario.id} />
        <ViajeActivo key={`activo-${usuario.id}`} />
        <Entra indice={3} style={estilos.atajos}>
          <Atajo
            icono="receipt_long"
            etiqueta={t('inicio.atajo_movimientos')}
            alPresionar={() => router.push('/movimientos')}
          />
          <Atajo
            icono="directions_car"
            etiqueta={t('inicio.atajo_vehiculo')}
            alPresionar={() => router.push('/vehiculo')}
          />
          <Atajo
            icono="verified_user"
            etiqueta={t('inicio.atajo_identidad')}
            alPresionar={() => router.push('/identidad')}
          />
        </Entra>
        <Entra indice={4} style={estilos.promo}>
          <Text style={estilos.promoTitulo}>{t('inicio.publica_titulo')}</Text>
          <Text style={estilos.promoTexto}>{t('inicio.publica_texto')}</Text>
          <Boton
            variante="secundario"
            icono="add_circle"
            etiqueta={t('inicio.publica_boton')}
            alPresionar={() => router.push('/publicar')}
          />
        </Entra>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  atajos: {
    flexDirection: 'row',
    gap: espacio(3),
    marginTop: espacio(4),
    marginHorizontal: espacio(4),
  },
  atajo: {
    flex: 1,
    alignItems: 'center',
    gap: espacio(2),
    paddingVertical: espacio(4),
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
    ...sombraTarjeta,
  },
  circuloAtajo: {
    width: 44,
    height: 44,
    borderRadius: radio.completo,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.primarioSuave,
  },
  textoAtajo: { ...tipografia.etiqueta, color: colores.texto },
  promo: {
    gap: espacio(2),
    marginTop: espacio(4),
    marginHorizontal: espacio(4),
    padding: espacio(5),
    borderRadius: radio.xl,
    backgroundColor: colores.primarioSuave,
  },
  promoTitulo: { ...tipografia.titulo, color: colores.primarioTexto },
  promoTexto: { ...tipografia.cuerpo, color: colores.textoSecundario },
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
  saludo: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '800',
    letterSpacing: -1.5,
    color: colores.sobreMarca,
  },
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
    borderColor: colores.vidrioBorde,
    backgroundColor: colores.vidrio,
  },
  textoChip: {
    ...tipografia.etiqueta,
    flexShrink: 1,
    color: colores.sobreMarca,
  },
});

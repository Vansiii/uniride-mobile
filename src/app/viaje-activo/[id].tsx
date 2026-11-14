import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { consultarReserva, consultarViaje } from '@/api/cliente';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { ZonaAccion } from '@/componentes/Estructura';
import { Aviso, EtiquetaEstado } from '@/componentes/Mensajes';
import { useSesion } from '@/contexto/sesion';
import { useAlEnfocar } from '@/hooks/useAlEnfocar';
import { con, t } from '@/i18n';
import { colores, espacio, tipografia } from '@/tema/tokens';
import {
  INTERVALO_MS,
  reanudarSeguimiento,
  useSeguimiento,
} from '@/viajes/seguimiento';

/**
 * «Viaje en curso» (HU-23 CA-1, CA-2, CA-12): si se comparte la ubicación, lo que falta para que siga con la pantalla
 * apagada y la bajada de cada rol (conductor: su código; pasajero: el escáner). `id` es el viaje o la reserva.
 */
export default function ViajeActivoPantalla() {
  const { cargando, usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const { id, rol: rolParam } = useLocalSearchParams<{
    id: string;
    rol?: string;
  }>();
  const rol = rolParam === 'conductor' ? 'conductor' : 'pasajero';
  const { ruta, enMarcha } = useSeguimiento({ rol, id });
  const [destino, setDestino] = useState<string>();
  const [estado, setEstado] = useState<string>();
  const [permisoFondo, setPermisoFondo] = useState(true);
  const [ubicacionActiva, setUbicacionActiva] = useState(true);

  // Al volver de la bajada el estado cambió: se pregunta otra vez cada vez que la pantalla vuelve al frente.
  useAlEnfocar(
    useCallback(() => {
      let vigente = true;
      void reanudarSeguimiento();
      (rol === 'conductor'
        ? consultarViaje(id).then((v) => [v.destino.nombre, v.estado])
        : consultarReserva(id).then((r) => [r.viaje.destinoNombre, r.estado])
      )
        .then(([nombre, e]) => {
          if (!vigente) return;
          setDestino(nombre);
          setEstado(e);
        })
        // Sin destino igual se puede seguir y bajar: el título queda genérico.
        .catch(() => undefined);
      return () => {
        vigente = false;
      };
    }, [id, rol]),
  );

  // Spec §4: ubicación apagada a mitad de viaje o sin permiso en segundo plano, aviso mientras dure.
  useEffect(() => {
    const revisar = () => {
      Location.getBackgroundPermissionsAsync()
        .then((p) => setPermisoFondo(p.granted))
        .catch(() => setPermisoFondo(false));
      Location.hasServicesEnabledAsync()
        .then(setUbicacionActiva)
        .catch(() => setUbicacionActiva(false));
    };
    revisar();
    const reloj = setInterval(revisar, INTERVALO_MS);
    return () => clearInterval(reloj);
  }, []);

  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;

  const permitirSiempre = async () => {
    const p = await Location.requestBackgroundPermissionsAsync().catch(
      () => null,
    );
    setPermisoFondo(p?.granted ?? false);
    await reanudarSeguimiento();
  };

  return (
    <View style={estilos.raiz}>
      <StatusBar style="dark" />
      <View style={[estilos.barra, { paddingTop: top + espacio(2) }]}>
        <BotonIcono
          icono="close"
          etiqueta={t('comun.acciones.cerrar')}
          alPresionar={() => router.replace('/viajes')}
        />
        <Text style={estilos.titulo} accessibilityRole="header">
          {destino
            ? con('presencia.trayecto.titulo', { destino })
            : t('presencia.trayecto.titulo_sin_destino')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={estilos.contenido}>
        {/* DESIGN_SYSTEM §10.4: el estado del viaje (conductor) o de la reserva (pasajero), según el servidor. */}
        {estado && (
          <EtiquetaEstado
            dominio={rol === 'conductor' ? 'viaje' : 'reserva'}
            estado={estado}
            texto={t(
              rol === 'conductor'
                ? `viajes.estado.${estado}`
                : `reservas.estado.${estado}`,
            )}
          />
        )}
        {ruta ? (
          <Aviso tono="info">{t('presencia.trayecto.compartiendo')}</Aviso>
        ) : (
          <Aviso tono="aviso">{t('presencia.trayecto.detenido')}</Aviso>
        )}
        {ruta?.sinConexion && (
          <Aviso tono="aviso">{t('presencia.trayecto.sin_conexion')}</Aviso>
        )}
        {ruta?.firmaVencida && (
          <Aviso tono="peligro">{t('presencia.trayecto.firma_vencida')}</Aviso>
        )}
        {ruta && !ubicacionActiva && (
          <Aviso tono="peligro">
            {t('presencia.trayecto.activa_ubicacion')}
          </Aviso>
        )}
        {ruta && (!permisoFondo || !enMarcha) && (
          <>
            <Aviso tono="aviso">
              {t('presencia.trayecto.permiso_segundo_plano')}
            </Aviso>
            <Boton
              variante="secundario"
              icono="my_location"
              etiqueta={t('presencia.trayecto.permitir_siempre')}
              alPresionar={() => void permitirSiempre()}
            />
          </>
        )}
      </ScrollView>

      <ZonaAccion>
        <Boton
          anchoCompleto
          icono={rol === 'conductor' ? 'qr_code_2' : 'qr_code_scanner'}
          etiqueta={t(
            rol === 'conductor'
              ? 'presencia.trayecto.bajada_conductor'
              : 'presencia.trayecto.bajada_pasajero',
          )}
          alPresionar={() =>
            router.push(
              rol === 'conductor'
                ? `/abordaje/mostrar/${id}?tipo=bajada`
                : `/abordaje/escanear/${id}?tipo=bajada`,
            )
          }
        />
      </ZonaAccion>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.superficie },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(2),
    paddingHorizontal: espacio(2),
  },
  titulo: { ...tipografia.titulo, color: colores.texto, flexShrink: 1 },
  contenido: { gap: espacio(4), padding: espacio(4) },
});

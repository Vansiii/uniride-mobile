import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  abordar,
  bajar,
  consultarReserva,
  consultarViaje,
  type MotivoTrayecto,
  type TipoEncuentro,
} from '@/api/cliente';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { AvisoFallaAbordaje } from '@/componentes/AvisoFallaAbordaje';
import { ZonaAccion } from '@/componentes/Estructura';
import { Ilustracion } from '@/componentes/Ilustracion';
import { Aviso } from '@/componentes/Mensajes';
import { useSesion } from '@/contexto/sesion';
import {
  crearLlaveTrayecto,
  nonceAleatorio,
  pedirTokenIntegridad,
} from '@/dispositivo/keystore';
import { useAccionSensible } from '@/hooks/useAccionSensible';
import { con, t } from '@/i18n';
import { posicionParaEncuentro } from '@/servicios/ubicacion';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';
import {
  type FallaAbordaje,
  fallaDeAbordaje,
  fallaDeUbicacion,
  nonceDelQr,
  texto,
} from '@/viajes/abordaje';
import {
  detenerSeguimiento,
  enviarCola,
  iniciarSeguimiento,
} from '@/viajes/seguimiento';

type Paso =
  | { tipo: 'escanear' }
  | { tipo: 'verificando' }
  | { tipo: 'verificado'; yaVerificado: boolean }
  /** HU-23 CA-11: la bajada se aceptó pero el trayecto no se verificó. */
  | { tipo: 'no_verificado'; motivo: MotivoTrayecto | null }
  | { tipo: 'falla'; falla: FallaAbordaje };

/**
 * «Escanear QR» del pasajero (HU-22 CA-2, DESIGN_SYSTEM §10.4): cámara con marco, el nombre del conductor y la placa
 * para reconocer el auto. Al leer un código de UniRide pide la huella y envía código, posición, integridad y la llave
 * de trayecto; el servidor decide y la pantalla solo muestra su respuesta.
 */
export default function EscanearCodigoPantalla() {
  const { cargando, usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const { reservaId, tipo: tipoParam } = useLocalSearchParams<{
    reservaId: string;
    tipo?: string;
  }>();
  const encuentro: TipoEncuentro =
    tipoParam === 'bajada' ? 'bajada' : 'abordaje';
  const [permiso, pedirPermiso] = useCameraPermissions();
  const accion = useAccionSensible('abordar');
  const [paso, setPaso] = useState<Paso>({ tipo: 'escanear' });
  const [conductor, setConductor] = useState<string>();
  const [placa, setPlaca] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  // La cámara entrega el mismo código varias veces por segundo: solo el primero cuenta.
  const leyendo = useRef(false);

  useEffect(() => {
    let vigente = true;
    consultarReserva(reservaId)
      .then(async (r) => {
        if (!vigente) return;
        setConductor(r.viaje.conductor);
        const v = await consultarViaje(r.viaje.id);
        if (vigente) setPlaca(v.vehiculo.placa);
      })
      // Sin nombre ni placa igual se puede escanear: el servidor comprueba la reserva (CA-9).
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [reservaId]);

  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;

  const terminar = (siguiente: Paso) => {
    leyendo.current = false;
    setPaso(siguiente);
    const exito = siguiente.tipo === 'verificado';
    void Haptics.notificationAsync(
      exito
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    ).catch(() => undefined);
    AccessibilityInfo.announceForAccessibility(
      exito
        ? texto(encuentro, 'verificado')
        : siguiente.tipo === 'falla'
          ? siguiente.falla.texto
          : siguiente.tipo === 'no_verificado'
            ? textoMotivo(siguiente.motivo)
            : '',
    );
  };

  /** HU-23: la cola sale antes de la bajada (lo que llega después no se evalúa); el servidor decide el resultado. */
  const verificarBajada = async (nonce: string) => {
    setPaso({ tipo: 'verificando' });
    try {
      const [lectura] = await Promise.all([
        posicionParaEncuentro(),
        enviarCola(),
      ]);
      if (lectura.tipo !== 'ok') {
        const falla = fallaDeUbicacion(lectura, 'bajada');
        if (falla) terminar({ tipo: 'falla', falla });
        return;
      }
      const nonceFirma = nonceAleatorio();
      const tokenIntegridad = await pedirTokenIntegridad(nonceFirma);
      const r = await accion.ejecutar((opciones) =>
        bajar(
          reservaId,
          { nonce, posicion: lectura.posicion, tokenIntegridad },
          { ...opciones, nonce: nonceFirma },
        ),
      );
      if (!r) return;
      void detenerSeguimiento({ rol: 'pasajero', id: reservaId });
      terminar(
        r.estado === 'verificada'
          ? { tipo: 'verificado', yaVerificado: r.yaVerificado }
          : { tipo: 'no_verificado', motivo: r.motivo },
      );
    } catch (error) {
      terminar({
        tipo: 'falla',
        falla: fallaDeAbordaje(error, 'abordar', 'bajada'),
      });
    }
  };

  /** Una huella por escaneo (RN-6): posición y llave de trayecto se preparan a la vez para no gastar los 30 s. */
  const verificar = async (nonce: string) => {
    if (encuentro === 'bajada') return verificarBajada(nonce);
    setPaso({ tipo: 'verificando' });
    try {
      const [lectura, llavePublicaTrayectoPem] = await Promise.all([
        posicionParaEncuentro(),
        crearLlaveTrayecto('pasajero'),
      ]);
      if (lectura.tipo !== 'ok') {
        const falla = fallaDeUbicacion(lectura);
        if (falla) terminar({ tipo: 'falla', falla });
        return;
      }
      const nonceFirma = nonceAleatorio();
      const tokenIntegridad = await pedirTokenIntegridad(nonceFirma);
      const r = await accion.ejecutar((opciones) =>
        abordar(
          reservaId,
          {
            nonce,
            posicion: lectura.posicion,
            tokenIntegridad,
            llavePublicaTrayectoPem,
          },
          { ...opciones, nonce: nonceFirma },
        ),
      );
      if (!r) return;
      // HU-23 CA-1: a bordo, empieza a compartir la posición con la llave recién registrada.
      if (r.llaveTrayectoId)
        void iniciarSeguimiento({
          rol: 'pasajero',
          id: reservaId,
          llaveTrayectoId: r.llaveTrayectoId,
        });
      terminar({ tipo: 'verificado', yaVerificado: r.yaVerificado });
    } catch (error) {
      terminar({ tipo: 'falla', falla: fallaDeAbordaje(error, 'abordar') });
    }
  };

  const alLeer = ({ data }: { data: string }) => {
    if (leyendo.current) return;
    const nonce = nonceDelQr(data);
    if (!nonce) return setAviso(texto(encuentro, 'qr_ajeno'));
    leyendo.current = true;
    setAviso(undefined);
    void verificar(nonce);
  };

  const escanearOtraVez = () => {
    setAviso(undefined);
    setPaso({ tipo: 'escanear' });
  };

  const camaraLista = permiso?.granted && paso.tipo === 'escanear';

  return (
    <View style={estilos.raiz}>
      <StatusBar style="dark" />
      <View style={[estilos.barra, { paddingTop: top + espacio(2) }]}>
        <BotonIcono
          icono="close"
          etiqueta={t('comun.acciones.cerrar')}
          alPresionar={() => router.back()}
        />
        <Text style={estilos.titulo} accessibilityRole="header">
          {texto(encuentro, 'titulo_pasajero')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={estilos.contenido}>
        {(paso.tipo === 'escanear' || paso.tipo === 'verificando') && (
          <>
            {conductor && (
              <Text style={estilos.enfasis}>
                {con('presencia.abordaje.apunta', { nombre: conductor })}
              </Text>
            )}
            {placa && (
              <Text style={estilos.secundario}>
                {con('presencia.abordaje.placa', { placa })}
              </Text>
            )}
          </>
        )}

        {permiso && !permiso.granted && paso.tipo === 'escanear' && (
          <>
            <Aviso tono="info">{t('presencia.abordaje.permiso_camara')}</Aviso>
            <Boton
              icono="photo_camera"
              etiqueta={t(
                permiso.canAskAgain
                  ? 'presencia.abordaje.dar_permiso_camara'
                  : 'presencia.abordaje.abrir_ajustes',
              )}
              alPresionar={() =>
                void (permiso.canAskAgain
                  ? pedirPermiso()
                  : Linking.openSettings())
              }
            />
          </>
        )}

        {camaraLista && (
          <View style={estilos.visor}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={alLeer}
            />
            <View pointerEvents="none" style={estilos.marco} />
          </View>
        )}
        {aviso && paso.tipo === 'escanear' && (
          <Aviso tono="aviso">{aviso}</Aviso>
        )}

        {paso.tipo === 'verificando' && (
          <Aviso tono="info">
            {accion.estado === 'enviando'
              ? t('presencia.abordaje.verificando')
              : t('presencia.abordaje.leido')}
          </Aviso>
        )}

        {paso.tipo === 'verificado' && (
          <View style={estilos.resultado}>
            <Ilustracion icono="verified" color={colores.exito} />
            <Text style={estilos.tituloResultado} accessibilityRole="header">
              {texto(encuentro, 'verificado')}
            </Text>
            <Text style={estilos.secundario}>
              {texto(
                encuentro,
                paso.yaVerificado ? 'ya_verificado' : 'verificado_texto',
              )}
            </Text>
          </View>
        )}

        {paso.tipo === 'no_verificado' && (
          <View style={estilos.resultado}>
            <Ilustracion icono="error" color={colores.peligro} />
            <Text style={estilos.tituloResultado} accessibilityRole="header">
              {t('presencia.bajada.no_verificado')}
            </Text>
            <Text style={estilos.secundario}>{textoMotivo(paso.motivo)}</Text>
          </View>
        )}

        {paso.tipo === 'falla' && <AvisoFallaAbordaje falla={paso.falla} />}
      </ScrollView>

      {paso.tipo !== 'escanear' && paso.tipo !== 'verificando' && (
        <ZonaAccion>
          {paso.tipo === 'falla' ? (
            <Boton
              anchoCompleto
              icono="qr_code_scanner"
              etiqueta={t('presencia.abordaje.volver_a_escanear')}
              alPresionar={escanearOtraVez}
            />
          ) : encuentro === 'abordaje' ? (
            <Boton
              anchoCompleto
              icono="near_me"
              etiqueta={t('presencia.trayecto.ver_viaje')}
              alPresionar={() =>
                router.replace(`/viaje-activo/${reservaId}?rol=pasajero`)
              }
            />
          ) : (
            <Boton
              anchoCompleto
              etiqueta={t('reservas.resultado.ver_mis_viajes')}
              alPresionar={() => router.replace('/viajes')}
            />
          )}
        </ZonaAccion>
      )}
    </View>
  );
}

/** CA-10 tiene su propio texto; los demás motivos (CA-5 a CA-7) se explican igual, sin decir cómo se detectó. */
const textoMotivo = (motivo: MotivoTrayecto | null) =>
  t(
    motivo === 'datos_insuficientes'
      ? 'presencia.trayecto.datos_insuficientes'
      : 'presencia.trayecto.verificacion_fallida',
  );

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
  visor: {
    aspectRatio: 1,
    overflow: 'hidden',
    borderRadius: radio.l,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Marco blanco donde va el código del conductor.
  marco: {
    width: '65%',
    aspectRatio: 1,
    borderWidth: 3,
    borderRadius: radio.l,
    borderColor: '#FFFFFF',
  },
  resultado: { alignItems: 'center', gap: espacio(3), paddingTop: espacio(6) },
  tituloResultado: {
    ...tipografia.pantalla,
    color: colores.texto,
    textAlign: 'center',
  },
  enfasis: { ...tipografia.cuerpoEnfasis, color: colores.texto },
  secundario: {
    ...tipografia.secundario,
    color: colores.textoSecundario,
    textAlign: 'center',
  },
});

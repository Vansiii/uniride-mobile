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
import { abordar, consultarReserva, consultarViaje } from '@/api/cliente';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { BotonRevincular } from '@/componentes/BotonRevincular';
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
} from '@/viajes/abordaje';

type Paso =
  | { tipo: 'escanear' }
  | { tipo: 'verificando' }
  | { tipo: 'verificado'; yaVerificado: boolean }
  | { tipo: 'falla'; falla: FallaAbordaje };

/**
 * «Escanear QR» del pasajero (HU-22 CA-2, DESIGN_SYSTEM §10.4): cámara con marco, el nombre del conductor y la placa
 * para reconocer el auto. Al leer un código de UniRide pide la huella y envía código, posición, integridad y la llave
 * de trayecto; el servidor decide y la pantalla solo muestra su respuesta.
 */
export default function EscanearCodigoPantalla() {
  const { cargando, usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const { reservaId } = useLocalSearchParams<{ reservaId: string }>();
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
        ? t('presencia.abordaje.verificado')
        : siguiente.tipo === 'falla'
          ? siguiente.falla.texto
          : '',
    );
  };

  /** Una huella por escaneo (RN-6): posición y llave de trayecto se preparan a la vez para no gastar los 30 s. */
  const verificar = async (nonce: string) => {
    setPaso({ tipo: 'verificando' });
    try {
      const [lectura, llavePublicaTrayectoPem] = await Promise.all([
        posicionParaEncuentro(),
        crearLlaveTrayecto(),
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
      if (r) terminar({ tipo: 'verificado', yaVerificado: r.yaVerificado });
    } catch (error) {
      terminar({ tipo: 'falla', falla: fallaDeAbordaje(error, 'abordar') });
    }
  };

  const alLeer = ({ data }: { data: string }) => {
    if (leyendo.current) return;
    const nonce = nonceDelQr(data);
    if (!nonce) return setAviso(t('presencia.abordaje.qr_ajeno'));
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
          {t('presencia.abordaje.titulo_pasajero')}
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
              {t('presencia.abordaje.verificado')}
            </Text>
            <Text style={estilos.secundario}>
              {t(
                paso.yaVerificado
                  ? 'presencia.abordaje.ya_verificado'
                  : 'presencia.abordaje.verificado_texto',
              )}
            </Text>
          </View>
        )}

        {paso.tipo === 'falla' && (
          <>
            <Aviso tono={paso.falla.tono}>{paso.falla.texto}</Aviso>
            {paso.falla.revincular && (
              <BotonRevincular motivo={paso.falla.revincular} />
            )}
            {paso.falla.vincular && (
              <Boton
                variante="secundario"
                icono="smartphone"
                etiqueta={t('billetera.pantalla.vincular')}
                alPresionar={() => router.push('/dispositivo')}
              />
            )}
            {paso.falla.ajustes && (
              <Boton
                variante="secundario"
                icono="settings"
                etiqueta={t('presencia.abordaje.abrir_ajustes')}
                alPresionar={() => void Linking.openSettings()}
              />
            )}
          </>
        )}
      </ScrollView>

      {(paso.tipo === 'verificado' || paso.tipo === 'falla') && (
        <ZonaAccion>
          {paso.tipo === 'falla' ? (
            <Boton
              anchoCompleto
              icono="qr_code_scanner"
              etiqueta={t('presencia.abordaje.volver_a_escanear')}
              alPresionar={escanearOtraVez}
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

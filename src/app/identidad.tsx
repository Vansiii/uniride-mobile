import { Image } from 'expo-image';
import * as SelectorImagen from 'expo-image-picker';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  consultarEstadoIdentidad,
  crearSesionLiveness,
  ErrorApi,
  EstadoVerificacion,
  FotoCarnet,
  verificarIdentidad,
} from '@/api/cliente';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { Casilla } from '@/componentes/Casilla';
import { ZonaAccion } from '@/componentes/Estructura';
import { Aviso } from '@/componentes/Mensajes';
import { useSesion } from '@/contexto/sesion';
import { formatearHora, t } from '@/i18n';
import { ejecutarLiveness, ErrorLiveness } from '@/identidad/liveness';
import { Entra, Esqueleto } from '@/componentes/Animado';
import { Ilustracion } from '@/componentes/Ilustracion';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';

type Paso = 1 | 2 | 3;
// Misma forma que valida el servidor; allí se decide, aquí solo se avisa antes de enviar.
const FORMATO_DOCUMENTO = /^[0-9A-Za-z][0-9A-Za-z -]{3,19}$/;
const MAXIMO_FOTO_BYTES = 5 * 1024 * 1024;

interface Falla {
  texto: string;
  /** Paso al que conviene volver para corregir. */
  paso?: Paso;
}

const esBloqueo = (error: unknown) =>
  error instanceof ErrorApi &&
  (error.codigo === 'INTENTOS_AGOTADOS' ||
    error.codigo === 'IDENTIDAD_BLOQUEADA_TEMPORAL');

/** Traduce el `codigo` de la API; nunca muestra códigos técnicos (DESIGN_SYSTEM §13.4). */
function fallaDe(error: unknown): Falla {
  if (error instanceof ErrorLiveness)
    return { texto: t('identidad.verificacion.liveness_no_disponible') };
  if (!(error instanceof ErrorApi))
    return { texto: t('comun.errores.desconocido') };
  switch (error.codigo) {
    case 'PRUEBA_VIDA_FALLIDA':
      return { texto: t('identidad.verificacion.prueba_vida_fallida') };
    case 'ROSTRO_NO_COINCIDE':
      return { texto: t('identidad.verificacion.rostro_no_coincide'), paso: 2 };
    case 'DOCUMENTO_DUPLICADO':
      return {
        texto: t('identidad.verificacion.documento_duplicado'),
        paso: 1,
      };
    case 'ROSTRO_DUPLICADO':
      return { texto: t('identidad.verificacion.rostro_duplicado') };
    case 'IMAGEN_ILEGIBLE':
      return { texto: t('identidad.verificacion.imagen_ilegible'), paso: 2 };
    case 'CONSENTIMIENTO_REQUERIDO':
      return {
        texto: t('identidad.verificacion.consentimiento_requerido'),
        paso: 1,
      };
    case 'INTENTOS_AGOTADOS':
    case 'IDENTIDAD_BLOQUEADA_TEMPORAL':
      return {
        texto: t('identidad.verificacion.intentos_agotados').replace(
          '{hora}',
          formatearHora(error.datos.bloqueadoHasta),
        ),
      };
    case 'SERVICIO_NO_DISPONIBLE':
      return { texto: t('identidad.verificacion.servicio_no_disponible') };
    case 'SIN_CONEXION':
      return { texto: t('comun.errores.sin_conexion') };
    default:
      return { texto: t('comun.errores.desconocido') };
  }
}

/** Verificación de identidad (HU-08): consentimiento y número → foto del carnet → prueba de vida. */
export default function IdentidadPantalla() {
  const { cargando, usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const [consultando, setConsultando] = useState(true);
  const [estado, setEstado] = useState<EstadoVerificacion | null>(null);
  const [sinConsulta, setSinConsulta] = useState(false);
  const [intento, setIntento] = useState(0);
  const [paso, setPaso] = useState<Paso>(1);
  const [numero, setNumero] = useState('');
  const [consentimiento, setConsentimiento] = useState(false);
  const [carnet, setCarnet] = useState<FotoCarnet | null>(null);
  const [errores, setErrores] = useState<
    Partial<Record<'numero' | 'consentimiento' | 'carnet', string>>
  >({});
  const [falla, setFalla] = useState<Falla | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (cargando || !usuario) return;
    let vigente = true;
    consultarEstadoIdentidad()
      .then((e) => vigente && setEstado(e))
      .catch((error) => {
        if (!vigente) return;
        // Sin saber el estado no se ofrece verificar a ciegas.
        setSinConsulta(true);
        setFalla(fallaDe(error));
      })
      .finally(() => vigente && setConsultando(false));
    return () => {
      vigente = false;
    };
  }, [cargando, usuario, intento]);

  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;

  const reintentar = () => {
    setSinConsulta(false);
    setFalla(null);
    setConsultando(true);
    setIntento((n) => n + 1);
  };

  const siguiente = () => {
    const nuevos = {
      numero: !numero.trim()
        ? t('identidad.verificacion.numero_requerido')
        : FORMATO_DOCUMENTO.test(numero.trim())
          ? undefined
          : t('identidad.verificacion.numero_invalido'),
      consentimiento: consentimiento
        ? undefined
        : t('identidad.verificacion.consentimiento_requerido'),
    };
    setErrores(nuevos);
    if (!nuevos.numero && !nuevos.consentimiento) setPaso(2);
  };

  const tomarCarnet = async () => {
    setErrores((e) => ({ ...e, carnet: undefined }));
    setFalla(null);
    try {
      const permiso = await SelectorImagen.requestCameraPermissionsAsync();
      if (!permiso.granted)
        return setErrores((e) => ({
          ...e,
          carnet: t('identidad.verificacion.sin_permiso_camara'),
        }));
      const resultado = await SelectorImagen.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (resultado.canceled) return;
      const foto = resultado.assets[0];
      if (foto.fileSize && foto.fileSize > MAXIMO_FOTO_BYTES)
        return setErrores((e) => ({
          ...e,
          carnet: t('identidad.verificacion.imagen_ilegible'),
        }));
      setCarnet({
        uri: foto.uri,
        tipo: foto.mimeType ?? 'image/jpeg',
        archivo: foto.file,
      });
    } catch {
      setFalla({ texto: t('comun.errores.desconocido') });
    }
  };

  const verificar = async () => {
    if (!carnet) return;
    setFalla(null);
    setEnviando(true);
    try {
      const { sesionId } = await crearSesionLiveness();
      await ejecutarLiveness(sesionId);
      const r = await verificarIdentidad({
        numeroDocumento: numero.trim(),
        aceptaConsentimiento: consentimiento,
        sesionId,
        fotoCarnet: carnet,
      });
      setEstado({
        estado: r.estado,
        verificadoEn: r.verificadoEn,
        bloqueadoHasta: null,
      });
      // Dato sensible: sale de la memoria apenas se envía.
      setCarnet(null);
      setNumero('');
    } catch (error) {
      if (
        error instanceof ErrorApi &&
        error.codigo === 'IDENTIDAD_YA_VERIFICADA'
      ) {
        setEstado(await consultarEstadoIdentidad().catch(() => null));
        setFalla({ texto: t('identidad.verificacion.ya_verificada') });
        return;
      }
      const f = fallaDe(error);
      setFalla(f);
      if (f.paso) {
        // Una foto rechazada no se reenvía: hay que tomar otra.
        if (f.paso === 2) setCarnet(null);
        setPaso(f.paso);
      }
      if (esBloqueo(error))
        setEstado({
          estado: 'bloqueada_temporal',
          verificadoEn: null,
          bloqueadoHasta: String((error as ErrorApi).datos.bloqueadoHasta),
        });
    } finally {
      setEnviando(false);
    }
  };

  const verificada = estado?.estado === 'verificada';
  const bloqueada =
    estado?.estado === 'bloqueada_temporal' && Boolean(estado.bloqueadoHasta);
  const formulario = !consultando && !sinConsulta && !verificada && !bloqueada;

  return (
    <KeyboardAvoidingView
      style={estilos.raiz}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[estilos.encabezado, { paddingTop: top }]}>
        <BotonIcono
          icono="arrow_back"
          etiqueta={t('comun.acciones.volver')}
          alPresionar={() => router.back()}
        />
        <Text style={estilos.tituloBarra} accessibilityRole="header">
          {t('identidad.verificacion.titulo')}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={estilos.contenido}
        keyboardShouldPersistTaps="handled"
      >
        {falla && <Aviso tono="peligro">{falla.texto}</Aviso>}
        {consultando ? (
          <View accessibilityLabel={t('comun.estados.cargando')}>
            <Esqueleto alto={140} redondeo={radio.l} />
          </View>
        ) : sinConsulta ? (
          <Boton
            variante="secundario"
            icono="refresh"
            anchoCompleto
            etiqueta={t('comun.acciones.reintentar')}
            alPresionar={reintentar}
          />
        ) : verificada ? (
          <Entra style={estilos.hero}>
            <Ilustracion icono="verified_user" color={colores.exito} />
            <Aviso tono="exito">{t('identidad.verificacion.verificada')}</Aviso>
            {estado?.verificadoEn && (
              <Text style={estilos.texto}>
                {t('identidad.verificacion.verificada_desde').replace(
                  '{fecha}',
                  new Date(estado.verificadoEn).toLocaleDateString('es-BO'),
                )}
              </Text>
            )}
          </Entra>
        ) : bloqueada ? (
          <Aviso tono="peligro">
            {t('identidad.verificacion.bloqueada').replace(
              '{hora}',
              formatearHora(estado?.bloqueadoHasta),
            )}
          </Aviso>
        ) : (
          <>
            {estado?.estado === 'rechazada' && (
              <Aviso tono="peligro">
                {t('identidad.verificacion.rechazada')}
              </Aviso>
            )}
            <Text style={estilos.texto}>
              {t('identidad.verificacion.explicacion')}
            </Text>
            <View
              style={estilos.progreso}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {[1, 2, 3].map((n) => (
                <View
                  key={n}
                  style={[estilos.segmento, n <= paso && estilos.segmentoHecho]}
                />
              ))}
            </View>
            <Text style={estilos.paso} accessibilityRole="header">
              {t('identidad.verificacion.paso').replace(
                '{actual}',
                String(paso),
              )}
              {' · '}
              {t(`identidad.verificacion.paso${paso}`)}
            </Text>
            {paso === 1 && (
              <>
                <Campo
                  etiqueta={t('identidad.verificacion.numero')}
                  ayuda={t('identidad.verificacion.numero_ayuda')}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  value={numero}
                  onChangeText={(v) => {
                    setNumero(v);
                    setErrores((e) => ({ ...e, numero: undefined }));
                  }}
                  error={errores.numero}
                />
                <Casilla
                  etiqueta={t('identidad.verificacion.consentimiento')}
                  marcada={consentimiento}
                  alCambiar={(v) => {
                    setConsentimiento(v);
                    setErrores((e) => ({ ...e, consentimiento: undefined }));
                  }}
                  error={errores.consentimiento}
                />
              </>
            )}
            {paso === 2 && (
              <View style={estilos.grupo}>
                <Text style={estilos.texto}>
                  {t('identidad.verificacion.carnet_ayuda')}
                </Text>
                {carnet && (
                  <Image
                    source={{ uri: carnet.uri }}
                    style={estilos.previa}
                    contentFit="cover"
                    accessibilityLabel={t(
                      'identidad.verificacion.carnet_previa',
                    )}
                  />
                )}
                <Boton
                  variante="secundario"
                  icono="photo_camera"
                  anchoCompleto
                  etiqueta={t(
                    carnet
                      ? 'identidad.verificacion.cambiar_carnet'
                      : 'identidad.verificacion.tomar_carnet',
                  )}
                  alPresionar={tomarCarnet}
                />
                {errores.carnet && (
                  <Text accessibilityRole="alert" style={estilos.error}>
                    {errores.carnet}
                  </Text>
                )}
              </View>
            )}
            {paso === 3 && (
              <Text style={estilos.texto}>
                {t('identidad.verificacion.prueba_ayuda')}
              </Text>
            )}
            <Text style={estilos.texto}>
              {t('identidad.verificacion.privacidad')}
            </Text>
          </>
        )}
      </ScrollView>
      {formulario && (
        <ZonaAccion>
          {paso === 3 ? (
            <Boton
              anchoCompleto
              cargando={enviando}
              etiqueta={t(
                enviando
                  ? 'identidad.verificacion.verificando'
                  : 'identidad.verificacion.iniciar_prueba',
              )}
              alPresionar={verificar}
            />
          ) : (
            <Boton
              anchoCompleto
              etiqueta={t('identidad.verificacion.siguiente')}
              alPresionar={
                paso === 1
                  ? siguiente
                  : () =>
                      carnet
                        ? setPaso(3)
                        : setErrores((e) => ({
                            ...e,
                            carnet: t(
                              'identidad.verificacion.carnet_requerido',
                            ),
                          }))
              }
            />
          )}
          {paso > 1 && (
            <Boton
              variante="texto"
              anchoCompleto
              etiqueta={t('comun.acciones.volver')}
              alPresionar={() => setPaso((p) => (p - 1) as Paso)}
            />
          )}
        </ZonaAccion>
      )}
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondoSutil },
  encabezado: {
    minHeight: 56,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: espacio(1),
    paddingHorizontal: espacio(2),
  },
  tituloBarra: {
    ...tipografia.pantalla,
    width: '100%',
    paddingHorizontal: espacio(2),
    paddingBottom: espacio(2),
    color: colores.texto,
  },
  contenido: {
    flexGrow: 1,
    gap: espacio(4),
    paddingHorizontal: espacio(4),
    paddingVertical: espacio(4),
  },
  texto: { ...tipografia.cuerpo, color: colores.textoSecundario },
  hero: { gap: espacio(4) },
  progreso: { flexDirection: 'row', gap: espacio(2) },
  segmento: {
    flex: 1,
    height: 6,
    borderRadius: radio.completo,
    backgroundColor: colores.borde,
  },
  segmentoHecho: { backgroundColor: colores.primario },
  paso: { ...tipografia.etiqueta, color: colores.texto },
  grupo: { gap: espacio(2) },
  previa: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radio.m,
    backgroundColor: colores.fondoSutil,
  },
  error: { ...tipografia.secundario, color: colores.peligro },
});

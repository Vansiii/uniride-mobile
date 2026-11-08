import { StatusBar } from 'expo-status-bar';
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
  consultarMiVehiculo,
  ErrorApi,
  FotoVehiculo,
  registrarVehiculo,
  Vehiculo,
} from '@/api/cliente';
import { useSesion } from '@/contexto/sesion';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { Casilla } from '@/componentes/Casilla';
import { ZonaAccion } from '@/componentes/Estructura';
import { Aviso } from '@/componentes/Mensajes';
import { t } from '@/i18n';
import {
  colores,
  espacio,
  radio,
  sombraTarjeta,
  tipografia,
} from '@/tema/tokens';

type Campos =
  | 'placa'
  | 'marca'
  | 'modelo'
  | 'color'
  | 'capacidad'
  | 'foto'
  | 'consentimiento';
type Errores = Partial<Record<Campos, string>>;

interface Falla {
  /** Error de un campo concreto; si no hay, va en el aviso sobre el formulario. */
  campo?: Campos;
  texto: string;
}

const MAXIMO_FOTO_BYTES = 5 * 1024 * 1024;
const MAXIMO_TEXTO = 40;
// Misma forma que valida el servidor (RN-2); allí se decide, aquí solo se avisa antes de enviar.
const FORMATO_PLACA = /^[0-9]{3,4}[A-Z]{3}$/;

const normalizarPlaca = (placa: string) =>
  placa.replace(/[\s-]/g, '').toUpperCase();

/** Traduce el `codigo` de la API; nunca muestra códigos técnicos (DESIGN_SYSTEM §13.4). */
function fallaDe(error: unknown): Falla {
  if (!(error instanceof ErrorApi))
    return { texto: t('comun.errores.desconocido') };
  switch (error.codigo) {
    case 'VEHICULO_PLACA_DUPLICADA':
      return {
        campo: 'placa',
        texto: t('vehiculos.registro.placa_duplicada'),
      };
    case 'VEHICULO_DATO_INVALIDO':
      return error.datos.campo === 'placa' || error.datos.campo === 'capacidad'
        ? {
            campo: error.datos.campo,
            texto: t(
              error.datos.campo === 'placa'
                ? 'vehiculos.registro.placa_invalida'
                : 'vehiculos.registro.capacidad_invalida',
            ),
          }
        : { texto: t('vehiculos.registro.dato_invalido') };
    case 'VEHICULO_FOTO_INVALIDA':
      return { campo: 'foto', texto: t('vehiculos.registro.foto_invalida') };
    case 'CONSENTIMIENTO_REQUERIDO':
      return {
        campo: 'consentimiento',
        texto: t('vehiculos.registro.consentimiento_requerido'),
      };
    case 'ALMACENAMIENTO_NO_DISPONIBLE':
      return { texto: t('vehiculos.registro.no_disponible') };
    case 'NO_AUTORIZADO':
      return { texto: t('vehiculos.registro.sin_membresia') };
    case 'SIN_CONEXION':
      return { texto: t('comun.errores.sin_conexion') };
    default:
      return { texto: t('comun.errores.desconocido') };
  }
}

/** Registrar vehículo (HU-11): un vehículo por persona; ya registrado, se muestra sin la foto (CA-7). */
export default function VehiculoPantalla() {
  const { cargando, usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const [consultando, setConsultando] = useState(true);
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [placa, setPlaca] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [color, setColor] = useState('');
  const [capacidad, setCapacidad] = useState('');
  const [foto, setFoto] = useState<FotoVehiculo | null>(null);
  const [consentimiento, setConsentimiento] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [falla, setFalla] = useState<Falla | null>(null);
  const [registrado, setRegistrado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Si no se pudo consultar, no se ofrece registrar a ciegas: podría ya tener uno.
  const [sinConsulta, setSinConsulta] = useState(false);
  const [intento, setIntento] = useState(0);

  // Basta la membresía aprobada (D-21); el servidor lo vuelve a exigir.
  const aprobada = Boolean(
    usuario?.membresias.some((m) => m.estado === 'aprobada'),
  );
  useEffect(() => {
    if (cargando || !aprobada) return;
    let vigente = true;
    consultarMiVehiculo()
      .then((v) => vigente && setVehiculo(v))
      .catch((error) => {
        if (!vigente) return;
        setSinConsulta(true);
        setFalla(fallaDe(error));
      })
      .finally(() => vigente && setConsultando(false));
    return () => {
      vigente = false;
    };
  }, [cargando, aprobada, intento]);

  const reintentar = () => {
    setSinConsulta(false);
    setFalla(null);
    setConsultando(true);
    setIntento((n) => n + 1);
  };

  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;
  if (!aprobada) return <Redirect href="/estado-membresia" />;

  const limpiar = (campo: Campos) =>
    setErrores((e) => ({ ...e, [campo]: undefined }));

  const elegirFoto = async (origen: 'camara' | 'galeria') => {
    limpiar('foto');
    setFalla(null);
    try {
      if (origen === 'camara') {
        const permiso = await SelectorImagen.requestCameraPermissionsAsync();
        if (!permiso.granted) {
          return setErrores((e) => ({
            ...e,
            foto: t('vehiculos.registro.sin_permiso_camara'),
          }));
        }
      }
      const abrir =
        origen === 'camara'
          ? SelectorImagen.launchCameraAsync
          : SelectorImagen.launchImageLibraryAsync;
      const resultado = await abrir({ mediaTypes: ['images'], quality: 0.7 });
      if (resultado.canceled) return;
      const elegida = resultado.assets[0];
      if (elegida.fileSize && elegida.fileSize > MAXIMO_FOTO_BYTES) {
        return setErrores((e) => ({
          ...e,
          foto: t('vehiculos.registro.foto_invalida'),
        }));
      }
      setFoto({
        uri: elegida.uri,
        tipo: elegida.mimeType ?? 'image/jpeg',
        archivo: elegida.file,
      });
    } catch {
      setFalla({ texto: t('comun.errores.desconocido') });
    }
  };

  const enviar = async () => {
    const texto = (valor: string, requerido: string) =>
      !valor.trim()
        ? requerido
        : valor.trim().length > MAXIMO_TEXTO
          ? t('vehiculos.registro.texto_largo')
          : undefined;
    const asientos = Number(capacidad.trim());
    const nuevos: Errores = {
      placa: !placa.trim()
        ? t('vehiculos.registro.placa_requerida')
        : FORMATO_PLACA.test(normalizarPlaca(placa))
          ? undefined
          : t('vehiculos.registro.placa_invalida'),
      marca: texto(marca, t('vehiculos.registro.marca_requerida')),
      modelo: texto(modelo, t('vehiculos.registro.modelo_requerido')),
      color: texto(color, t('vehiculos.registro.color_requerido')),
      capacidad:
        Number.isInteger(asientos) && asientos >= 1 && asientos <= 6
          ? undefined
          : t('vehiculos.registro.capacidad_invalida'),
      foto: foto ? undefined : t('vehiculos.registro.foto_requerida'),
      consentimiento: consentimiento
        ? undefined
        : t('vehiculos.registro.consentimiento_requerido'),
    };
    setErrores(nuevos);
    setFalla(null);
    if (!foto || Object.values(nuevos).some(Boolean)) return;
    setEnviando(true);
    try {
      setVehiculo(
        await registrarVehiculo({
          placa: placa.trim(),
          marca: marca.trim(),
          modelo: modelo.trim(),
          color: color.trim(),
          capacidad: asientos,
          aceptaUsoFoto: consentimiento,
          foto,
        }),
      );
      setRegistrado(true);
      // La foto ya no se necesita en el teléfono: sale del estado apenas se envía.
      setFoto(null);
    } catch (error) {
      if (
        error instanceof ErrorApi &&
        error.codigo === 'VEHICULO_YA_REGISTRADO'
      ) {
        // Otra sesión lo registró antes: se muestra el que quedó.
        setVehiculo(await consultarMiVehiculo().catch(() => null));
        setFalla({ texto: t('vehiculos.registro.ya_registrado') });
        return;
      }
      const f = fallaDe(error);
      if (f.campo) setErrores({ [f.campo]: f.texto });
      else setFalla(f);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={estilos.raiz}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />
      <View style={[estilos.encabezado, { paddingTop: top }]}>
        <BotonIcono
          icono="arrow_back"
          etiqueta={t('comun.acciones.volver')}
          alPresionar={() => router.back()}
        />
        <Text style={estilos.tituloBarra} accessibilityRole="header">
          {t('vehiculos.registro.titulo')}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={estilos.contenido}
        keyboardShouldPersistTaps="handled"
      >
        {registrado && (
          <Aviso tono="exito">{t('vehiculos.registro.registrado')}</Aviso>
        )}
        {falla && <Aviso tono="peligro">{falla.texto}</Aviso>}
        {consultando ? (
          <Text style={estilos.texto}>{t('comun.estados.cargando')}</Text>
        ) : sinConsulta ? (
          <Boton
            variante="secundario"
            icono="refresh"
            anchoCompleto
            etiqueta={t('comun.acciones.reintentar')}
            alPresionar={reintentar}
          />
        ) : vehiculo ? (
          <>
            <View style={estilos.tarjeta}>
              <Dato
                destacado
                etiqueta={t('vehiculos.registro.placa')}
                valor={vehiculo.placa}
              />
              <View style={estilos.rejilla}>
                <Dato
                  etiqueta={t('vehiculos.registro.marca')}
                  valor={vehiculo.marca}
                />
                <Dato
                  etiqueta={t('vehiculos.registro.modelo')}
                  valor={vehiculo.modelo}
                />
                <Dato
                  etiqueta={t('vehiculos.registro.color')}
                  valor={vehiculo.color}
                />
                <Dato
                  etiqueta={t('vehiculos.registro.capacidad')}
                  valor={
                    vehiculo.capacidad === 1
                      ? t('vehiculos.registro.asiento')
                      : t('vehiculos.registro.asientos').replace(
                          '{cantidad}',
                          String(vehiculo.capacidad),
                        )
                  }
                />
              </View>
            </View>
            <Text style={estilos.texto}>
              {t('vehiculos.registro.privacidad')}
            </Text>
          </>
        ) : (
          <>
            <Text style={estilos.texto}>
              {t('vehiculos.registro.explicacion')}
            </Text>
            <Campo
              etiqueta={t('vehiculos.registro.placa')}
              ayuda={t('vehiculos.registro.placa_ayuda')}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="next"
              value={placa}
              onChangeText={(v) => {
                setPlaca(v);
                limpiar('placa');
              }}
              error={errores.placa}
            />
            <Campo
              etiqueta={t('vehiculos.registro.marca')}
              autoCapitalize="words"
              returnKeyType="next"
              value={marca}
              onChangeText={(v) => {
                setMarca(v);
                limpiar('marca');
              }}
              error={errores.marca}
            />
            <Campo
              etiqueta={t('vehiculos.registro.modelo')}
              autoCapitalize="words"
              returnKeyType="next"
              value={modelo}
              onChangeText={(v) => {
                setModelo(v);
                limpiar('modelo');
              }}
              error={errores.modelo}
            />
            <Campo
              etiqueta={t('vehiculos.registro.color')}
              autoCapitalize="words"
              returnKeyType="next"
              value={color}
              onChangeText={(v) => {
                setColor(v);
                limpiar('color');
              }}
              error={errores.color}
            />
            <Campo
              etiqueta={t('vehiculos.registro.capacidad')}
              ayuda={t('vehiculos.registro.capacidad_ayuda')}
              keyboardType="number-pad"
              maxLength={1}
              returnKeyType="done"
              value={capacidad}
              onChangeText={(v) => {
                setCapacidad(v);
                limpiar('capacidad');
              }}
              error={errores.capacidad}
            />
            <View style={estilos.foto}>
              <Text style={estilos.etiquetaFoto}>
                {t('vehiculos.registro.foto')}
              </Text>
              {foto && (
                <Image
                  source={{ uri: foto.uri }}
                  style={estilos.previa}
                  contentFit="cover"
                  accessibilityLabel={t('vehiculos.registro.foto_previa')}
                />
              )}
              <Boton
                variante="secundario"
                icono="photo_camera"
                anchoCompleto
                etiqueta={t(
                  foto
                    ? 'vehiculos.registro.cambiar_foto'
                    : 'vehiculos.registro.tomar_foto',
                )}
                alPresionar={() => elegirFoto('camara')}
              />
              <Boton
                variante="texto"
                icono="photo_library"
                anchoCompleto
                etiqueta={t('vehiculos.registro.elegir_foto')}
                alPresionar={() => elegirFoto('galeria')}
              />
              {errores.foto && (
                <Text accessibilityRole="alert" style={estilos.errorFoto}>
                  {errores.foto}
                </Text>
              )}
            </View>
            <Casilla
              etiqueta={t('vehiculos.registro.consentimiento')}
              marcada={consentimiento}
              alCambiar={(v) => {
                setConsentimiento(v);
                limpiar('consentimiento');
              }}
              error={errores.consentimiento}
            />
          </>
        )}
      </ScrollView>
      {!consultando && !sinConsulta && !vehiculo && (
        <ZonaAccion>
          <Boton
            anchoCompleto
            cargando={enviando}
            etiqueta={t(
              enviando
                ? 'vehiculos.registro.registrando'
                : 'vehiculos.registro.registrar',
            )}
            alPresionar={enviar}
          />
        </ZonaAccion>
      )}
    </KeyboardAvoidingView>
  );
}

function Dato({
  etiqueta,
  valor,
  destacado,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <View style={destacado ? estilos.datoDestacado : estilos.dato}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <Text style={destacado ? estilos.placa : estilos.valor}>{valor}</Text>
    </View>
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
  tarjeta: {
    padding: espacio(4),
    gap: espacio(3),
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
    ...sombraTarjeta,
  },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', rowGap: espacio(4) },
  dato: { gap: 2, width: '50%' },
  datoDestacado: {
    gap: espacio(1),
    paddingBottom: espacio(4),
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  placa: {
    ...tipografia.titulo,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: 2,
    color: colores.texto,
  },
  etiqueta: { ...tipografia.etiqueta, color: colores.textoSecundario },
  valor: { ...tipografia.cuerpo, color: colores.texto },
  foto: { gap: espacio(2) },
  etiquetaFoto: { ...tipografia.etiqueta, color: colores.texto },
  previa: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radio.m,
    backgroundColor: colores.fondoSutil,
  },
  errorFoto: { ...tipografia.secundario, color: colores.peligro },
});

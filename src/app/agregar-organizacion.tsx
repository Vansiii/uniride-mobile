import { StatusBar } from 'expo-status-bar';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorApi, solicitarOrganizacion } from '@/api/cliente';
import { useSesion } from '@/contexto/sesion';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { ZonaAccion } from '@/componentes/Estructura';
import { Aviso } from '@/componentes/Mensajes';
import { formatearHora, t } from '@/i18n';
import { colores, espacio, tipografia } from '@/tema/tokens';

interface Falla {
  /** Error del campo correo; si no, va en el aviso sobre el formulario. */
  enCampo: boolean;
  texto: string;
  /** Ya hay un código vigente para ese correo: se ofrece ingresarlo. */
  codigoVigente?: boolean;
  reenviarEn?: string;
}

/** Traduce el `codigo` de la API; nunca muestra códigos técnicos (DESIGN_SYSTEM §13.4). */
function fallaDe(error: unknown): Falla {
  if (!(error instanceof ErrorApi))
    return { enCampo: false, texto: t('comun.errores.desconocido') };
  switch (error.codigo) {
    case 'ORGANIZACION_NO_AFILIADA':
      return {
        enCampo: true,
        texto: t('autenticacion.registro.organizacion_no_afiliada'),
      };
    case 'YA_ES_MIEMBRO':
      return { enCampo: true, texto: t('membresias.agregar.ya_es_miembro') };
    case 'MEMBRESIA_RECHAZADA':
      return {
        enCampo: true,
        texto: t('membresias.agregar.membresia_rechazada'),
      };
    case 'CORREO_EN_USO':
      return { enCampo: true, texto: t('membresias.agregar.correo_en_uso') };
    case 'OTP_LIMITE_REENVIO':
      return {
        enCampo: false,
        texto: t('autenticacion.registro.codigo_reciente').replace(
          '{hora}',
          formatearHora(error.datos.reenviarEn),
        ),
        codigoVigente: true,
        reenviarEn: String(error.datos.reenviarEn),
      };
    case 'SIN_CONEXION':
      return { enCampo: false, texto: t('comun.errores.sin_conexion') };
    default:
      return { enCampo: false, texto: t('comun.errores.desconocido') };
  }
}

/** Modal para sumar otra organización (HU-07 CA-1): el correo lleva a la pantalla Código de HU-05. */
export default function AgregarOrganizacion() {
  const { cargando, usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const [correo, setCorreo] = useState('');
  const [errorCorreo, setErrorCorreo] = useState<string>();
  const [falla, setFalla] = useState<Falla | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;

  const irACodigo = (reenviarEn?: string) =>
    router.push({
      pathname: '/codigo',
      params: {
        correo: correo.trim(),
        proposito: 'agregar_organizacion',
        ...(reenviarEn ? { reenviarEn } : {}),
      },
    });

  const enviar = async () => {
    setFalla(null);
    if (!/^\S+@\S+\.\S+$/.test(correo.trim())) {
      return setErrorCorreo(t('autenticacion.sesion.correo_invalido'));
    }
    setErrorCorreo(undefined);
    setEnviando(true);
    try {
      const { reenviarEn } = await solicitarOrganizacion(correo.trim());
      irACodigo(reenviarEn);
    } catch (error) {
      const f = fallaDe(error);
      if (f.enCampo) setErrorCorreo(f.texto);
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
          icono="close"
          etiqueta={t('comun.acciones.cerrar')}
          alPresionar={() => router.back()}
        />
        <Text style={estilos.tituloBarra} accessibilityRole="header">
          {t('membresias.agregar.titulo')}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={estilos.contenido}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={estilos.texto}>{t('membresias.agregar.explicacion')}</Text>
        {falla && (
          <Aviso tono={falla.codigoVigente ? 'info' : 'peligro'}>
            {falla.texto}
          </Aviso>
        )}
        {falla?.codigoVigente && (
          <Boton
            variante="texto"
            etiqueta={t('autenticacion.registro.ingresar_codigo')}
            alPresionar={() => irACodigo(falla.reenviarEn)}
          />
        )}
        <Campo
          etiqueta={t('membresias.agregar.correo')}
          ayuda={t('membresias.agregar.correo_ayuda')}
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={enviar}
          value={correo}
          onChangeText={(v) => {
            setCorreo(v);
            setErrorCorreo(undefined);
          }}
          error={errorCorreo}
        />
      </ScrollView>
      <ZonaAccion>
        <Boton
          anchoCompleto
          cargando={enviando}
          etiqueta={t(
            enviando
              ? 'membresias.agregar.enviando'
              : 'membresias.agregar.enviar',
          )}
          alPresionar={enviar}
        />
      </ZonaAccion>
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
});

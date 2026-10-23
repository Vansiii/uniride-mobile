import { Image } from 'expo-image';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ErrorApi } from '@/api/cliente';
import { useSesion } from '@/contexto/sesion';
import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { BandaMarca, ZonaAccion } from '@/componentes/Estructura';
import { Aviso } from '@/componentes/Mensajes';
import { t } from '@/i18n';
import { colores, espacio, tipografia } from '@/tema/tokens';

interface Falla {
  texto: string;
  bloqueada?: boolean;
}

/** Traduce el `codigo` de la API; nunca muestra códigos técnicos (DESIGN_SYSTEM §13.4). */
function fallaDe(error: unknown): Falla {
  if (!(error instanceof ErrorApi))
    return { texto: t('comun.errores.desconocido') };
  switch (error.codigo) {
    case 'CREDENCIALES_INVALIDAS':
      return { texto: t('autenticacion.sesion.credenciales_invalidas') };
    case 'SESION_BLOQUEADA': {
      const hora = new Date(
        String(error.datos.reintentarEn),
      ).toLocaleTimeString('es-BO', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
      return {
        texto: t('autenticacion.sesion.bloqueada').replace('{hora}', hora),
        bloqueada: true,
      };
    }
    case 'SIN_CONEXION':
      return { texto: t('comun.errores.sin_conexion') };
    default:
      return { texto: t('comun.errores.desconocido') };
  }
}

export default function IniciarSesion() {
  const { usuario, iniciar } = useSesion();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [errores, setErrores] = useState<{
    correo?: string;
    contrasena?: string;
  }>({});
  const [falla, setFalla] = useState<Falla | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Redirect href="/" />;

  const enviar = async () => {
    const nuevos = {
      correo: /^\S+@\S+\.\S+$/.test(correo.trim())
        ? undefined
        : t('autenticacion.sesion.correo_invalido'),
      contrasena: contrasena
        ? undefined
        : t('autenticacion.sesion.contrasena_requerida'),
    };
    setErrores(nuevos);
    setFalla(null);
    if (nuevos.correo || nuevos.contrasena) return;
    setEnviando(true);
    try {
      await iniciar(correo.trim(), contrasena);
    } catch (error) {
      setFalla(fallaDe(error));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={estilos.raiz}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={estilos.desplazable}
        keyboardShouldPersistTaps="handled"
      >
        <BandaMarca>
          <Image
            source={require('../../assets/marca/logotipo-blanco.svg')}
            style={estilos.logo}
            contentFit="contain"
            accessibilityLabel={t('aplicacion.nombre')}
          />
          <Text style={estilos.eslogan}>{t('aplicacion.eslogan')}</Text>
        </BandaMarca>
        <View style={estilos.contenido}>
          <View style={estilos.encabezado}>
            <Text style={estilos.titulo} accessibilityRole="header">
              {t('autenticacion.sesion.titulo')}
            </Text>
            <Text style={estilos.subtitulo}>
              {t('autenticacion.sesion.subtitulo')}
            </Text>
          </View>
          {falla && (
            <Aviso
              tono={falla.bloqueada ? 'aviso' : 'peligro'}
              titulo={
                falla.bloqueada
                  ? t('autenticacion.sesion.bloqueada_titulo')
                  : undefined
              }
            >
              {falla.texto}
            </Aviso>
          )}
          <Campo
            etiqueta={t('autenticacion.sesion.correo')}
            placeholder={t('autenticacion.sesion.correo_ejemplo')}
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            value={correo}
            onChangeText={(v) => {
              setCorreo(v);
              setErrores((e) => ({ ...e, correo: undefined }));
            }}
            error={errores.correo}
          />
          <Campo
            etiqueta={t('autenticacion.sesion.contrasena')}
            secureTextEntry
            autoComplete="current-password"
            autoCapitalize="none"
            returnKeyType="go"
            onSubmitEditing={enviar}
            value={contrasena}
            onChangeText={(v) => {
              setContrasena(v);
              setErrores((e) => ({ ...e, contrasena: undefined }));
            }}
            error={errores.contrasena}
          />
        </View>
      </ScrollView>
      <ZonaAccion>
        <Boton
          anchoCompleto
          cargando={enviando}
          etiqueta={t(
            enviando
              ? 'autenticacion.sesion.entrando'
              : 'autenticacion.sesion.entrar',
          )}
          alPresionar={enviar}
        />
      </ZonaAccion>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondo },
  desplazable: { flexGrow: 1 },
  logo: { width: 128, height: 31, marginBottom: espacio(2) },
  eslogan: {
    ...tipografia.titulo,
    fontWeight: '700',
    color: colores.sobreMarca,
    maxWidth: 280,
  },
  contenido: {
    padding: espacio(4),
    paddingTop: espacio(6),
    gap: espacio(4),
  },
  encabezado: { gap: espacio(1) },
  titulo: { ...tipografia.pantalla, color: colores.texto },
  subtitulo: { ...tipografia.secundario, color: colores.textoSecundario },
});

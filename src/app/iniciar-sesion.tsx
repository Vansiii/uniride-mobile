import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  Image,
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
import { t } from '@/i18n';
import { colores, radio, tipografia } from '@/tema/tokens';

/** Traduce el `codigo` de la API; nunca muestra códigos técnicos (DESIGN_SYSTEM §13.4). */
function mensajeDe(error: unknown): string {
  if (!(error instanceof ErrorApi)) return t('comun.errores.desconocido');
  switch (error.codigo) {
    case 'CREDENCIALES_INVALIDAS':
      return t('autenticacion.sesion.credenciales_invalidas');
    case 'SESION_BLOQUEADA': {
      const hora = new Date(
        String(error.datos.reintentarEn),
      ).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
      return t('autenticacion.sesion.bloqueada').replace('{hora}', hora);
    }
    case 'SIN_CONEXION':
      return t('comun.errores.sin_conexion');
    default:
      return t('comun.errores.desconocido');
  }
}

export default function IniciarSesion() {
  const { usuario, iniciar } = useSesion();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [verContrasena, setVerContrasena] = useState(false);
  const [errores, setErrores] = useState<{
    correo?: string;
    contrasena?: string;
  }>({});
  const [falla, setFalla] = useState<string | null>(null);
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
      setFalla(mensajeDe(error));
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
        contentContainerStyle={estilos.contenido}
        keyboardShouldPersistTaps="handled"
      >
        <View style={estilos.marca}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={estilos.icono}
            accessibilityLabel={t('aplicacion.nombre')}
          />
          <Text style={estilos.eslogan}>{t('aplicacion.eslogan')}</Text>
        </View>
        <Text style={estilos.titulo} accessibilityRole="header">
          {t('autenticacion.sesion.titulo')}
        </Text>
        <Text style={estilos.subtitulo}>
          {t('autenticacion.sesion.subtitulo')}
        </Text>
        {falla && (
          <View style={estilos.falla} accessibilityRole="alert">
            <Text style={estilos.textoFalla}>{falla}</Text>
          </View>
        )}
        <Campo
          etiqueta={t('autenticacion.sesion.correo')}
          placeholder={t('autenticacion.sesion.correo_ejemplo')}
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          value={correo}
          onChangeText={setCorreo}
          error={errores.correo}
        />
        <Campo
          etiqueta={t('autenticacion.sesion.contrasena')}
          secureTextEntry={!verContrasena}
          autoComplete="current-password"
          autoCapitalize="none"
          value={contrasena}
          onChangeText={setContrasena}
          error={errores.contrasena}
        />
        <Boton
          variante="texto"
          etiqueta={t(
            verContrasena
              ? 'autenticacion.sesion.ocultar_contrasena'
              : 'autenticacion.sesion.mostrar_contrasena',
          )}
          alPresionar={() => setVerContrasena(!verContrasena)}
        />
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 16, gap: 16, flexGrow: 1, justifyContent: 'center' },
  marca: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: radio.l,
    backgroundColor: colores.primario,
  },
  icono: { width: 72, height: 72, borderRadius: 16 },
  eslogan: {
    ...tipografia.cuerpoEnfasis,
    color: colores.sobrePrimario,
    textAlign: 'center',
  },
  subtitulo: {
    ...tipografia.secundario,
    color: colores.textoSecundario,
    marginTop: -8,
  },
  titulo: { ...tipografia.pantalla, color: colores.texto },
  falla: {
    padding: 12,
    borderRadius: radio.m,
    backgroundColor: colores.peligroSuave,
  },
  textoFalla: { ...tipografia.secundario, color: colores.peligroTexto },
});

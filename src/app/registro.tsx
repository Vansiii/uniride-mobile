import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { ErrorApi, registrar } from '@/api/cliente';
import { useSesion } from '@/contexto/sesion';
import { Entra } from '@/componentes/Animado';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { Casilla } from '@/componentes/Casilla';
import { BandaMarca, ZonaAccion } from '@/componentes/Estructura';
import { Aviso } from '@/componentes/Mensajes';
import { formatearHora, t } from '@/i18n';
import {
  colores,
  espacio,
  radio,
  sombraElevada,
  tipografia,
} from '@/tema/tokens';

type Campos = 'nombre' | 'correo' | 'contrasena' | 'consentimiento';
type Errores = Partial<Record<Campos, string>>;

interface Falla {
  /** Error de un campo concreto; si no hay, va en el aviso sobre el formulario. */
  campo?: Campos;
  texto: string;
  /** Ya hay un código vigente para ese correo (RN-4). */
  codigoVigente?: boolean;
}

/** Traduce el `codigo` de la API; nunca muestra códigos técnicos (DESIGN_SYSTEM §13.4). */
function fallaDe(error: unknown): Falla {
  if (!(error instanceof ErrorApi))
    return { texto: t('comun.errores.desconocido') };
  switch (error.codigo) {
    case 'ORGANIZACION_NO_AFILIADA':
      return {
        campo: 'correo',
        texto: t('autenticacion.registro.organizacion_no_afiliada'),
      };
    case 'CONTRASENA_DEBIL':
      return {
        campo: 'contrasena',
        texto: t('autenticacion.registro.contrasena_debil'),
      };
    case 'CONSENTIMIENTO_REQUERIDO':
      return {
        campo: 'consentimiento',
        texto: t('autenticacion.registro.consentimiento_requerido'),
      };
    case 'OTP_LIMITE_REENVIO':
      return {
        texto: t('autenticacion.registro.codigo_reciente').replace(
          '{hora}',
          formatearHora(error.datos.reenviarEn),
        ),
        codigoVigente: true,
      };
    case 'CORREO_NO_DISPONIBLE':
      return { texto: t('autenticacion.registro.correo_no_disponible') };
    case 'SIN_CONEXION':
      return { texto: t('comun.errores.sin_conexion') };
    default:
      return { texto: t('comun.errores.desconocido') };
  }
}

export default function Registro() {
  const { usuario } = useSesion();
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [consentimiento, setConsentimiento] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [falla, setFalla] = useState<Falla | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Redirect href="/" />;

  const limpiar = (campo: Campos) =>
    setErrores((e) => ({ ...e, [campo]: undefined }));

  const irACodigo = (reenviarEn?: string) =>
    router.push({
      pathname: '/codigo',
      params: { correo: correo.trim(), ...(reenviarEn ? { reenviarEn } : {}) },
    });

  const enviar = async () => {
    const nuevos: Errores = {
      nombre: nombre.trim()
        ? undefined
        : t('autenticacion.registro.nombre_requerido'),
      correo: /^\S+@\S+\.\S+$/.test(correo.trim())
        ? undefined
        : t('autenticacion.sesion.correo_invalido'),
      contrasena: /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/.test(contrasena)
        ? undefined
        : t('autenticacion.registro.contrasena_debil'),
      consentimiento: consentimiento
        ? undefined
        : t('autenticacion.registro.consentimiento_requerido'),
    };
    setErrores(nuevos);
    setFalla(null);
    if (Object.values(nuevos).some(Boolean)) return;
    setEnviando(true);
    try {
      const { reenviarEn } = await registrar({
        nombreCompleto: nombre.trim(),
        correo: correo.trim(),
        contrasena,
        aceptaTratamientoDatos: consentimiento,
      });
      irACodigo(reenviarEn);
    } catch (error) {
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
      <ScrollView
        contentContainerStyle={estilos.desplazable}
        keyboardShouldPersistTaps="handled"
      >
        <BandaMarca>
          <BotonIcono
            icono="arrow_back"
            etiqueta={t('comun.acciones.volver')}
            color={colores.sobreMarca}
            alPresionar={() => router.back()}
          />
          <Text style={estilos.titulo} accessibilityRole="header">
            {t('autenticacion.registro.titulo')}
          </Text>
          <Text style={estilos.subtitulo}>
            {t('autenticacion.registro.subtitulo')}
          </Text>
        </BandaMarca>
        <Entra indice={1} style={estilos.contenido}>
          {falla && (
            <Aviso tono={falla.codigoVigente ? 'info' : 'peligro'}>
              {falla.texto}
            </Aviso>
          )}
          {falla?.codigoVigente && (
            <Boton
              variante="texto"
              etiqueta={t('autenticacion.registro.ingresar_codigo')}
              alPresionar={() => irACodigo()}
            />
          )}
          <Campo
            etiqueta={t('autenticacion.registro.nombre')}
            autoComplete="name"
            autoCapitalize="words"
            returnKeyType="next"
            value={nombre}
            onChangeText={(v) => {
              setNombre(v);
              limpiar('nombre');
            }}
            error={errores.nombre}
          />
          <Campo
            etiqueta={t('autenticacion.registro.correo')}
            placeholder={t('autenticacion.sesion.correo_ejemplo')}
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            value={correo}
            onChangeText={(v) => {
              setCorreo(v);
              limpiar('correo');
            }}
            error={errores.correo}
          />
          <Campo
            etiqueta={t('autenticacion.registro.contrasena')}
            ayuda={t('autenticacion.registro.contrasena_ayuda')}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
            returnKeyType="go"
            onSubmitEditing={enviar}
            value={contrasena}
            onChangeText={(v) => {
              setContrasena(v);
              limpiar('contrasena');
            }}
            error={errores.contrasena}
          />
          <Casilla
            etiqueta={t('autenticacion.registro.consentimiento')}
            marcada={consentimiento}
            alCambiar={(v) => {
              setConsentimiento(v);
              limpiar('consentimiento');
            }}
            error={errores.consentimiento}
          />
        </Entra>
      </ScrollView>
      <ZonaAccion>
        <Boton
          anchoCompleto
          cargando={enviando}
          etiqueta={t(
            enviando
              ? 'autenticacion.registro.creando'
              : 'autenticacion.registro.crear',
          )}
          alPresionar={enviar}
        />
        <Boton
          variante="texto"
          etiqueta={t('autenticacion.registro.ya_tengo_cuenta')}
          alPresionar={() => router.replace('/iniciar-sesion')}
        />
      </ZonaAccion>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondoSutil },
  desplazable: { flexGrow: 1, paddingBottom: espacio(4) },
  titulo: { ...tipografia.pantalla, color: colores.sobreMarca },
  subtitulo: {
    ...tipografia.cuerpo,
    color: colores.sobreMarcaSecundario,
    maxWidth: 300,
  },
  contenido: {
    marginTop: -espacio(7),
    marginHorizontal: espacio(4),
    padding: espacio(5),
    gap: espacio(4),
    borderRadius: radio.xl,
    backgroundColor: colores.superficie,
    ...sombraElevada,
  },
});

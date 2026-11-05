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
  ErrorApi,
  restablecerContrasena,
  solicitarRecuperacion,
} from '@/api/cliente';
import { useSesion } from '@/contexto/sesion';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { CampoCodigo } from '@/componentes/CampoCodigo';
import { ZonaAccion } from '@/componentes/Estructura';
import { Ilustracion } from '@/componentes/Ilustracion';
import { Aviso } from '@/componentes/Mensajes';
import { formatearHora, t } from '@/i18n';
import { colores, espacio, tipografia } from '@/tema/tokens';

type Paso = 'correo' | 'nueva' | 'listo';

interface Mensaje {
  tono: 'info' | 'aviso' | 'peligro';
  titulo?: string;
  texto: string;
  /** El código venció: se ofrece pedir uno nuevo en el mismo aviso. */
  ofrecerReenvio?: boolean;
}

/** Segundos que faltan para `hasta` (ms); 0 si ya pasó o no hay plazo. */
const segundosHasta = (hasta: number, ahora: number) =>
  Math.max(0, Math.ceil((hasta - ahora) / 1000));

/** Mismos requisitos que el registro (RN-2); el servidor vuelve a validar. */
const esContrasenaSegura = (contrasena: string) =>
  /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/.test(contrasena);

/**
 * Recuperar contraseña (HU-34): correo → código y contraseña nueva. Nada de lo que muestra depende de que
 * el correo tenga cuenta (CA-2, RN-4): la respuesta del servidor es la misma en ambos casos.
 */
export default function Recuperar() {
  const { usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const [paso, setPaso] = useState<Paso>('correo');
  const [correo, setCorreo] = useState('');
  const [errorCorreo, setErrorCorreo] = useState<string>();
  const [codigo, setCodigo] = useState('');
  const [errorCodigo, setErrorCodigo] = useState<string>();
  const [contrasena, setContrasena] = useState('');
  const [errorContrasena, setErrorContrasena] = useState<string>();
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [hasta, setHasta] = useState(0);
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (usuario) return <Redirect href="/" />;

  const segundos = segundosHasta(hasta, ahora);

  /** Traduce el `codigo` de la API; nunca muestra códigos técnicos (DESIGN_SYSTEM §13.4). */
  const mostrarFalla = (error: unknown) => {
    if (error instanceof ErrorApi) {
      switch (error.codigo) {
        case 'OTP_INVALIDO':
          return setErrorCodigo(t('autenticacion.otp.invalido'));
        case 'OTP_VENCIDO':
          return setMensaje({
            tono: 'aviso',
            texto: t('autenticacion.otp.vencido'),
            ofrecerReenvio: true,
          });
        case 'OTP_BLOQUEADO':
          setBloqueado(true);
          return setMensaje({
            tono: 'aviso',
            titulo: t('autenticacion.recuperacion.bloqueado_titulo'),
            texto: t('autenticacion.otp.bloqueado').replace(
              '{hora}',
              formatearHora(error.datos.reintentarEn),
            ),
          });
        case 'CONTRASENA_DEBIL':
          return setErrorContrasena(
            t('autenticacion.registro.contrasena_debil'),
          );
        case 'SIN_CONEXION':
          return setMensaje({
            tono: 'peligro',
            texto: t('comun.errores.sin_conexion'),
          });
      }
    }
    setMensaje({ tono: 'peligro', texto: t('comun.errores.desconocido') });
  };

  /** Pide el código (paso 1) o uno nuevo (paso 2); `OTP_LIMITE_REENVIO` se ve igual que un envío (RN-4). */
  const pedirCodigo = async (): Promise<boolean> => {
    try {
      const { reenviarEn } = await solicitarRecuperacion(correo.trim());
      setHasta(new Date(reenviarEn).getTime());
      setAhora(Date.now());
      return true;
    } catch (error) {
      if (error instanceof ErrorApi && error.codigo === 'OTP_LIMITE_REENVIO') {
        setHasta(new Date(String(error.datos.reenviarEn)).getTime());
        setAhora(Date.now());
        return true;
      }
      mostrarFalla(error);
      return false;
    }
  };

  const enviarCorreo = async () => {
    setMensaje(null);
    if (!/^\S+@\S+\.\S+$/.test(correo.trim())) {
      return setErrorCorreo(t('autenticacion.sesion.correo_invalido'));
    }
    setErrorCorreo(undefined);
    setEnviando(true);
    if (await pedirCodigo()) setPaso('nueva');
    setEnviando(false);
  };

  const reenviar = async () => {
    setErrorCodigo(undefined);
    setMensaje(null);
    setReenviando(true);
    if (await pedirCodigo()) setCodigo('');
    setReenviando(false);
  };

  const cambiar = async () => {
    setMensaje(null);
    const nuevos = {
      codigo:
        codigo.length === 6
          ? undefined
          : t('autenticacion.recuperacion.codigo_requerido'),
      contrasena: esContrasenaSegura(contrasena)
        ? undefined
        : t('autenticacion.registro.contrasena_debil'),
    };
    setErrorCodigo(nuevos.codigo);
    setErrorContrasena(nuevos.contrasena);
    if (nuevos.codigo || nuevos.contrasena) return;
    setEnviando(true);
    try {
      await restablecerContrasena(correo.trim(), codigo, contrasena);
      setContrasena('');
      setPaso('listo');
    } catch (error) {
      mostrarFalla(error);
    } finally {
      setEnviando(false);
    }
  };

  const volver = () => {
    if (paso === 'nueva') {
      setMensaje(null);
      setBloqueado(false);
      return setPaso('correo');
    }
    router.back();
  };

  if (paso === 'listo') {
    return (
      <View style={estilos.raiz}>
        <ScrollView
          contentContainerStyle={[
            estilos.contenido,
            estilos.resultado,
            { paddingTop: top + espacio(6) },
          ]}
        >
          <Ilustracion icono="check_circle" color={colores.exito} />
          <Text style={estilos.titulo} accessibilityRole="header">
            {t('autenticacion.recuperacion.listo_titulo')}
          </Text>
          <Text style={estilos.centrado}>
            {t('autenticacion.recuperacion.listo')}
          </Text>
        </ScrollView>
        <ZonaAccion>
          <Boton
            anchoCompleto
            etiqueta={t('autenticacion.recuperacion.iniciar_sesion')}
            alPresionar={() => router.replace('/iniciar-sesion')}
          />
        </ZonaAccion>
      </View>
    );
  }

  const enPaso1 = paso === 'correo';

  return (
    <KeyboardAvoidingView
      style={estilos.raiz}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[estilos.encabezado, { paddingTop: top }]}>
        <BotonIcono
          icono="arrow_back"
          etiqueta={t('comun.acciones.volver')}
          alPresionar={volver}
        />
        <Text style={estilos.tituloBarra} accessibilityRole="header">
          {t(
            enPaso1
              ? 'autenticacion.recuperacion.titulo'
              : 'autenticacion.recuperacion.titulo_nueva',
          )}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={estilos.contenido}
        keyboardShouldPersistTaps="handled"
      >
        {enPaso1 ? (
          <>
            <Text style={estilos.texto}>
              {t('autenticacion.recuperacion.explicacion')}
            </Text>
            {mensaje && (
              <Aviso tono={mensaje.tono} titulo={mensaje.titulo}>
                {mensaje.texto}
              </Aviso>
            )}
            <Campo
              etiqueta={t('autenticacion.registro.correo')}
              placeholder={t('autenticacion.sesion.correo_ejemplo')}
              keyboardType="email-address"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={enviarCorreo}
              value={correo}
              onChangeText={(v) => {
                setCorreo(v);
                setErrorCorreo(undefined);
              }}
              error={errorCorreo}
            />
          </>
        ) : (
          <>
            <Aviso tono="info">
              {t('autenticacion.recuperacion.solicitud_enviada').replace(
                '{correo}',
                correo.trim(),
              )}
            </Aviso>
            {mensaje && (
              <Aviso tono={mensaje.tono} titulo={mensaje.titulo}>
                {mensaje.texto}
              </Aviso>
            )}
            {mensaje?.ofrecerReenvio && (
              <Boton
                variante="texto"
                cargando={reenviando}
                etiqueta={t('autenticacion.otp.enviar_nuevo')}
                alPresionar={reenviar}
              />
            )}
            <View style={estilos.grupo}>
              <Text style={estilos.etiqueta}>
                {t('autenticacion.recuperacion.codigo')}
              </Text>
              {/* El código no se envía solo: falta la contraseña nueva. */}
              <CampoCodigo
                valor={codigo}
                alCambiar={(v) => {
                  setCodigo(v);
                  setErrorCodigo(undefined);
                }}
                alCompletar={() => undefined}
                error={errorCodigo}
                deshabilitado={bloqueado || enviando}
              />
              <Text style={estilos.vigencia}>
                {t('autenticacion.recuperacion.vigencia')}
              </Text>
            </View>
            <Campo
              etiqueta={t('autenticacion.recuperacion.contrasena_nueva')}
              ayuda={t('autenticacion.registro.contrasena_ayuda')}
              secureTextEntry
              autoComplete="new-password"
              autoCapitalize="none"
              returnKeyType="go"
              onSubmitEditing={cambiar}
              editable={!bloqueado}
              value={contrasena}
              onChangeText={(v) => {
                setContrasena(v);
                setErrorContrasena(undefined);
              }}
              error={errorContrasena}
            />
            <Aviso tono="aviso">
              {t('autenticacion.recuperacion.sesiones')}
            </Aviso>
            <View style={estilos.reenvio}>
              {segundos > 0 ? (
                <Text style={estilos.cuenta}>
                  {t('autenticacion.otp.reenviar_en').replace(
                    '{segundos}',
                    String(segundos),
                  )}
                </Text>
              ) : (
                !mensaje?.ofrecerReenvio && (
                  <Boton
                    variante="texto"
                    cargando={reenviando}
                    etiqueta={t('autenticacion.otp.reenviar')}
                    alPresionar={reenviar}
                  />
                )
              )}
            </View>
          </>
        )}
      </ScrollView>
      <ZonaAccion>
        {enPaso1 ? (
          <Boton
            anchoCompleto
            cargando={enviando}
            etiqueta={t(
              enviando
                ? 'autenticacion.recuperacion.enviando'
                : 'autenticacion.recuperacion.enviar_codigo',
            )}
            alPresionar={enviarCorreo}
          />
        ) : (
          <Boton
            anchoCompleto
            cargando={enviando}
            etiqueta={t(
              enviando
                ? 'autenticacion.recuperacion.cambiando'
                : 'autenticacion.recuperacion.cambiar',
            )}
            alPresionar={cambiar}
          />
        )}
      </ZonaAccion>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondo },
  encabezado: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(1),
    paddingHorizontal: espacio(2),
  },
  tituloBarra: { ...tipografia.titulo, color: colores.texto },
  contenido: {
    flexGrow: 1,
    gap: espacio(4),
    paddingHorizontal: espacio(4),
    paddingVertical: espacio(4),
  },
  resultado: { alignItems: 'center' },
  titulo: {
    ...tipografia.pantalla,
    color: colores.texto,
    textAlign: 'center',
  },
  texto: { ...tipografia.cuerpo, color: colores.textoSecundario },
  centrado: {
    ...tipografia.cuerpo,
    color: colores.textoSecundario,
    textAlign: 'center',
  },
  grupo: { gap: espacio(2) },
  etiqueta: { ...tipografia.cuerpoEnfasis, color: colores.texto },
  vigencia: {
    ...tipografia.secundario,
    color: colores.textoSecundario,
    textAlign: 'center',
  },
  reenvio: { alignItems: 'center' },
  cuenta: {
    ...tipografia.cuerpoEnfasis,
    fontVariant: ['tabular-nums'],
    color: colores.textoDeshabilitado,
  },
});

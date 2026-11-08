import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorApi, PropositoCodigo, reenviarCodigo } from '@/api/cliente';
import { useSesion } from '@/contexto/sesion';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { CampoCodigo } from '@/componentes/CampoCodigo';
import { Ilustracion } from '@/componentes/Ilustracion';
import { Aviso } from '@/componentes/Mensajes';
import { formatearHora, t } from '@/i18n';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';

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

/** Textos de falla propios de agregar una organización (HU-07). */
const fallasDeOrganizacion: Record<string, string> = {
  YA_ES_MIEMBRO: 'membresias.agregar.ya_es_miembro',
  MEMBRESIA_RECHAZADA: 'membresias.agregar.membresia_rechazada',
  CORREO_EN_USO: 'membresias.agregar.correo_en_uso',
};

/** Pantalla compartida: confirma el correo del registro (HU-05) o el de otra organización (HU-07). */
export default function Codigo() {
  const { cargando, usuario, confirmarCodigo, confirmarOrganizacion } =
    useSesion();
  const { top } = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    correo?: string;
    reenviarEn?: string;
    proposito?: string;
  }>();
  const correo = params.correo ?? '';
  const proposito: PropositoCodigo =
    params.proposito === 'agregar_organizacion'
      ? 'agregar_organizacion'
      : 'registro';
  const agregando = proposito === 'agregar_organizacion';
  const [codigo, setCodigo] = useState('');
  const [errorCodigo, setErrorCodigo] = useState<string>();
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [hasta, setHasta] = useState(() =>
    params.reenviarEn ? new Date(params.reenviarEn).getTime() : 0,
  );
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (agregando) {
    if (cargando) return null;
    if (!usuario) return <Redirect href="/iniciar-sesion" />;
    if (!correo) return <Redirect href="/agregar-organizacion" />;
  } else {
    if (usuario) return <Redirect href="/" />;
    if (!correo) return <Redirect href="/registro" />;
  }

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
            titulo: t(
              agregando
                ? 'membresias.agregar.bloqueado_titulo'
                : 'autenticacion.otp.bloqueado_titulo',
            ),
            texto: t('autenticacion.otp.bloqueado').replace(
              '{hora}',
              formatearHora(error.datos.reintentarEn),
            ),
          });
        case 'OTP_LIMITE_REENVIO':
          setHasta(new Date(String(error.datos.reenviarEn)).getTime());
          return setAhora(Date.now());
        case 'CORREO_NO_DISPONIBLE':
          return setMensaje({
            tono: 'peligro',
            texto: t('autenticacion.registro.correo_no_disponible'),
          });
        case 'SIN_CONEXION':
          return setMensaje({
            tono: 'peligro',
            texto: t('comun.errores.sin_conexion'),
          });
      }
      if (agregando && fallasDeOrganizacion[error.codigo]) {
        return setMensaje({
          tono: 'peligro',
          texto: t(fallasDeOrganizacion[error.codigo]),
        });
      }
    }
    setMensaje({ tono: 'peligro', texto: t('comun.errores.desconocido') });
  };

  const confirmar = async (digitos: string) => {
    setErrorCodigo(undefined);
    setMensaje(null);
    setConfirmando(true);
    try {
      if (agregando) {
        const membresia = await confirmarOrganizacion(correo, digitos);
        // Vuelve a Mis organizaciones sin dejar Agregar ni Código en la pila.
        router.dismissTo({
          pathname: '/organizaciones',
          params: {
            agregada: membresia.estado,
            organizacion: membresia.organizacion,
          },
        });
      } else {
        // Con el código correcto la sesión queda iniciada y esta pantalla redirige a "/".
        await confirmarCodigo(correo, digitos);
      }
    } catch (error) {
      mostrarFalla(error);
    } finally {
      setConfirmando(false);
    }
  };

  const reenviar = async () => {
    setErrorCodigo(undefined);
    setMensaje(null);
    setReenviando(true);
    try {
      const { reenviarEn } = await reenviarCodigo(correo, proposito);
      setCodigo('');
      setHasta(new Date(reenviarEn).getTime());
      setAhora(Date.now());
      setMensaje({ tono: 'info', texto: t('autenticacion.otp.reenviado') });
    } catch (error) {
      mostrarFalla(error);
    } finally {
      setReenviando(false);
    }
  };

  return (
    <View style={estilos.raiz}>
      <View style={[estilos.encabezado, { paddingTop: top }]}>
        <BotonIcono
          icono="arrow_back"
          etiqueta={t('comun.acciones.volver')}
          alPresionar={() => router.back()}
        />
        <Text style={estilos.tituloBarra} accessibilityRole="header">
          {t('autenticacion.otp.titulo')}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={estilos.contenido}
        keyboardShouldPersistTaps="handled"
      >
        <Ilustracion icono="mark_email_read" color={colores.primario} />
        <Text style={estilos.texto}>
          {t('autenticacion.otp.instruccion')}
          {'\n'}
          <Text style={estilos.correo}>{correo}</Text>
        </Text>
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
        <CampoCodigo
          valor={codigo}
          alCambiar={(v) => {
            setCodigo(v);
            setErrorCodigo(undefined);
          }}
          alCompletar={confirmar}
          error={errorCodigo}
          deshabilitado={bloqueado || confirmando}
        />
        <Text style={estilos.vigencia}>{t('autenticacion.otp.vigencia')}</Text>
        <View style={estilos.reenvio}>
          {segundos > 0 ? (
            <View style={estilos.cuenta}>
              <Text style={estilos.textoCuenta}>
                {t('autenticacion.otp.reenviar_en').replace(
                  '{segundos}',
                  String(segundos),
                )}
              </Text>
            </View>
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
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondo },
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
    paddingVertical: espacio(6),
  },
  texto: {
    ...tipografia.cuerpo,
    color: colores.texto,
    textAlign: 'center',
  },
  correo: { ...tipografia.cuerpoEnfasis },
  vigencia: {
    ...tipografia.secundario,
    color: colores.textoSecundario,
    textAlign: 'center',
  },
  reenvio: { alignItems: 'center' },
  // Desactivado por una razón visible al lado (8.2): la cuenta regresiva.
  cuenta: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: espacio(5),
    borderRadius: radio.m,
    backgroundColor: colores.fondoDeshabilitado,
  },
  textoCuenta: {
    ...tipografia.cuerpoEnfasis,
    fontVariant: ['tabular-nums'],
    color: colores.textoDeshabilitado,
  },
});

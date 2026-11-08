import * as Dispositivo from 'expo-device';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  consultarMiDispositivo,
  ErrorApi,
  MiDispositivo,
  pedirDesafioAtestacion,
  vincularDispositivo,
} from '@/api/cliente';
import { Entra, Esqueleto } from '@/componentes/Animado';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { ZonaAccion } from '@/componentes/Estructura';
import { Ilustracion } from '@/componentes/Ilustracion';
import { Aviso } from '@/componentes/Mensajes';
import { useSesion } from '@/contexto/sesion';
import {
  crearLlave,
  ErrorKeystore,
  pedirTokenIntegridad,
} from '@/dispositivo/keystore';
import { t } from '@/i18n';
import {
  colores,
  espacio,
  radio,
  sombraTarjeta,
  tipografia,
} from '@/tema/tokens';

/** Traduce el `codigo` de la API; nunca muestra códigos técnicos (DESIGN_SYSTEM §13.4). */
function textoDe(error: unknown): string {
  if (error instanceof ErrorKeystore)
    return t(
      error.codigo === 'BIOMETRIA_CANCELADA'
        ? 'dispositivo.autenticacion.cancelada'
        : 'dispositivo.vinculacion.keystore_no_disponible',
    );
  if (!(error instanceof ErrorApi)) return t('comun.errores.desconocido');
  switch (error.codigo) {
    case 'DISPOSITIVO_NO_INTEGRO':
      return t('dispositivo.vinculacion.no_integro');
    case 'DISPOSITIVO_YA_VINCULADO':
      return t('dispositivo.vinculacion.ya_vinculado');
    case 'DESAFIO_INVALIDO':
      return t('dispositivo.vinculacion.desafio_invalido');
    case 'LLAVE_INVALIDA':
      return t('dispositivo.vinculacion.llave_invalida');
    case 'SERVICIO_NO_DISPONIBLE':
      return t('dispositivo.vinculacion.servicio_no_disponible');
    case 'SIN_CONEXION':
      return t('comun.errores.sin_conexion');
    default:
      return t('comun.errores.desconocido');
  }
}

/** Vincular teléfono (HU-09): la cuenta queda atada a este teléfono con una llave del Keystore (un dispositivo por cuenta). */
export default function DispositivoPantalla() {
  const { cargando, usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const [consultando, setConsultando] = useState(true);
  const [dispositivo, setDispositivo] = useState<MiDispositivo | null>(null);
  const [sinConsulta, setSinConsulta] = useState(false);
  const [intento, setIntento] = useState(0);
  const [falla, setFalla] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const [recienVinculado, setRecienVinculado] = useState(false);

  useEffect(() => {
    if (cargando || !usuario) return;
    let vigente = true;
    consultarMiDispositivo()
      .then((d) => vigente && setDispositivo(d))
      .catch((error) => {
        if (!vigente) return;
        // Sin saber si ya hay uno no se ofrece vincular a ciegas.
        setSinConsulta(true);
        setFalla(textoDe(error));
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

  const vincular = async () => {
    setFalla(null);
    setVinculando(true);
    try {
      // El desafío es el nonce de la atestación: un token pedido sin él no sirve.
      const { desafio } = await pedirDesafioAtestacion();
      const llavePublicaPem = await crearLlave();
      const tokenIntegridad = await pedirTokenIntegridad(desafio);
      await vincularDispositivo({
        desafio,
        tokenIntegridad,
        llavePublicaPem,
        modelo: Dispositivo.modelName ?? 'Android',
      });
      setDispositivo(await consultarMiDispositivo());
      setRecienVinculado(true);
    } catch (error) {
      if (
        error instanceof ErrorApi &&
        error.codigo === 'DISPOSITIVO_YA_VINCULADO'
      )
        // Otra sesión lo vinculó antes: se muestra el que quedó.
        setDispositivo(await consultarMiDispositivo().catch(() => null));
      setFalla(textoDe(error));
    } finally {
      setVinculando(false);
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
          {t('dispositivo.vinculacion.titulo')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={estilos.contenido}>
        {recienVinculado && (
          <Aviso tono="exito">{t('dispositivo.vinculacion.vinculado')}</Aviso>
        )}
        {falla && <Aviso tono="peligro">{falla}</Aviso>}
        {consultando ? (
          <View accessibilityLabel={t('comun.estados.cargando')}>
            <Esqueleto alto={120} redondeo={radio.l} />
          </View>
        ) : sinConsulta ? (
          <Boton
            variante="secundario"
            icono="refresh"
            anchoCompleto
            etiqueta={t('comun.acciones.reintentar')}
            alPresionar={reintentar}
          />
        ) : dispositivo ? (
          <Entra style={estilos.tarjeta}>
            <View style={estilos.dato}>
              <Text style={estilos.etiqueta}>
                {t('dispositivo.vinculacion.modelo')}
              </Text>
              <Text style={estilos.valor}>{dispositivo.modelo}</Text>
            </View>
            <View style={estilos.dato}>
              <Text style={estilos.etiqueta}>
                {t('dispositivo.vinculacion.vinculado_desde')}
              </Text>
              <Text style={estilos.valor}>
                {new Date(dispositivo.vinculadoEn).toLocaleDateString('es-BO')}
              </Text>
            </View>
          </Entra>
        ) : (
          <Entra style={estilos.hero}>
            <Ilustracion icono="smartphone" color={colores.primario} />
            <Text style={estilos.texto}>
              {t('dispositivo.vinculacion.explicacion')}
            </Text>
            <Text style={estilos.texto}>
              {t('dispositivo.vinculacion.privacidad')}
            </Text>
          </Entra>
        )}
      </ScrollView>
      {!consultando && !sinConsulta && !dispositivo && (
        <ZonaAccion>
          <Boton
            anchoCompleto
            cargando={vinculando}
            etiqueta={t(
              vinculando
                ? 'dispositivo.vinculacion.vinculando'
                : 'dispositivo.vinculacion.vincular',
            )}
            alPresionar={vincular}
          />
        </ZonaAccion>
      )}
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
  hero: { gap: espacio(4) },
  dato: { gap: 2 },
  etiqueta: { ...tipografia.etiqueta, color: colores.textoSecundario },
  valor: { ...tipografia.cuerpo, color: colores.texto },
});

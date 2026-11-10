import { StatusBar } from 'expo-status-bar';
import * as Dispositivo from 'expo-device';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  consultarMiDispositivo,
  ErrorApi,
  MiDispositivo,
  pedirDesafioAtestacion,
  pedirDesafioRevinculacion,
  revincularDispositivo,
  vincularDispositivo,
} from '@/api/cliente';
import { Entra, Esqueleto } from '@/componentes/Animado';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { ZonaAccion } from '@/componentes/Estructura';
import { Ilustracion } from '@/componentes/Ilustracion';
import { Aviso } from '@/componentes/Mensajes';
import { useSesion } from '@/contexto/sesion';
import {
  confirmarLlave,
  crearLlave,
  ErrorKeystore,
  fallaDeLlave,
  pedirTokenIntegridad,
} from '@/dispositivo/keystore';
import { ejecutarLiveness, ErrorLiveness } from '@/identidad/liveness';
import { formatearHora, t } from '@/i18n';
import {
  colores,
  espacio,
  radio,
  sombraTarjeta,
  tipografia,
} from '@/tema/tokens';

/** Traduce el `codigo` de la API; nunca muestra códigos técnicos (DESIGN_SYSTEM §13.4). */
function textoDe(error: unknown): string {
  if (error instanceof ErrorLiveness)
    return t('identidad.verificacion.liveness_no_disponible');
  if (error instanceof ErrorKeystore) {
    if (error.codigo === 'BIOMETRIA_CANCELADA')
      return t('dispositivo.autenticacion.cancelada');
    if (error.codigo === 'KEYSTORE_NO_DISPONIBLE')
      return t('dispositivo.vinculacion.keystore_no_disponible');
    return t(fallaDeLlave(error).clave);
  }
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
    case 'ROSTRO_NO_COINCIDE':
      return t('dispositivo.revincular.rostro_no_coincide');
    case 'PRUEBA_VIDA_FALLIDA':
      return t('identidad.verificacion.prueba_vida_fallida');
    case 'INTENTOS_AGOTADOS':
      return t('identidad.verificacion.intentos_agotados').replace(
        '{hora}',
        formatearHora(error.datos.bloqueadoHasta),
      );
    case 'CONFLICTO_CONCURRENTE':
      return t('dispositivo.revincular.concurrente');
    case 'SERVICIO_NO_DISPONIBLE':
      return t('dispositivo.vinculacion.servicio_no_disponible');
    case 'SIN_CONEXION':
      return t('comun.errores.sin_conexion');
    default:
      return t('comun.errores.desconocido');
  }
}

/**
 * Vincular teléfono (HU-09): la cuenta queda atada a este teléfono con una llave del Keystore (un dispositivo por
 * cuenta). HU-10: volver a vincularlo, o pasar la cuenta a este, con prueba de identidad. `motivo` llega de una firma
 * que falló porque la llave se anuló (huella nueva) o porque este teléfono no la tiene.
 */
export default function DispositivoPantalla() {
  const { cargando, usuario } = useSesion();
  const { motivo } = useLocalSearchParams<{
    motivo?: 'llave_anulada' | 'sin_llave';
  }>();
  const { top } = useSafeAreaInsets();
  const [consultando, setConsultando] = useState(true);
  const [dispositivo, setDispositivo] = useState<MiDispositivo | null>(null);
  const [sinConsulta, setSinConsulta] = useState(false);
  const [intento, setIntento] = useState(0);
  const [falla, setFalla] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const [recienVinculado, setRecienVinculado] = useState(false);
  const [revinculando, setRevinculando] = useState(false);
  const [revinculado, setRevinculado] = useState(false);
  // Con la llave anulada o ausente, volver a vincular es lo único que sirve: va abajo como acción principal.
  const pideRevincular = !!motivo && !revinculado;

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
      await confirmarLlave();
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

  const revincular = async () => {
    setFalla(null);
    // El éxito de una vinculación anterior no debe quedar junto al resultado de esta.
    setRecienVinculado(false);
    setRevinculando(true);
    try {
      const { desafio, requiereIdentidad, sesionLivenessId } =
        await pedirDesafioRevinculacion();
      if (requiereIdentidad && sesionLivenessId) {
        await ejecutarLiveness(sesionLivenessId);
      }
      const llavePublicaPem = await crearLlave();
      const tokenIntegridad = await pedirTokenIntegridad(desafio);
      await revincularDispositivo({
        desafio,
        tokenIntegridad,
        llavePublicaPem,
        modelo: Dispositivo.modelName ?? 'Android',
        sesionLivenessId: requiereIdentidad ? sesionLivenessId : undefined,
      });
      // Solo con el 201 la llave nueva pasa a firmar: un rechazo deja la anterior intacta.
      await confirmarLlave();
      setDispositivo(await consultarMiDispositivo());
      setRevinculado(true);
    } catch (error) {
      if (error instanceof ErrorApi && error.codigo === 'CONFLICTO_CONCURRENTE')
        // Otra revinculación ganó: se muestra el teléfono que quedó.
        setDispositivo(await consultarMiDispositivo().catch(() => null));
      setFalla(textoDe(error));
    } finally {
      setRevinculando(false);
    }
  };

  return (
    <View style={estilos.raiz}>
      <StatusBar style="dark" />
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
        {(recienVinculado || revinculado) && (
          <Aviso tono="exito">{t('dispositivo.vinculacion.vinculado')}</Aviso>
        )}
        {pideRevincular && (
          <Aviso tono="aviso">
            {t(
              motivo === 'llave_anulada'
                ? 'dispositivo.llave_anulada.explicacion'
                : 'dispositivo.revincular.telefono_nuevo',
            )}
          </Aviso>
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
            {!pideRevincular && !revinculado && (
              <Boton
                variante="secundario"
                cargando={revinculando}
                anchoCompleto
                etiqueta={t(
                  revinculando
                    ? 'dispositivo.revincular.revinculando'
                    : 'dispositivo.revincular.boton',
                )}
                alPresionar={revincular}
              />
            )}
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
      {!consultando && !sinConsulta && dispositivo && pideRevincular && (
        <ZonaAccion>
          <Boton
            anchoCompleto
            icono="verified_user"
            cargando={revinculando}
            etiqueta={t(
              revinculando
                ? 'dispositivo.revincular.revinculando'
                : motivo === 'llave_anulada'
                  ? 'dispositivo.llave_anulada.confirmar'
                  : 'dispositivo.revincular.boton',
            )}
            alPresionar={revincular}
          />
        </ZonaAccion>
      )}
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

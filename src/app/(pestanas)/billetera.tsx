import * as Portapapeles from 'expo-clipboard';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Billetera,
  consultarEstadoIdentidad,
  consultarMiBilletera,
  crearBilletera,
  ErrorApi,
} from '@/api/cliente';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { BandaMarca } from '@/componentes/Estructura';
import { Icono } from '@/componentes/Icono';
import { Ilustracion } from '@/componentes/Ilustracion';
import { Aviso } from '@/componentes/Mensajes';
import { useSesion } from '@/contexto/sesion';
import { ErrorKeystore } from '@/dispositivo/keystore';
import { t } from '@/i18n';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';

type Vista =
  | { tipo: 'cargando' }
  /** Identidad sin verificar: la billetera todavía no existe (HU-12 CA-4). */
  | { tipo: 'sin_billetera' }
  /** Sin teléfono vinculado o firma rechazada: hay que vincular (HU-09). */
  | { tipo: 'vincular' }
  | { tipo: 'lista'; billetera: Billetera }
  | {
      tipo: 'falla';
      /** Clave dentro de `billetera.pantalla` o texto común ya resuelto. */
      texto: string;
      tono: 'info' | 'peligro';
      reintentar: boolean;
    };

/** Traduce el error a lo que ve la persona; nunca muestra códigos técnicos (DESIGN_SYSTEM §13.4). */
function vistaDe(error: unknown): Vista {
  const falla = (
    texto: string,
    reintentar = true,
    tono: 'info' | 'peligro' = 'peligro',
  ): Vista => ({
    tipo: 'falla',
    texto,
    tono,
    reintentar,
  });
  if (error instanceof ErrorKeystore)
    // Cancelar la huella es una decisión de la persona, no un error: tono informativo.
    return error.codigo === 'BIOMETRIA_CANCELADA'
      ? falla(t('billetera.pantalla.biometria_cancelada'), true, 'info')
      : falla(t('billetera.pantalla.keystore_no_disponible'), false);
  if (!(error instanceof ErrorApi))
    return falla(t('comun.errores.desconocido'));
  switch (error.codigo) {
    case 'IDENTIDAD_NO_VERIFICADA':
      return { tipo: 'sin_billetera' };
    case 'FIRMA_DISPOSITIVO_INVALIDA':
    case 'DISPOSITIVO_NO_VINCULADO':
      return { tipo: 'vincular' };
    case 'CUENTA_SUSPENDIDA':
      return falla(t('billetera.pantalla.cuenta_suspendida'), false);
    case 'SERVICIO_BLOCKCHAIN_NO_DISPONIBLE':
      return falla(t('billetera.pantalla.servicio_no_disponible'));
    case 'PETICION_EXPIRADA':
      return falla(t('billetera.pantalla.peticion_expirada'));
    case 'SIN_CONEXION':
      return falla(t('comun.errores.sin_conexion'));
    default:
      return error.estado === 503
        ? falla(t('billetera.pantalla.servicio_no_disponible'))
        : falla(t('comun.errores.desconocido'));
  }
}

/** `0x7a3F…9C21`: solo para mirar; lo que se copia es la dirección completa. */
const acortar = (direccion: string) =>
  `${direccion.slice(0, 6)}…${direccion.slice(-4)}`;

/** Billetera (HU-12): saldo URC, dirección pública y enlace al explorador. Lee una vez al entrar y al pulsar actualizar. */
export default function BilleteraPantalla() {
  const { cargando, usuario } = useSesion();
  const [vista, setVista] = useState<Vista>({ tipo: 'cargando' });
  const [copia, setCopia] = useState<'ok' | 'fallo' | null>(null);
  // Cada lectura firmada pide la huella: nunca dos a la vez.
  const enCurso = useRef(false);

  const leer = useCallback(async (): Promise<Vista | null> => {
    if (enCurso.current) return null;
    enCurso.current = true;
    try {
      // Sin identidad verificada el servidor responde 403 sin importar la firma: no se gasta una huella para saberlo.
      if ((await consultarEstadoIdentidad()).estado !== 'verificada')
        return { tipo: 'sin_billetera' };
      // Billetera que aún no existe (la creación automática falló): se reintenta una sola vez.
      const billetera =
        (await consultarMiBilletera()) ?? (await crearBilletera());
      return { tipo: 'lista', billetera };
    } catch (error) {
      return vistaDe(error);
    } finally {
      enCurso.current = false;
    }
  }, []);

  // Solo al entrar con sesión (o si cambia la persona): cambiar de pestaña o de foco no vuelve a leer.
  const personaId = usuario?.id;
  useEffect(() => {
    if (cargando || !personaId) return;
    void leer().then((v) => v && setVista(v));
  }, [cargando, personaId, leer]);

  const actualizar = () => {
    if (enCurso.current) return;
    setVista({ tipo: 'cargando' });
    void leer().then((v) => v && setVista(v));
  };
  useEffect(() => {
    if (!copia) return;
    const espera = setTimeout(() => setCopia(null), 4000);
    return () => clearTimeout(espera);
  }, [copia]);

  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;

  const copiar = async (direccion: string) => {
    try {
      await Portapapeles.setStringAsync(direccion);
      setCopia('ok');
    } catch {
      setCopia('fallo');
    }
  };
  const abrirExplorador = (url: string) => {
    // La URL la arma el servidor; aun así solo se abre https.
    if (url.startsWith('https://')) Linking.openURL(url).catch(() => undefined);
  };

  const billetera = vista.tipo === 'lista' ? vista.billetera : null;
  return (
    <View style={estilos.raiz}>
      <ScrollView contentContainerStyle={estilos.desplazable}>
        <BandaMarca>
          <View style={estilos.filaTitulo}>
            <Text style={estilos.titulo} accessibilityRole="header">
              {t('billetera.pantalla.titulo')}
            </Text>
            {vista.tipo !== 'sin_billetera' && (
              <BotonIcono
                icono="refresh"
                color={colores.sobreMarca}
                etiqueta={t('billetera.pantalla.actualizar')}
                alPresionar={actualizar}
              />
            )}
          </View>
          {billetera && (
            <View style={estilos.saldo}>
              <Text style={estilos.etiquetaSaldo}>
                {t('billetera.pantalla.saldo')}
              </Text>
              <Text
                style={estilos.cifra}
                accessibilityLabel={`${billetera.saldoUrc} ${t('billetera.pantalla.unidad')}`}
              >
                {billetera.saldoUrc}
                <Text style={estilos.unidad}>
                  {' '}
                  {t('billetera.pantalla.unidad')}
                </Text>
              </Text>
              <Text style={estilos.prueba}>
                {t('billetera.pantalla.prueba')}
              </Text>
            </View>
          )}
        </BandaMarca>

        {vista.tipo === 'cargando' && (
          <View style={estilos.centro}>
            <ActivityIndicator
              color={colores.primario}
              size="large"
              accessibilityLabel={t('comun.estados.cargando')}
            />
            <Text style={estilos.secundario}>
              {t('comun.estados.cargando')}
            </Text>
          </View>
        )}

        {vista.tipo === 'sin_billetera' && (
          <View style={estilos.resultado}>
            <Ilustracion
              icono="account_balance_wallet"
              color={colores.primario}
            />
            <Text style={estilos.tituloResultado} accessibilityRole="header">
              {t('billetera.pantalla.sin_billetera_titulo')}
            </Text>
            <Text style={estilos.textoResultado}>
              {t('billetera.pantalla.sin_billetera_texto')}
            </Text>
            <Boton
              icono="verified_user"
              etiqueta={t('billetera.pantalla.verificar')}
              alPresionar={() => router.push('/identidad')}
            />
          </View>
        )}

        {vista.tipo === 'vincular' && (
          <View style={estilos.resultado}>
            <Ilustracion icono="smartphone" color={colores.primario} />
            <Text style={estilos.textoResultado}>
              {t('billetera.pantalla.vincular_texto')}
            </Text>
            <Boton
              icono="smartphone"
              etiqueta={t('billetera.pantalla.vincular')}
              alPresionar={() => router.push('/dispositivo')}
            />
          </View>
        )}

        {vista.tipo === 'falla' && (
          <View style={estilos.bloque}>
            <Aviso tono={vista.tono}>{vista.texto}</Aviso>
            {vista.reintentar && (
              <Boton
                variante="secundario"
                icono="refresh"
                anchoCompleto
                etiqueta={t('comun.acciones.reintentar')}
                alPresionar={actualizar}
              />
            )}
          </View>
        )}

        {billetera && (
          <View style={estilos.bloque}>
            {copia && (
              <Aviso tono={copia === 'ok' ? 'exito' : 'peligro'}>
                {t(
                  copia === 'ok'
                    ? 'billetera.pantalla.copiada'
                    : 'billetera.pantalla.copia_fallida',
                )}
              </Aviso>
            )}
            <View style={estilos.tarjeta}>
              <View style={estilos.fila}>
                <View style={estilos.icono}>
                  <Icono
                    nombre="account_balance_wallet"
                    color={colores.primario}
                  />
                </View>
                <View style={estilos.texto}>
                  <Text style={estilos.secundario}>
                    {t('billetera.pantalla.direccion')}
                  </Text>
                  <Text style={estilos.direccion}>
                    {acortar(billetera.direccion)}
                  </Text>
                </View>
                <BotonIcono
                  icono="content_copy"
                  etiqueta={t('billetera.pantalla.copiar')}
                  alPresionar={() => copiar(billetera.direccion)}
                />
              </View>
              {billetera.exploradorUrl && (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={t('billetera.pantalla.explorador')}
                  onPress={() => abrirExplorador(billetera.exploradorUrl!)}
                  style={estilos.fila}
                >
                  <View style={estilos.icono}>
                    <Icono nombre="open_in_new" color={colores.primario} />
                  </View>
                  <View style={estilos.texto}>
                    <Text style={estilos.enlace}>
                      {t('billetera.pantalla.explorador')}
                    </Text>
                    <Text style={estilos.secundario}>
                      {t('billetera.pantalla.explorador_detalle')}
                    </Text>
                  </View>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondoSutil },
  desplazable: { flexGrow: 1, paddingBottom: espacio(6) },
  filaTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titulo: { ...tipografia.pantalla, color: colores.sobreMarca },
  saldo: { gap: espacio(1) },
  etiquetaSaldo: {
    ...tipografia.secundario,
    color: colores.sobreMarcaSecundario,
  },
  // Cifra del saldo (DESIGN_SYSTEM §4.2): 34/40, 700.
  cifra: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    color: colores.sobreMarca,
  },
  unidad: { ...tipografia.subtitulo, color: colores.sobreMarcaSecundario },
  prueba: { ...tipografia.pequeno, color: colores.sobreMarcaSecundario },
  centro: {
    alignItems: 'center',
    gap: espacio(3),
    paddingVertical: espacio(8),
  },
  resultado: {
    gap: espacio(3),
    alignItems: 'center',
    paddingHorizontal: espacio(6),
    paddingTop: espacio(6),
  },
  tituloResultado: {
    ...tipografia.titulo,
    color: colores.texto,
    textAlign: 'center',
  },
  textoResultado: {
    ...tipografia.cuerpo,
    color: colores.textoSecundario,
    textAlign: 'center',
  },
  bloque: {
    gap: espacio(3),
    marginTop: espacio(4),
    marginHorizontal: espacio(4),
  },
  tarjeta: {
    gap: espacio(2),
    padding: espacio(3),
    borderRadius: radio.l,
    backgroundColor: colores.superficie,
    elevation: 3,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(3),
    minHeight: 56,
  },
  icono: {
    width: 40,
    height: 40,
    borderRadius: radio.completo,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.primarioSuave,
  },
  texto: { flex: 1, gap: 2 },
  secundario: { ...tipografia.secundario, color: colores.textoSecundario },
  direccion: { ...tipografia.cuerpoEnfasis, color: colores.texto },
  enlace: { ...tipografia.cuerpoEnfasis, color: colores.primario },
});

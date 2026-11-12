import * as Haptics from 'expo-haptics';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  confirmarRecarga,
  consultarRecarga,
  crearRecarga,
  ErrorApi,
  OrdenRecarga,
  OrdenRecargaCreada,
} from '@/api/cliente';
import { Entra, Toque } from '@/componentes/Animado';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { ZonaAccion } from '@/componentes/Estructura';
import { Icono } from '@/componentes/Icono';
import { FilaMovimiento } from '@/componentes/FilaMovimiento';
import { Ilustracion } from '@/componentes/Ilustracion';
import { BotonRevincular } from '@/componentes/BotonRevincular';
import { ConfirmacionBiometrica } from '@/componentes/ConfirmacionBiometrica';
import { Aviso, EtiquetaEstado } from '@/componentes/Mensajes';
import { useSesion } from '@/contexto/sesion';
import { fallaDeFirma, useAccionSensible } from '@/hooks/useAccionSensible';
import { formatearMonto } from '@/formato';
import { con, t } from '@/i18n';
import {
  colores,
  espacio,
  radio,
  tipografia,
  degradadoSaldo,
  sombraElevada,
  sombraTarjeta,
} from '@/tema/tokens';

const MONTOS_RAPIDOS = [20, 50, 100, 200];
const MINIMO = 10;
const MAXIMO = 500;
/** Solo para la barra de cuenta regresiva; quien decide si la orden venció es el servidor (RN-4). */
const VIGENCIA_S = 15 * 60;
// ponytail: intervalo fijo mientras la pantalla está abierta; con espera creciente si la carga del backend lo pide.
const CONSULTA_MS = 3000;
const AVISO_DEMORA_MS = 30_000;

type Paso =
  | { tipo: 'monto' }
  | { tipo: 'qr'; orden: OrdenRecargaCreada }
  | { tipo: 'procesando'; orden: OrdenRecarga }
  /** `repetida`: el pago ya estaba acreditado cuando se confirmó otra vez (CA-3). */
  | { tipo: 'acreditada'; orden: OrdenRecarga; repetida: boolean }
  | { tipo: 'vencida' };

type Falla = {
  texto: string;
  tono: 'info' | 'peligro';
  accion?: 'identidad' | 'vincular';
  revincular?: 'llave_anulada' | 'sin_llave';
};

/** Comprueba el monto escrito antes de enviarlo (RN-1, RN-7); el servidor vuelve a validarlo. Devuelve Bs o la clave del error. */
function leerMonto(texto: string): number | string {
  const limpio = texto.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return 'monto_invalido';
  const monto = Number(limpio);
  return monto < MINIMO || monto > MAXIMO ? 'monto_fuera_de_rango' : monto;
}

/** Traduce el error a lo que ve la persona; nunca muestra códigos técnicos (DESIGN_SYSTEM §13.4). */
function fallaDe(error: unknown): Falla {
  const peligro = (clave: string): Falla => ({
    texto: t(clave),
    tono: 'peligro',
  });
  const deFirma = fallaDeFirma(error, 'recarga');
  if (deFirma) return deFirma;
  if (!(error instanceof ErrorApi)) return peligro('billetera.recarga.error');
  switch (error.codigo) {
    // CA-6: sin identidad verificada o sin billetera no se opera.
    case 'IDENTIDAD_NO_VERIFICADA':
    case 'BILLETERA_NO_ENCONTRADA':
      return {
        texto: t('billetera.recarga.identidad_requerida'),
        tono: 'info',
        accion: 'identidad',
      };
    case 'FIRMA_DISPOSITIVO_INVALIDA':
    case 'DISPOSITIVO_NO_VINCULADO':
      return {
        texto: t('billetera.recarga.vincular_requerido'),
        tono: 'info',
        accion: 'vincular',
      };
    case 'CUENTA_SUSPENDIDA':
      return peligro('billetera.recarga.cuenta_suspendida');
    default:
      return peligro('billetera.recarga.error');
  }
}

const restanteDe = (expiraEn: string, ahora: number) =>
  Math.max(0, Math.ceil((new Date(expiraEn).getTime() - ahora) / 1000));

const relojDe = (segundos: number) =>
  `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;

/** Tarjeta de marca con lo que se paga y lo que se recibe: entra con un resorte. */
function Resumen({ monto }: { monto: number }) {
  const animado = formatearMonto(monto.toFixed(2));
  return (
    <Entra style={estilos.resumen}>
      <Text style={estilos.resumenRotulo}>
        {t('billetera.recarga.recibes')}
      </Text>
      <Text style={estilos.resumenCifra}>
        {animado} <Text style={estilos.resumenUnidad}>URC</Text>
      </Text>
      <View style={estilos.resumenLinea}>
        <Text style={estilos.resumenRotulo}>
          {t('billetera.recarga.pagas')}
        </Text>
        <Text style={estilos.resumenPago}>
          {formatearMonto(monto.toFixed(2))} Bs
        </Text>
      </View>
    </Entra>
  );
}

/** Recarga de saldo (HU-13): monto → QR con 15 minutos → pago simulado con huella → acreditación. */
export default function RecargarPantalla() {
  const { usuario } = useSesion();
  // Otra persona nunca ve la orden que quedó en memoria de la anterior: se monta de cero.
  return <Contenido key={usuario?.id} />;
}

function Contenido() {
  const { cargando, usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const [paso, setPaso] = useState<Paso>({ tipo: 'monto' });
  const [rapido, setRapido] = useState(50);
  const [otro, setOtro] = useState('');
  const [errorMonto, setErrorMonto] = useState<string | null>(null);
  const [falla, setFalla] = useState<Falla | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  // Dos toques seguidos no crean dos órdenes ni piden dos huellas.
  const ocupado = useRef(false);
  const accion = useAccionSensible('recarga');

  // `delConfirmar`: solo la respuesta de confirmar puede decir que el pago se repitió. `pendiente` no cambia de paso.
  const aplicar = useCallback((orden: OrdenRecarga, delConfirmar = false) => {
    if (orden.estado === 'pendiente') return;
    setFalla(null);
    if (orden.estado === 'completada')
      setPaso({ tipo: 'acreditada', orden, repetida: delConfirmar });
    else if (orden.estado === 'expirada') setPaso({ tipo: 'vencida' });
    else if (orden.estado === 'procesando')
      setPaso({ tipo: 'procesando', orden });
  }, []);

  const expiraEn = paso.tipo === 'qr' ? paso.orden.expiraEn : null;
  useEffect(() => {
    if (!expiraEn) return;
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(reloj);
  }, [expiraEn]);
  const restante = expiraEn ? restanteDe(expiraEn, ahora) : VIGENCIA_S;

  // El estado lo decide el servidor: una confirmación cuya respuesta se perdió ya no vence, así que al llegar a cero
  // se pregunta antes de decir "no se cobró nada". También se consulta mientras se acredita.
  const ordenAConsultar =
    paso.tipo === 'procesando' || (paso.tipo === 'qr' && restante === 0)
      ? paso.orden.ordenId
      : null;
  useEffect(() => {
    if (!ordenAConsultar) return;
    let vigente = true;
    let espera: ReturnType<typeof setTimeout>;
    const consultar = async () => {
      try {
        const orden = await consultarRecarga(ordenAConsultar);
        if (vigente) aplicar(orden);
      } catch (error) {
        // Sin conexión o nodo caído: la orden no se pierde, se vuelve a preguntar. Un rechazo no se arregla solo.
        if (
          error instanceof ErrorApi &&
          error.estado >= 400 &&
          error.estado < 500 &&
          error.estado !== 429
        ) {
          if (vigente) setFalla(fallaDe(error));
          return;
        }
      }
      if (vigente) espera = setTimeout(consultar, CONSULTA_MS);
    };
    espera = setTimeout(consultar, CONSULTA_MS);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [ordenAConsultar, aplicar]);

  // "Seguimos intentando" es para cuando el nodo falla (RN-6): el camino normal no llega a verlo.
  const [demorada, setDemorada] = useState(false);
  const procesando = paso.tipo === 'procesando';
  useEffect(() => {
    if (!procesando) return;
    const reloj = setTimeout(() => setDemorada(true), AVISO_DEMORA_MS);
    return () => {
      clearTimeout(reloj);
      setDemorada(false);
    };
  }, [procesando]);

  // Vibración de éxito al acreditarse: confirma sin mirar la pantalla.
  const acreditada = paso.tipo === 'acreditada';
  useEffect(() => {
    if (acreditada)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
  }, [acreditada]);

  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;

  const conOtro = otro.trim() !== '';
  const lectura = conOtro ? leerMonto(otro) : rapido;
  const monto = typeof lectura === 'number' ? lectura : null;
  const errorCampo =
    errorMonto ??
    (typeof lectura === 'string' ? t(`billetera.recarga.${lectura}`) : null);

  const generar = async () => {
    if (monto === null || ocupado.current) return;
    ocupado.current = true;
    setEnviando(true);
    setFalla(null);
    setErrorMonto(null);
    try {
      const orden = await crearRecarga(monto);
      setAhora(Date.now());
      setPaso({ tipo: 'qr', orden });
    } catch (error) {
      if (error instanceof ErrorApi && error.codigo === 'MONTO_FUERA_DE_RANGO')
        setErrorMonto(t('billetera.recarga.monto_fuera_de_rango'));
      else if (error instanceof ErrorApi && error.codigo === 'MONTO_INVALIDO')
        setErrorMonto(t('billetera.recarga.monto_invalido'));
      else setFalla(fallaDe(error));
    } finally {
      ocupado.current = false;
      setEnviando(false);
    }
  };

  const confirmar = async (orden: OrdenRecargaCreada) => {
    if (accion.ocupado()) return;
    setFalla(null);
    try {
      const resultado = await accion.ejecutar(
        (opciones) => confirmarRecarga(orden.ordenId, opciones),
        orden.monto,
      );
      if (resultado) aplicar(resultado, true);
    } catch (error) {
      if (error instanceof ErrorApi && error.codigo === 'ORDEN_EXPIRADA')
        setPaso({ tipo: 'vencida' });
      else setFalla(fallaDe(error));
    }
  };

  const pie = (
    <>
      {falla && <Aviso tono={falla.tono}>{falla.texto}</Aviso>}
      {falla?.revincular && <BotonRevincular motivo={falla.revincular} />}
      {falla?.accion === 'identidad' && (
        <Boton
          icono="verified_user"
          anchoCompleto
          etiqueta={t('billetera.pantalla.verificar')}
          alPresionar={() => router.push('/identidad')}
        />
      )}
      {falla?.accion === 'vincular' && (
        <Boton
          icono="smartphone"
          anchoCompleto
          etiqueta={t('billetera.pantalla.vincular')}
          alPresionar={() => router.push('/dispositivo')}
        />
      )}
    </>
  );

  const titulo =
    paso.tipo === 'monto'
      ? t('billetera.recarga.titulo')
      : paso.tipo === 'procesando' || paso.tipo === 'acreditada'
        ? null
        : t('billetera.recarga.titulo_qr');

  return (
    <KeyboardAvoidingView
      style={estilos.raiz}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* La pestaña Billetera deja la barra de estado clara (zona de marca): aquí el fondo es blanco. */}
      <StatusBar style="dark" />
      <View style={[estilos.barra, { paddingTop: top }]}>
        <BotonIcono
          icono="close"
          etiqueta={t('comun.acciones.cerrar')}
          alPresionar={() => router.back()}
        />
        {titulo && (
          <Text style={estilos.tituloBarra} accessibilityRole="header">
            {titulo}
          </Text>
        )}
      </View>

      {paso.tipo === 'monto' && (
        <>
          <ScrollView
            contentContainerStyle={estilos.contenido}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={estilos.etiqueta}>
              {t('billetera.recarga.cuanto')}
            </Text>
            <View style={estilos.montos} accessibilityRole="radiogroup">
              {MONTOS_RAPIDOS.map((m) => {
                const elegido = !conOtro && rapido === m;
                return (
                  <Toque
                    key={m}
                    accessibilityRole="radio"
                    accessibilityLabel={`${m} Bs`}
                    accessibilityState={{ selected: elegido }}
                    onPress={() => {
                      setRapido(m);
                      setOtro('');
                      setErrorMonto(null);
                    }}
                    style={[estilos.monto, elegido && estilos.montoElegido]}
                  >
                    <Text
                      style={[
                        estilos.textoMonto,
                        elegido && estilos.textoMontoElegido,
                      ]}
                    >
                      {m}
                    </Text>
                    <Text style={estilos.unidad}>Bs</Text>
                  </Toque>
                );
              })}
            </View>
            <Campo
              etiqueta={t('billetera.recarga.otro_monto')}
              placeholder={t('billetera.recarga.otro_monto_ayuda')}
              keyboardType="decimal-pad"
              value={otro}
              onChangeText={(v) => {
                setOtro(v);
                setErrorMonto(null);
              }}
              error={errorCampo ?? undefined}
            />
            {monto !== null && <Resumen monto={monto} />}
            <Text style={estilos.pequeno}>
              {t('billetera.recarga.simulado')}
            </Text>
            {pie}
          </ScrollView>
          <ZonaAccion>
            <Boton
              anchoCompleto
              cargando={enviando}
              etiqueta={t('billetera.recarga.generar')}
              alPresionar={() => void generar()}
            />
          </ZonaAccion>
        </>
      )}

      {paso.tipo === 'qr' && (
        <>
          <ScrollView contentContainerStyle={estilos.contenido}>
            <View style={estilos.centrado}>
              <Text style={estilos.secundario}>
                {t('billetera.recarga.monto_a_pagar')}
              </Text>
              <Text style={estilos.cifra}>
                {formatearMonto(paso.orden.monto)} Bs
              </Text>
            </View>
            <View style={estilos.qr}>
              <Image
                accessibilityLabel={t('billetera.recarga.qr')}
                source={{
                  uri: `data:image/png;base64,${paso.orden.qrImagenBase64}`,
                }}
                style={estilos.imagenQr}
              />
              <View style={estilos.sello}>
                <Icono
                  nombre="science"
                  color={colores.avisoTexto}
                  tamano={16}
                />
                <Text style={estilos.textoSello}>
                  {t('billetera.recarga.etiqueta_simulado')}
                </Text>
              </View>
            </View>
            <View style={estilos.cuenta}>
              <View
                style={[
                  estilos.cuentaAvance,
                  { width: `${(restante / VIGENCIA_S) * 100}%` },
                ]}
              />
            </View>
            <Text style={[estilos.secundario, estilos.textoCentrado]}>
              {t('billetera.recarga.vence_en').replace(
                '{tiempo}',
                relojDe(restante),
              )}
            </Text>
            <Aviso tono="info">{t('billetera.recarga.instruccion')}</Aviso>
            {pie}
          </ScrollView>
          <ZonaAccion>
            <ConfirmacionBiometrica
              estado={accion.estado}
              etiqueta={con('billetera.recarga.simular', {
                monto: formatearMonto(paso.orden.monto),
              })}
              alConfirmar={() => void confirmar(paso.orden)}
            />
          </ZonaAccion>
        </>
      )}

      {(paso.tipo === 'procesando' || paso.tipo === 'acreditada') && (
        <>
          <ScrollView contentContainerStyle={estilos.resultado}>
            <Ilustracion
              icono={
                paso.tipo === 'acreditada'
                  ? 'check_circle'
                  : 'account_balance_wallet'
              }
              color={
                paso.tipo === 'acreditada' ? colores.exito : colores.primario
              }
            />
            {paso.tipo === 'procesando' && (
              // La etiqueta se alinea sola al inicio; envuelta queda centrada.
              <View>
                <EtiquetaEstado
                  dominio="movimiento"
                  estado="pendiente"
                  texto={t('billetera.historial.estado.pendiente')}
                />
              </View>
            )}
            <Text style={estilos.tituloResultado} accessibilityRole="header">
              {t(
                paso.tipo === 'acreditada'
                  ? 'billetera.recarga.acreditada'
                  : 'billetera.recarga.en_camino',
              )}
            </Text>
            <Text style={estilos.textoResultado}>
              {t(
                paso.tipo === 'acreditada'
                  ? 'billetera.recarga.acreditada_texto'
                  : 'billetera.recarga.en_camino_texto',
              ).replaceAll('{monto}', formatearMonto(paso.orden.monto))}
            </Text>
            {paso.tipo === 'acreditada' && paso.repetida && (
              <Aviso tono="info">{t('billetera.recarga.ya_procesada')}</Aviso>
            )}
            {paso.tipo === 'procesando' && (
              <>
                <View style={estilos.filaEnCamino}>
                  <FilaMovimiento
                    primero
                    ultimo
                    movimiento={{
                      id: paso.orden.ordenId,
                      tipo: 'recarga',
                      monto: paso.orden.monto,
                      estado: 'pendiente',
                      hashTx: null,
                      exploradorUrl: null,
                      creadoEn: new Date(ahora).toISOString(),
                    }}
                  />
                </View>
                {demorada && (
                  <Aviso tono="info">
                    {t('billetera.recarga.procesando_onchain')}
                  </Aviso>
                )}
                {pie}
                <Text style={estilos.pequeno}>
                  {t('billetera.recarga.seguir_usando')}
                </Text>
              </>
            )}
          </ScrollView>
          <ZonaAccion>
            <Boton
              anchoCompleto
              etiqueta={t('billetera.recarga.ver_billetera')}
              alPresionar={() => router.dismissTo('/billetera')}
            />
          </ZonaAccion>
        </>
      )}

      {paso.tipo === 'vencida' && (
        <>
          <ScrollView contentContainerStyle={estilos.resultado}>
            <Ilustracion icono="timer_off" color={colores.aviso} />
            <Text style={estilos.tituloResultado} accessibilityRole="header">
              {t('billetera.recarga.vencida_titulo')}
            </Text>
            <Text style={estilos.textoResultado}>
              {t('billetera.recarga.orden_expirada')}
            </Text>
          </ScrollView>
          <ZonaAccion>
            <Boton
              anchoCompleto
              etiqueta={t('billetera.recarga.qr_nuevo')}
              alPresionar={() => {
                setFalla(null);
                setPaso({ tipo: 'monto' });
              }}
            />
          </ZonaAccion>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondoSutil },
  filaEnCamino: { alignSelf: 'stretch' },
  barra: {
    minHeight: 56,
    flexDirection: 'row',
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
  contenido: { flexGrow: 1, gap: espacio(3), padding: espacio(4) },
  etiqueta: { ...tipografia.etiqueta, color: colores.texto },
  montos: { flexDirection: 'row', gap: espacio(2) },
  monto: {
    flex: 1,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radio.l,
    borderWidth: 1.5,
    borderColor: colores.bordeCampo,
    backgroundColor: colores.superficie,
  },
  unidad: { ...tipografia.pequeno, color: colores.textoSecundario },
  resumen: {
    gap: espacio(1),
    padding: espacio(5),
    borderRadius: radio.xl,
    backgroundColor: colores.primario,
    experimental_backgroundImage: degradadoSaldo,
    ...sombraElevada,
  },
  resumenRotulo: {
    ...tipografia.secundario,
    color: colores.sobreMarcaSecundario,
  },
  resumenCifra: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '800',
    letterSpacing: -1,
    color: colores.sobrePrimario,
  },
  resumenUnidad: { fontSize: 18, fontWeight: '600' },
  resumenLinea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: espacio(2),
    paddingTop: espacio(3),
    borderTopWidth: 1,
    borderTopColor: colores.vidrioBorde,
  },
  resumenPago: { ...tipografia.cuerpoEnfasis, color: colores.sobreMarca },
  montoElegido: {
    backgroundColor: colores.primarioSuave,
    borderColor: colores.primario,
  },
  textoMonto: { fontSize: 22, fontWeight: '800', color: colores.texto },
  textoMontoElegido: { color: colores.primarioTexto },
  tarjeta: {
    gap: espacio(2),
    padding: espacio(3),
    borderRadius: radio.l,
    backgroundColor: colores.superficie,
    ...sombraElevada,
  },
  filaResumen: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: espacio(2),
  },
  secundario: { ...tipografia.secundario, color: colores.textoSecundario },
  enfasis: { ...tipografia.cuerpoEnfasis, color: colores.texto },
  pequeno: {
    ...tipografia.pequeno,
    color: colores.textoSecundario,
    textAlign: 'center',
  },
  centrado: { alignItems: 'center' },
  textoCentrado: { textAlign: 'center' },
  cifra: { ...tipografia.pantalla, color: colores.texto },
  qr: {
    alignItems: 'center',
    gap: espacio(2),
    padding: espacio(5),
    borderRadius: radio.xl,
    backgroundColor: colores.superficie,
    ...sombraTarjeta,
  },
  imagenQr: { width: 220, height: 220 },
  sello: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(1),
    paddingHorizontal: espacio(2),
    paddingVertical: espacio(1),
    borderRadius: radio.s,
    backgroundColor: colores.avisoSuave,
  },
  textoSello: { ...tipografia.pequeno, color: colores.avisoTexto },
  cuenta: {
    height: 6,
    borderRadius: radio.completo,
    overflow: 'hidden',
    backgroundColor: colores.borde,
  },
  cuentaAvance: { height: '100%', backgroundColor: colores.primario },
  resultado: {
    flexGrow: 1,
    gap: espacio(3),
    alignItems: 'center',
    padding: espacio(6),
  },
  tituloResultado: {
    ...tipografia.pantalla,
    color: colores.texto,
    textAlign: 'center',
  },
  textoResultado: {
    ...tipografia.cuerpo,
    color: colores.textoSecundario,
    textAlign: 'center',
  },
});

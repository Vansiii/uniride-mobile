import * as Portapapeles from 'expo-clipboard';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Billetera,
  consultarEstadoIdentidad,
  consultarMiBilletera,
  consultarMovimientos,
  consultarSaldo,
  crearBilletera,
  ErrorApi,
  Movimiento,
  Saldo,
} from '@/api/cliente';
import { Esqueleto, Toque } from '@/componentes/Animado';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { BandaMarca } from '@/componentes/Estructura';
import { Icono } from '@/componentes/Icono';
import { Ilustracion } from '@/componentes/Ilustracion';
import { Aviso } from '@/componentes/Mensajes';
import { TarjetaSaldo } from '@/componentes/TarjetaSaldo';
import { useSesion } from '@/contexto/sesion';
import { ErrorKeystore } from '@/dispositivo/keystore';
import { abrirHttps } from '@/enlaces';
import { formatearMonto } from '@/formato';
import { t } from '@/i18n';
import {
  colores,
  espacio,
  radio,
  degradadoBoton,
  tipografia,
  sombraElevada,
  sombraTarjeta,
} from '@/tema/tokens';

type Vista =
  | { tipo: 'cargando' }
  /** Identidad sin verificar: la billetera todavía no existe (HU-12 CA-4). */
  | { tipo: 'sin_billetera' }
  /** Sin teléfono vinculado o firma rechazada: hay que vincular (HU-09). */
  | { tipo: 'vincular' }
  /** `billetera` es null si /mia dio 503 (nodo caído): se ve el saldo sin la dirección. */
  | { tipo: 'lista'; saldo: Saldo; billetera: Billetera | null }
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

const CONSULTA_MS = 5_000;

/** `0x7a3F…9C21`: solo para mirar; lo que se copia es la dirección completa. */
const acortar = (direccion: string) =>
  `${direccion.slice(0, 6)}…${direccion.slice(-4)}`;

/** Billetera (HU-12, HU-14): saldo desglosado, dirección pública y enlace al explorador. La dirección (con huella) se lee una vez al entrar; actualizar solo relee el saldo. */
export default function BilleteraPantalla() {
  const { usuario } = useSesion();
  // Otra persona en la misma pestaña nunca ve lo que quedó en memoria de la anterior: se monta de cero.
  return <Contenido key={usuario?.id} />;
}

function Contenido() {
  const { cargando, usuario } = useSesion();
  const [vista, setVista] = useState<Vista>({ tipo: 'cargando' });
  const [copia, setCopia] = useState<'ok' | 'fallo' | null>(null);
  // Falla al actualizar el saldo: se avisa sin perder lo que ya se ve ni gastar otra huella.
  const [errorRefresco, setErrorRefresco] = useState<string | null>(null);
  // Recargas por acreditarse (HU-13 RN-6). Sin firma; si falla la lectura, se conserva lo último visto.
  const [pendientes, setPendientes] = useState<Movimiento[]>([]);
  const leerPendientes = useCallback(() => {
    return consultarMovimientos(1, ['recarga'])
      .then((p) =>
        setPendientes(p.items.filter((m) => m.estado === 'pendiente')),
      )
      .catch(() => undefined);
  }, []);
  // Cada lectura firmada pide la huella: nunca dos a la vez.
  const enCurso = useRef(false);

  const leer = useCallback(async (): Promise<Vista | null> => {
    if (enCurso.current) return null;
    enCurso.current = true;
    try {
      // Sin identidad verificada el servidor responde 403 sin importar la firma: no se gasta una huella para saberlo.
      if ((await consultarEstadoIdentidad()).estado !== 'verificada')
        return { tipo: 'sin_billetera' };
      // El saldo va solo con token: no gasta huella. Billetera que aún no existe (404): se reintenta la creación una vez.
      let billetera: Billetera | null = null;
      let saldo: Saldo;
      try {
        saldo = await consultarSaldo();
      } catch (error) {
        if (
          !(error instanceof ErrorApi) ||
          error.codigo !== 'BILLETERA_NO_ENCONTRADA'
        )
          throw error;
        billetera = await crearBilletera();
        saldo = await consultarSaldo();
      }
      // La dirección sí pide huella, una vez al abrir. Con el nodo caído (503) el saldo se ve igual, sin dirección.
      try {
        billetera ??= await consultarMiBilletera();
      } catch (error) {
        if (!(error instanceof ErrorApi && error.estado === 503)) throw error;
      }
      return { tipo: 'lista', saldo, billetera };
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

  // Relee saldo y recargas pendientes; nunca pide huella.
  const refrescarSaldo = useCallback(async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    setErrorRefresco(null);
    try {
      // Primero los pendientes: si ya no hay, el saldo que sigue incluye lo acreditado.
      await leerPendientes();
      const saldo = await consultarSaldo();
      setVista((v) => (v.tipo === 'lista' ? { ...v, saldo } : v));
    } catch (error) {
      const v = vistaDe(error);
      if (v.tipo === 'falla') setErrorRefresco(v.texto);
      else setVista(v);
    } finally {
      enCurso.current = false;
    }
  }, [leerPendientes]);

  const yaLista = vista.tipo === 'lista';
  useEffect(() => {
    if (yaLista) void leerPendientes();
  }, [yaLista, leerPendientes]);

  // CA-1: con una recarga en camino, el saldo se actualiza solo mientras se mira esta pantalla; nunca pide huella.
  const hayPendientes = pendientes.length > 0;
  useFocusEffect(
    useCallback(() => {
      if (!hayPendientes) return;
      const reloj = setInterval(() => void refrescarSaldo(), CONSULTA_MS);
      return () => clearInterval(reloj);
    }, [hayPendientes, refrescarSaldo]),
  );

  // Quien verifica su identidad en /identidad y vuelve no debe seguir viendo "Verificar identidad": esa vista no tiene
  // botón de actualizar, así que al recuperar el foco se lee otra vez. `leer` consulta primero /identidad/estado sin
  // firma: no pide huella mientras la identidad siga sin verificar. Quien vuelve de recargar ve su saldo nuevo: con la
  // billetera lista solo se relee lo que no firma. Las demás vistas no releen por foco (cada lectura firmada pide
  // huella). El tipo va en un ref para que el callback no cambie y el foco no dispare la lectura de nuevo.
  const tipoVista = useRef(vista.tipo);
  useEffect(() => {
    tipoVista.current = vista.tipo;
  }, [vista.tipo]);
  useFocusEffect(
    useCallback(() => {
      if (tipoVista.current === 'lista') void refrescarSaldo();
      if (tipoVista.current !== 'sin_billetera') return;
      void leer().then((v) => v && setVista(v));
    }, [leer, refrescarSaldo]),
  );

  // Lectura completa (la dirección pide huella): al reintentar una falla o al volver a pedir la dirección.
  const recargar = () => {
    if (enCurso.current) return;
    setErrorRefresco(null);
    setVista({ tipo: 'cargando' });
    void leer().then((v) => v && setVista(v));
  };
  const actualizar = () => (yaLista ? void refrescarSaldo() : recargar());
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

  const lista = vista.tipo === 'lista' ? vista : null;
  const billetera = lista?.billetera ?? null;
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
          {lista && <TarjetaSaldo saldo={lista.saldo} />}
        </BandaMarca>

        {vista.tipo === 'cargando' && (
          <View
            style={estilos.esqueletos}
            accessibilityLabel={t('comun.estados.cargando')}
          >
            <View style={estilos.acciones}>
              <Esqueleto alto={96} redondeo={radio.l} style={estilos.mitad} />
              <Esqueleto alto={96} redondeo={radio.l} style={estilos.mitad} />
            </View>
            <Esqueleto alto={120} redondeo={radio.l} />
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
                alPresionar={recargar}
              />
            )}
          </View>
        )}

        {lista && (
          <View style={[estilos.bloque, estilos.sobreBanda]}>
            <View style={estilos.acciones}>
              <Baldosa
                icono="add"
                destacada
                etiqueta={t('billetera.recarga.boton')}
                alPresionar={() => router.push('/recargar')}
              />
              <Baldosa
                icono="receipt_long"
                etiqueta={t('billetera.pantalla.movimientos')}
                alPresionar={() => router.push('/movimientos')}
              />
            </View>
            {pendientes.map((m) => (
              <Aviso key={m.id} tono="info">
                {t('billetera.recarga.pendiente').replace(
                  '{monto}',
                  formatearMonto(m.monto),
                )}
              </Aviso>
            ))}
            {(!lista.saldo.enLinea || !billetera) && (
              <Aviso tono="aviso">
                {t('billetera.saldo.sincronizacion_pendiente').replace(
                  '{monto}',
                  formatearMonto(lista.saldo.saldoDisponible),
                )}
              </Aviso>
            )}
            {errorRefresco && <Aviso tono="peligro">{errorRefresco}</Aviso>}
            <View style={estilos.tarjeta}>
              {!billetera && (
                <>
                  <Text style={estilos.secundario}>
                    {t('billetera.pantalla.direccion_no_disponible')}
                  </Text>
                  <Boton
                    variante="texto"
                    icono="refresh"
                    etiqueta={t('billetera.pantalla.direccion_reintentar')}
                    alPresionar={recargar}
                  />
                </>
              )}
              {billetera && (
                <>
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
                      onPress={() => abrirHttps(billetera.exploradorUrl!)}
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
                </>
              )}
            </View>
            {copia && (
              <Aviso tono={copia === 'ok' ? 'exito' : 'peligro'}>
                {t(
                  copia === 'ok'
                    ? 'billetera.pantalla.copiada'
                    : 'billetera.pantalla.copia_fallida',
                )}
              </Aviso>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/** Acción grande en baldosa: ícono en círculo y rótulo, con respuesta al toque. */
function Baldosa({
  icono,
  etiqueta,
  alPresionar,
  destacada = false,
}: {
  icono: ComponentProps<typeof Icono>['nombre'];
  etiqueta: string;
  alPresionar: () => void;
  destacada?: boolean;
}) {
  const color = destacada ? colores.sobrePrimario : colores.primario;
  return (
    <Toque
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={alPresionar}
      style={[estilos.baldosa, destacada && estilos.baldosaDestacada]}
    >
      <View style={[estilos.circulo, destacada && estilos.circuloDestacado]}>
        <Icono nombre={icono} color={color} />
      </View>
      <Text style={[estilos.textoBaldosa, destacada && { color }]}>
        {etiqueta}
      </Text>
    </Toque>
  );
}

const estilos = StyleSheet.create({
  baldosa: {
    flex: 1,
    minHeight: 96,
    justifyContent: 'space-between',
    padding: espacio(4),
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
    ...sombraTarjeta,
  },
  baldosaDestacada: {
    borderWidth: 0,
    backgroundColor: colores.primario,
    experimental_backgroundImage: degradadoBoton,
  },
  circulo: {
    width: 40,
    height: 40,
    borderRadius: radio.completo,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.primarioSuave,
  },
  circuloDestacado: { backgroundColor: colores.vidrio },
  textoBaldosa: { ...tipografia.cuerpoEnfasis, color: colores.texto },
  raiz: { flex: 1, backgroundColor: colores.fondoSutil },
  desplazable: { flexGrow: 1, paddingBottom: espacio(6) },
  filaTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titulo: { ...tipografia.pantalla, color: colores.sobreMarca },
  esqueletos: { gap: espacio(3), padding: espacio(4) },
  mitad: { flex: 1 },
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
  // Sobre-banda (DESIGN_SYSTEM §4.6, nivel 0,5): la tarjeta se superpone 24 dp al borde inferior de la banda.
  sobreBanda: { marginTop: -24 },
  tarjeta: {
    gap: espacio(2),
    padding: espacio(3),
    borderRadius: radio.l,
    backgroundColor: colores.superficie,
    ...sombraElevada,
  },
  // Dos acciones lado a lado; si la letra del sistema crece, pasan a otra fila.
  acciones: { flexDirection: 'row', gap: espacio(3) },
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

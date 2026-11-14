import { StatusBar } from 'expo-status-bar';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  consultarDesafio,
  type Desafio,
  ErrorApi,
  type PasajeroViaje,
  pedirDesafio,
  registrarLlaveTrayecto,
  type TipoEncuentro,
} from '@/api/cliente';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { AvisoFallaAbordaje } from '@/componentes/AvisoFallaAbordaje';
import { ConfirmacionBiometrica } from '@/componentes/ConfirmacionBiometrica';
import { ZonaAccion } from '@/componentes/Estructura';
import { EtiquetaEstado } from '@/componentes/Mensajes';
import { useSesion } from '@/contexto/sesion';
import {
  crearLlaveTrayecto,
  nonceAleatorio,
  pedirTokenIntegridad,
} from '@/dispositivo/keystore';
import { useAccionSensible } from '@/hooks/useAccionSensible';
import { con, t } from '@/i18n';
import { posicionParaEncuentro } from '@/servicios/ubicacion';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';
import {
  type FallaAbordaje,
  fallaDeAbordaje,
  fallaDeUbicacion,
  RENOVAR_MS,
  SONDEO_MS,
  texto,
  yaAbordo,
} from '@/viajes/abordaje';
import { iniciarSeguimiento, llaveDelSeguimiento } from '@/viajes/seguimiento';

/**
 * «Mostrar código» del conductor (HU-22 CA-1, DESIGN_SYSTEM §10.4): una huella al entrar registra la llave de
 * trayecto; desde ahí el QR se renueva solo, firmado con esa llave y la posición del momento, sin pedir otra huella.
 */
export default function MostrarCodigoPantalla() {
  const { cargando, usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const { viajeId, tipo: tipoParam } = useLocalSearchParams<{
    viajeId: string;
    tipo?: string;
  }>();
  // HU-23: el mismo código sirve para la bajada, firmado con la llave que ya sigue el viaje.
  const tipo: TipoEncuentro = tipoParam === 'bajada' ? 'bajada' : 'abordaje';
  const accion = useAccionSensible('mostrar_codigo');
  const [llave, setLlave] = useState<string | null>(null);
  const [desafio, setDesafio] = useState<Desafio | null>(null);
  const [pasajeros, setPasajeros] = useState<PasajeroViaje[]>([]);
  const [falla, setFalla] = useState<FallaAbordaje | null>(null);
  const [ahora, setAhora] = useState(0);
  const [pedidoEn, setPedidoEn] = useState(0);
  const abordados = useRef(0);
  const pidiendo = useRef(false);
  const montada = useRef(true);
  useEffect(
    () => () => {
      montada.current = false;
    },
    [],
  );

  const contarAbordados = (lista: PasajeroViaje[]) =>
    lista.filter((p) => yaAbordo(p.estado)).length;

  /** Posición del momento → código nuevo. Sin ubicación, el aviso reemplaza el QR. */
  const renovar = useCallback(
    async (llaveTrayectoId: string) => {
      if (pidiendo.current) return;
      pidiendo.current = true;
      try {
        const lectura = await posicionParaEncuentro();
        if (!montada.current) return;
        if (lectura.tipo !== 'ok') {
          setDesafio(null);
          setFalla(fallaDeUbicacion(lectura, tipo));
          return;
        }
        const nuevo = await pedirDesafio(
          llaveTrayectoId,
          viajeId,
          lectura.posicion,
          tipo,
        );
        if (!montada.current) return;
        abordados.current = contarAbordados(nuevo.pasajeros);
        setDesafio(nuevo);
        setPasajeros(nuevo.pasajeros);
        // El reloj arranca en el mismo instante: la cuenta empieza en 25, no en 26.
        const pedido = Date.now();
        setPedidoEn(pedido);
        setAhora(pedido);
        setFalla(null);
      } catch (error) {
        if (!montada.current) return;
        setDesafio(null);
        // La llave dejó de valer (otro teléfono vinculado, viaje terminado): hace falta otra huella.
        if (
          error instanceof ErrorApi &&
          error.codigo === 'FIRMA_TRAYECTO_INVALIDA'
        ) {
          setLlave(null);
          setFalla({
            texto: t('presencia.abordaje.firma_vencida'),
            tono: 'info',
          });
          return;
        }
        setFalla(fallaDeAbordaje(error, 'mostrar_codigo', tipo));
      } finally {
        pidiendo.current = false;
      }
    },
    [viajeId, tipo],
  );

  // Con el viaje en curso la llave del seguimiento ya vale (bajada, o volver al código de abordaje): crear otra
  // reemplazaría la del teléfono antes de que el servidor la acepte. Sin ella (app reinstalada) se pide la huella.
  useEffect(() => {
    void llaveDelSeguimiento({ rol: 'conductor', id: viajeId }).then((id) => {
      if (!id || !montada.current) return;
      setLlave(id);
      void renovar(id);
    });
  }, [viajeId, renovar]);

  // HU-23 CA-1: con el primer pasajero a bordo empieza a compartir la posición; con otra llave, sigue con esa.
  const algunoAbordo = pasajeros.some((p) => yaAbordo(p.estado));
  useEffect(() => {
    if (llave && algunoAbordo)
      void iniciarSeguimiento({
        rol: 'conductor',
        id: viajeId,
        llaveTrayectoId: llave,
      });
  }, [llave, algunoAbordo, viajeId]);

  // Reloj de la cuenta regresiva y renovación a los 25 s.
  useEffect(() => {
    if (!llave) return;
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(reloj);
  }, [llave]);
  useEffect(() => {
    if (!llave || !desafio) return;
    const siguiente = setTimeout(
      () => void renovar(llave),
      Math.max(0, pedidoEn + RENOVAR_MS - Date.now()),
    );
    return () => clearTimeout(siguiente);
  }, [llave, desafio, pedidoEn, renovar]);

  // ponytail: sondeo cada 3 s; un escaneo, aceptado o rechazado, gasta el código (RN-1) y sale otro en ≤ 3 s.
  // Un aviso del servidor (push o socket) lo haría inmediato.
  useEffect(() => {
    if (!llave || !desafio) return;
    const sondeo = setInterval(() => {
      consultarDesafio(viajeId, desafio.nonce)
        .then(({ vigente, pasajeros: lista }) => {
          if (!montada.current) return;
          setPasajeros(lista);
          if (!vigente || contarAbordados(lista) > abordados.current)
            void renovar(llave);
        })
        .catch(() => undefined);
    }, SONDEO_MS);
    return () => clearInterval(sondeo);
  }, [llave, desafio, viajeId, renovar]);

  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;

  /** Una huella: llave de trayecto nueva, atada a este viaje e integridad del teléfono (CA-1, RN-5). */
  const empezar = async () => {
    if (accion.ocupado()) return;
    setFalla(null);
    try {
      const lectura = await posicionParaEncuentro();
      if (lectura.tipo !== 'ok')
        return setFalla(fallaDeUbicacion(lectura, tipo));
      const llavePublicaPem = await crearLlaveTrayecto('conductor');
      const nonce = nonceAleatorio();
      const tokenIntegridad = await pedirTokenIntegridad(nonce);
      const r = await accion.ejecutar((opciones) =>
        registrarLlaveTrayecto(
          viajeId,
          { llavePublicaPem, tokenIntegridad },
          { ...opciones, nonce },
        ),
      );
      if (!r || !montada.current) return;
      setLlave(r.llaveTrayectoId);
      await renovar(r.llaveTrayectoId);
    } catch (error) {
      if (montada.current)
        setFalla(fallaDeAbordaje(error, 'mostrar_codigo', tipo));
    }
  };

  const restante = desafio
    ? Math.max(0, Math.ceil((pedidoEn + RENOVAR_MS - ahora) / 1000))
    : 0;

  return (
    <View style={estilos.raiz}>
      <StatusBar style="dark" />
      <View style={[estilos.barra, { paddingTop: top + espacio(2) }]}>
        <BotonIcono
          icono="close"
          etiqueta={t('comun.acciones.cerrar')}
          alPresionar={() => router.back()}
        />
        <Text style={estilos.titulo} accessibilityRole="header">
          {texto(tipo, 'titulo_conductor')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={estilos.contenido}>
        {!llave && (
          <Text style={estilos.secundario}>
            {texto(tipo, 'intro_conductor')}
          </Text>
        )}

        {falla && (
          <>
            <AvisoFallaAbordaje falla={falla} />
            {llave && (
              <Boton
                variante="secundario"
                icono="refresh"
                etiqueta={t('comun.acciones.reintentar')}
                alPresionar={() => void renovar(llave)}
              />
            )}
          </>
        )}

        {llave && !desafio && !falla && (
          <Text style={estilos.secundario}>
            {t('presencia.abordaje.preparando')}
          </Text>
        )}

        {desafio && (
          <>
            <View style={estilos.qr}>
              <Image
                accessibilityLabel={texto(tipo, 'qr')}
                source={{
                  uri: `data:image/png;base64,${desafio.qrImagenBase64}`,
                }}
                style={estilos.imagenQr}
              />
            </View>
            <View
              style={estilos.barraTiempo}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <View
                style={[
                  estilos.barraLlena,
                  { width: `${(restante * 100) / (RENOVAR_MS / 1000)}%` },
                ]}
              />
            </View>
            <Text style={estilos.enfasis}>
              {con('presencia.abordaje.nuevo_en', { segundos: restante })}
            </Text>
            <Text style={estilos.secundario}>
              {t('presencia.abordaje.recordatorio')}
            </Text>
          </>
        )}

        {llave && pasajeros.length > 0 && (
          <View style={estilos.lista}>
            <Text style={estilos.subtitulo} accessibilityRole="header">
              {t('presencia.abordaje.pasajeros')}
            </Text>
            {pasajeros.map((p) => {
              const listo = yaAbordo(p.estado);
              return (
                <View key={p.reservaId} style={estilos.fila}>
                  <Text style={estilos.enfasis}>{p.nombre}</Text>
                  {tipo === 'bajada' ? (
                    <EtiquetaEstado
                      dominio="reserva"
                      estado={p.estado}
                      texto={t(`reservas.estado.${p.estado}`)}
                    />
                  ) : (
                    <EtiquetaEstado
                      dominio="reserva"
                      estado={listo ? 'verificada' : 'pendiente'}
                      texto={t(
                        listo
                          ? 'presencia.abordaje.pasajero_verificado'
                          : 'presencia.abordaje.pasajero_esperando',
                      )}
                    />
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {tipo === 'abordaje' && algunoAbordo && (
        <ZonaAccion>
          <Boton
            anchoCompleto
            variante="secundario"
            icono="near_me"
            etiqueta={t('presencia.trayecto.ver_viaje')}
            alPresionar={() =>
              router.replace(`/viaje-activo/${viajeId}?rol=conductor`)
            }
          />
        </ZonaAccion>
      )}
      {!llave && (
        <ZonaAccion>
          <ConfirmacionBiometrica
            estado={accion.estado}
            etiqueta={t('presencia.abordaje.boton_mostrar')}
            enviando={t('presencia.abordaje.preparando')}
            alConfirmar={() => void empezar()}
          />
        </ZonaAccion>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.superficie },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(2),
    paddingHorizontal: espacio(2),
  },
  titulo: { ...tipografia.titulo, color: colores.texto, flexShrink: 1 },
  contenido: { gap: espacio(4), padding: espacio(4), alignItems: 'stretch' },
  // QR negro sobre blanco, grande y con margen: se lee desde otro teléfono a un brazo de distancia.
  qr: {
    alignSelf: 'center',
    padding: espacio(3),
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: '#FFFFFF',
  },
  imagenQr: { width: 264, height: 264 },
  barraTiempo: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colores.fondoSutil,
  },
  barraLlena: { height: 6, backgroundColor: colores.primario },
  lista: { gap: espacio(2) },
  fila: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacio(2),
  },
  subtitulo: { ...tipografia.subtitulo, color: colores.texto },
  enfasis: { ...tipografia.cuerpoEnfasis, color: colores.texto },
  secundario: { ...tipografia.secundario, color: colores.textoSecundario },
});

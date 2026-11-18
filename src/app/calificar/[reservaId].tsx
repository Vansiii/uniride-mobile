import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  calificarReserva,
  consultarCalificacion,
  ErrorApi,
  type EstadoCalificacion,
} from '@/api/cliente';
import { Esqueleto } from '@/componentes/Animado';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { ZonaAccion } from '@/componentes/Estructura';
import { Aviso } from '@/componentes/Mensajes';
import { useSesion } from '@/contexto/sesion';
import { con, t } from '@/i18n';
import { colores, espacio, radio, tamano, tipografia } from '@/tema/tokens';

const ESTRELLAS = [1, 2, 3, 4, 5];
const MAXIMO_COMENTARIO = 140;

/** Por qué no se puede calificar: sin pago, plazo vencido o ya hecha (HU-21 CA-3, CA-4, CA-5). */
const motivo = (estado: EstadoCalificacion) =>
  estado.plazoHasta === null
    ? 'calificaciones.no_pagada'
    : new Date(estado.plazoHasta).getTime() < Date.now()
      ? 'calificaciones.plazo_vencido'
      : 'calificaciones.ya_calificada';

/** Códigos del servidor → texto; cualquier otro es un fallo para reintentar. */
const TEXTO_ERROR: Record<string, string> = {
  YA_CALIFICADA: 'calificaciones.ya_calificada',
  PLAZO_VENCIDO: 'calificaciones.plazo_vencido',
  RESERVA_NO_PAGADA: 'calificaciones.no_pagada',
};

/** HU-21: estrellas de 1 a 5 y comentario opcional. No mueve dinero: basta la sesión. */
export default function CalificarPantalla() {
  const { cargando: cargandoSesion, usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const { reservaId } = useLocalSearchParams<{ reservaId: string }>();
  const [estado, setEstado] = useState<EstadoCalificacion | null>(null);
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [falla, setFalla] = useState(false);

  useEffect(() => {
    if (cargandoSesion || !usuario || !reservaId) return;
    let cancelado = false;
    consultarCalificacion(reservaId)
      .then((e) => !cancelado && setEstado(e))
      .catch(() => !cancelado && setFalla(true));
    return () => {
      cancelado = true;
    };
  }, [cargandoSesion, usuario, reservaId]);

  if (cargandoSesion) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;

  const enviar = async () => {
    if (estrellas === 0) {
      setAviso(t('calificaciones.elige'));
      return;
    }
    setEnviando(true);
    setAviso(null);
    try {
      await calificarReserva(reservaId, estrellas, comentario);
      setHecho(true);
    } catch (err) {
      setAviso(
        t(
          (err instanceof ErrorApi && TEXTO_ERROR[err.codigo]) ||
            'calificaciones.error',
        ),
      );
    } finally {
      setEnviando(false);
    }
  };

  const nombre = estado?.destinatario ?? '';
  return (
    <View style={estilos.raiz}>
      <StatusBar style="dark" />
      <View style={[estilos.barra, { paddingTop: top }]}>
        <BotonIcono
          icono="close"
          etiqueta={t('comun.acciones.cerrar')}
          alPresionar={() => router.back()}
        />
      </View>

      {!estado && !falla && (
        <View
          style={estilos.centrado}
          accessibilityLabel={t('comun.estados.cargando')}
        >
          <Esqueleto alto={120} redondeo={radio.l} />
        </View>
      )}
      {falla && (
        <View style={estilos.centrado}>
          <Aviso tono="peligro">{t('calificaciones.error')}</Aviso>
        </View>
      )}

      {estado && (
        <>
          <ScrollView
            contentContainerStyle={estilos.contenido}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={estilos.titulo} accessibilityRole="header">
              {hecho
                ? t('calificaciones.gracias')
                : con('calificaciones.titulo', { nombre })}
            </Text>

            {estado.recibida && (
              <Aviso tono="info">
                {con('calificaciones.recibida', {
                  nombre,
                  n: estado.recibida.estrellas,
                })}
                {estado.recibida.comentario
                  ? ` «${estado.recibida.comentario}»`
                  : ''}
              </Aviso>
            )}

            {!hecho && !estado.puedoCalificar && (
              <Aviso tono="info">{t(motivo(estado))}</Aviso>
            )}

            {!hecho && estado.puedoCalificar && (
              <>
                <View
                  style={estilos.estrellas}
                  accessibilityRole="radiogroup"
                  accessibilityLabel={t('calificaciones.estrellas')}
                >
                  {ESTRELLAS.map((n) => (
                    <Pressable
                      key={n}
                      accessibilityRole="radio"
                      accessibilityLabel={
                        n === 1
                          ? t('calificaciones.estrella_uno')
                          : con('calificaciones.estrellas_n', { n })
                      }
                      accessibilityState={{ selected: estrellas === n }}
                      onPress={() => setEstrellas(n)}
                      style={estilos.estrella}
                    >
                      <Text
                        style={[
                          estilos.glifo,
                          n <= estrellas && estilos.glifoActivo,
                        ]}
                      >
                        {n <= estrellas ? '★' : '☆'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={estilos.campo}>
                  <Campo
                    etiqueta={t('calificaciones.comentario')}
                    ayuda={con('calificaciones.comentario_ayuda', {
                      n: comentario.length,
                    })}
                    value={comentario}
                    onChangeText={setComentario}
                    maxLength={MAXIMO_COMENTARIO}
                    multiline
                  />
                </View>
                {aviso && <Aviso tono="peligro">{aviso}</Aviso>}
              </>
            )}
          </ScrollView>
          <ZonaAccion>
            {!hecho && estado.puedoCalificar ? (
              <Boton
                anchoCompleto
                etiqueta={t(
                  enviando
                    ? 'calificaciones.enviando'
                    : 'calificaciones.enviar',
                )}
                cargando={enviando}
                alPresionar={() => void enviar()}
              />
            ) : (
              <Boton
                anchoCompleto
                variante="secundario"
                etiqueta={t('comun.acciones.cerrar')}
                alPresionar={() => router.back()}
              />
            )}
          </ZonaAccion>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondoSutil },
  barra: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: espacio(2),
  },
  centrado: { flex: 1, padding: espacio(4), gap: espacio(3) },
  contenido: {
    flexGrow: 1,
    gap: espacio(4),
    alignItems: 'center',
    padding: espacio(6),
  },
  titulo: {
    ...tipografia.pantalla,
    color: colores.texto,
    textAlign: 'center',
  },
  estrellas: { flexDirection: 'row', gap: espacio(1) },
  estrella: {
    minWidth: tamano.tactilMinimo,
    minHeight: tamano.tactilMinimo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glifo: { fontSize: 36, color: colores.textoPlaceholder },
  glifoActivo: { color: colores.primario },
  campo: { alignSelf: 'stretch' },
});

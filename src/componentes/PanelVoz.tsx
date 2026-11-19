import { useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { type ComponentProps, useEffect } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { espacio, radio, sombraElevada, tipografia } from '@/tema/tokens';
import { con, t } from '@/i18n';
import type { EstadoVoz } from '../voz/useVoz';
import { Entra, Toque } from './Animado';
import { Boton, BotonIcono } from './Boton';
import { Icono } from './Icono';
import { crearEstilos, useColores } from '@/tema/useEstilos';

interface Props {
  visible: boolean;
  estado: EstadoVoz;
  transcripcion?: string;
  mensaje?: string;
  fallosSeguidos?: number;
  alCerrar: () => void;
  alReintentar: () => void;
  alUsarTeclado?: () => void;
  /** Tocar el micrófono mientras escucha: termina la frase sin esperar el silencio. */
  alTerminar?: () => void;
  /** Tocar una sugerencia: hace lo mismo que decirla. */
  alProbar?: (texto: string) => void;
}

const SUGERENCIAS = [
  'voz.panel.sugerencia_buscar',
  'voz.panel.sugerencia_saldo',
  'voz.panel.sugerencia_conductor',
  'voz.panel.sugerencia_viaje',
  'voz.panel.sugerencia_ayuda',
];

const MOVIMIENTO = { reduceMotion: ReduceMotion.System };

/** Micrófono con ondas que crecen con tu voz (nivel del reconocedor) y respiran cuando hay silencio. */
function Microfono({ alPresionar }: { alPresionar?: () => void }) {
  const colores = useColores();
  const estilos = useEstilos();
  const nivel = useSharedValue(0);
  const respiro = useSharedValue(0);

  useEffect(() => {
    respiro.set(
      withRepeat(
        withTiming(1, {
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          ...MOVIMIENTO,
        }),
        -1,
        true,
      ),
    );
  }, [respiro]);

  // De −2 (nada) a 10 (fuerte); por debajo de 0 es inaudible.
  useSpeechRecognitionEvent('volumechange', ({ value }) => {
    nivel.set(
      withTiming(Math.min(1, Math.max(0, value / 10)), {
        duration: 120,
        ...MOVIMIENTO,
      }),
    );
  });

  const ondaInterna = useAnimatedStyle(() => ({
    opacity: 0.35,
    transform: [{ scale: 1.15 + respiro.value * 0.08 + nivel.value * 0.35 }],
  }));
  const ondaExterna = useAnimatedStyle(() => ({
    opacity: 0.18,
    transform: [{ scale: 1.35 + respiro.value * 0.12 + nivel.value * 0.75 }],
  }));

  return (
    <View style={estilos.zonaMicrofono}>
      <Animated.View style={[estilos.onda, ondaExterna]} />
      <Animated.View style={[estilos.onda, ondaInterna]} />
      <Toque
        accessibilityRole="button"
        accessibilityLabel={t('voz.panel.terminar')}
        accessibilityHint={t('voz.panel.toca_terminar')}
        onPress={alPresionar}
        disabled={!alPresionar}
        escala={0.92}
        style={estilos.microfono}
      >
        <Icono nombre="mic" color={colores.sobrePrimario} tamano={32} />
      </Toque>
    </View>
  );
}

function IconoEstado({
  nombre,
  fondo,
  color,
}: {
  nombre: ComponentProps<typeof Icono>['nombre'];
  fondo: string;
  color: string;
}) {
  const estilos = useEstilos();
  return (
    <View style={[estilos.iconoEstado, { backgroundColor: fondo }]}>
      <Icono nombre={nombre} color={color} tamano={32} />
    </View>
  );
}

/**
 * PanelVoz (DESIGN_SYSTEM §8.10): Hoja inferior con los estados de la interacción por voz:
 * Escuchando, Procesando, Respuesta, No entendí, Sin permiso y No disponible.
 * Lo que dijiste queda a la vista en cada paso, para saber qué entendió la app.
 */
export function PanelVoz({
  visible,
  estado,
  transcripcion = '',
  mensaje = '',
  fallosSeguidos = 0,
  alCerrar,
  alReintentar,
  alUsarTeclado,
  alTerminar,
  alProbar,
}: Props) {
  const colores = useColores();
  const estilos = useEstilos();
  const { bottom } = useSafeAreaInsets();

  if (!visible && estado === 'inactivo') return null;

  const dicho = transcripcion.trim();
  const eco = (clave: string) =>
    dicho ? (
      <Text style={estilos.eco} numberOfLines={2}>
        {con(clave, { texto: dicho })}
      </Text>
    ) : null;

  return (
    <Modal
      transparent
      statusBarTranslucent
      animationType="fade"
      visible={visible}
      onRequestClose={alCerrar}
    >
      <Pressable
        style={estilos.telon}
        onPress={alCerrar}
        accessibilityLabel={t('comun.acciones.cerrar')}
      >
        <Entra>
          <Pressable
            style={[
              estilos.hoja,
              { paddingBottom: Math.max(bottom, espacio(4)) },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={estilos.manija} />

            <View style={estilos.cabecera}>
              <Text
                style={estilos.titulo}
                accessibilityRole="header"
                accessibilityLiveRegion="polite"
              >
                {estado === 'escuchando'
                  ? t('voz.panel.te_escucho')
                  : estado === 'procesando'
                    ? t('voz.panel.procesando')
                    : t('voz.boton.etiqueta')}
              </Text>
              <BotonIcono
                icono="close"
                etiqueta={t('comun.acciones.cerrar')}
                color={colores.textoSecundario}
                alPresionar={alCerrar}
              />
            </View>

            {/* La clave por estado hace que cada paso entre con su propia transición. */}
            <Entra key={estado} style={estilos.contenido}>
              {estado === 'escuchando' && (
                <>
                  <Microfono alPresionar={alTerminar} />
                  <Text
                    style={dicho ? estilos.transcripcion : estilos.ejemplo}
                    accessibilityLiveRegion="polite"
                  >
                    {dicho ? `«${dicho}»` : t('voz.panel.ejemplo')}
                  </Text>
                  {alTerminar && (
                    <Text style={estilos.pista}>
                      {t('voz.panel.toca_terminar')}
                    </Text>
                  )}
                  {!dicho && alProbar && (
                    <View style={estilos.sugerencias}>
                      <Text style={estilos.pista}>{t('voz.panel.prueba')}</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={estilos.fichas}
                      >
                        {SUGERENCIAS.map((clave) => (
                          <Toque
                            key={clave}
                            accessibilityRole="button"
                            accessibilityLabel={t(clave)}
                            onPress={() => alProbar(t(clave))}
                            style={estilos.ficha}
                          >
                            <Text style={estilos.textoFicha}>{t(clave)}</Text>
                          </Toque>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}

              {estado === 'procesando' && (
                <>
                  {eco('voz.panel.dijiste')}
                  <ActivityIndicator size="large" color={colores.primario} />
                  <Text style={estilos.mensaje}>
                    {mensaje || t('voz.panel.procesando')}
                  </Text>
                </>
              )}

              {estado === 'respuesta' && (
                <>
                  {eco('voz.panel.dijiste')}
                  <IconoEstado
                    nombre="check_circle"
                    fondo={colores.exitoSuave}
                    color={colores.exito}
                  />
                  <Text
                    style={estilos.mensaje}
                    accessibilityLiveRegion="polite"
                  >
                    {mensaje}
                  </Text>
                  <View style={estilos.acciones}>
                    <Boton
                      icono="mic"
                      etiqueta={t('voz.panel.otra_pregunta')}
                      alPresionar={alReintentar}
                      variante="secundario"
                    />
                    <Boton
                      etiqueta={t('voz.panel.listo')}
                      alPresionar={alCerrar}
                      variante="texto"
                    />
                  </View>
                </>
              )}

              {estado === 'no_entendi' && (
                <>
                  {eco('voz.panel.escuche')}
                  <IconoEstado
                    nombre="warning"
                    fondo={colores.avisoSuave}
                    color={colores.aviso}
                  />
                  <Text
                    style={estilos.mensaje}
                    accessibilityLiveRegion="polite"
                  >
                    {mensaje || t('voz.comun.no_entendi')}
                  </Text>
                  <View style={estilos.acciones}>
                    <Boton
                      icono="mic"
                      etiqueta={t('voz.panel.volver_intentar')}
                      alPresionar={alReintentar}
                      variante="primario"
                    />
                    {fallosSeguidos >= 2 && alUsarTeclado && (
                      <Boton
                        etiqueta={t('voz.comun.usar_teclado')}
                        alPresionar={alUsarTeclado}
                        variante="secundario"
                      />
                    )}
                  </View>
                </>
              )}

              {(estado === 'sin_permiso' || estado === 'permiso_bloqueado') && (
                <>
                  <IconoEstado
                    nombre="mic_off"
                    fondo={colores.peligroSuave}
                    color={colores.peligro}
                  />
                  <Text style={estilos.mensaje}>
                    {mensaje || t('voz.permiso.microfono')}
                  </Text>
                  <View style={estilos.acciones}>
                    {/* Mientras Android pueda mostrar el diálogo, se vuelve a pedir el permiso aquí mismo. */}
                    {estado === 'sin_permiso' ? (
                      <Boton
                        icono="mic"
                        etiqueta={t('voz.permiso.permitir')}
                        alPresionar={alReintentar}
                        variante="primario"
                      />
                    ) : (
                      <Boton
                        etiqueta={t('voz.permiso.abrir_ajustes')}
                        alPresionar={() => void Linking.openSettings()}
                        variante="primario"
                      />
                    )}
                  </View>
                </>
              )}

              {estado === 'no_disponible' && (
                <>
                  <IconoEstado
                    nombre="mic_off"
                    fondo={colores.fondoDeshabilitado}
                    color={colores.textoDeshabilitado}
                  />
                  <Text style={estilos.mensaje}>
                    {mensaje || t('voz.comun.no_disponible')}
                  </Text>
                  <View style={estilos.acciones}>
                    <Boton
                      etiqueta={t('comun.acciones.cerrar')}
                      alPresionar={alCerrar}
                      variante="secundario"
                    />
                  </View>
                </>
              )}
            </Entra>
          </Pressable>
        </Entra>
      </Pressable>
    </Modal>
  );
}

const TAM_MICROFONO = 80;

const useEstilos = crearEstilos((colores) => ({
  telon: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 41, 0.5)',
    justifyContent: 'flex-end',
  },
  hoja: {
    backgroundColor: colores.superficie,
    borderTopLeftRadius: radio.xl,
    borderTopRightRadius: radio.xl,
    paddingHorizontal: espacio(5),
    paddingTop: espacio(3),
    minHeight: 320,
    gap: espacio(2),
    ...sombraElevada,
  },
  manija: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colores.borde,
    alignSelf: 'center',
    marginBottom: espacio(1),
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titulo: {
    ...tipografia.subtitulo,
    color: colores.texto,
  },
  contenido: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio(4),
    paddingVertical: espacio(3),
  },
  zonaMicrofono: {
    width: TAM_MICROFONO * 2.4,
    height: TAM_MICROFONO * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onda: {
    position: 'absolute',
    width: TAM_MICROFONO,
    height: TAM_MICROFONO,
    borderRadius: TAM_MICROFONO / 2,
    backgroundColor: colores.primario,
  },
  microfono: {
    width: TAM_MICROFONO,
    height: TAM_MICROFONO,
    borderRadius: TAM_MICROFONO / 2,
    backgroundColor: colores.primario,
    alignItems: 'center',
    justifyContent: 'center',
    ...sombraElevada,
  },
  iconoEstado: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcripcion: {
    ...tipografia.titulo,
    color: colores.texto,
    textAlign: 'center',
    paddingHorizontal: espacio(2),
  },
  ejemplo: {
    ...tipografia.cuerpo,
    color: colores.textoSecundario,
    textAlign: 'center',
    paddingHorizontal: espacio(4),
  },
  eco: {
    ...tipografia.secundario,
    color: colores.textoSecundario,
    textAlign: 'center',
    paddingHorizontal: espacio(4),
  },
  pista: {
    ...tipografia.pequeno,
    color: colores.textoSecundario,
    textAlign: 'center',
  },
  sugerencias: { alignSelf: 'stretch', gap: espacio(2) },
  fichas: { gap: espacio(2), paddingHorizontal: espacio(1) },
  ficha: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: espacio(4),
    borderRadius: radio.completo,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.primarioSuave,
  },
  textoFicha: { ...tipografia.etiqueta, color: colores.primarioTexto },
  mensaje: {
    ...tipografia.cuerpoEnfasis,
    color: colores.texto,
    textAlign: 'center',
    paddingHorizontal: espacio(4),
  },
  acciones: {
    width: '100%',
    gap: espacio(2),
    marginTop: espacio(1),
  },
}));

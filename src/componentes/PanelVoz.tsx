import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { espacio, radio, tipografia } from '@/tema/tokens';
import { t } from '@/i18n';
import type { EstadoVoz } from '../voz/useVoz';
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
}

/**
 * PanelVoz (DESIGN_SYSTEM §8.10): Hoja inferior con los estados de la interacción por voz:
 * Escuchando, Procesando, Respuesta, No entendí, Sin permiso y No disponible.
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
}: Props) {
  const colores = useColores();
  const estilos = useEstilos();
  const { bottom } = useSafeAreaInsets();

  if (!visible && estado === 'inactivo') return null;

  const abrirAjustes = () => {
    Linking.openSettings();
  };

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={alCerrar}
    >
      <Pressable
        style={estilos.telon}
        onPress={alCerrar}
        accessibilityLabel={t('comun.acciones.cerrar')}
      >
        <Pressable
          style={[
            estilos.hoja,
            { paddingBottom: Math.max(bottom, espacio(4)) },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Manija superior */}
          <View style={estilos.manija} />

          {/* Cabecera del panel */}
          <View style={estilos.cabecera}>
            <Text style={estilos.titulo}>
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

          {/* Contenido según estado */}
          {estado === 'escuchando' && (
            <View style={estilos.contenido}>
              <View style={estilos.circuloMicrofono}>
                <Icono nombre="mic" color={colores.sobrePrimario} tamano={32} />
              </View>
              <Text style={estilos.transcripcion}>
                {transcripcion ? `«${transcripcion}»` : t('voz.panel.ejemplo')}
              </Text>
            </View>
          )}

          {estado === 'procesando' && (
            <View style={estilos.contenido}>
              <ActivityIndicator size="large" color={colores.primario} />
              <Text style={estilos.mensaje}>
                {mensaje || t('voz.panel.procesando')}
              </Text>
            </View>
          )}

          {estado === 'respuesta' && (
            <View style={estilos.contenido}>
              <View
                style={[
                  estilos.iconoEstado,
                  { backgroundColor: colores.exitoSuave },
                ]}
              >
                <Icono
                  nombre="check_circle"
                  color={colores.exito}
                  tamano={32}
                />
              </View>
              <Text style={estilos.mensaje}>{mensaje}</Text>
            </View>
          )}

          {estado === 'no_entendi' && (
            <View style={estilos.contenido}>
              <View
                style={[
                  estilos.iconoEstado,
                  { backgroundColor: colores.avisoSuave },
                ]}
              >
                <Icono nombre="warning" color={colores.aviso} tamano={32} />
              </View>
              <Text style={estilos.mensaje}>
                {mensaje || t('voz.comun.no_entendi')}
              </Text>
              <View style={estilos.acciones}>
                <Boton
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
            </View>
          )}

          {(estado === 'sin_permiso' || estado === 'permiso_bloqueado') && (
            <View style={estilos.contenido}>
              <View
                style={[
                  estilos.iconoEstado,
                  { backgroundColor: colores.peligroSuave },
                ]}
              >
                <Icono nombre="mic_off" color={colores.peligro} tamano={32} />
              </View>
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
                    alPresionar={abrirAjustes}
                    variante="primario"
                  />
                )}
              </View>
            </View>
          )}

          {estado === 'no_disponible' && (
            <View style={estilos.contenido}>
              <View
                style={[
                  estilos.iconoEstado,
                  { backgroundColor: colores.fondoDeshabilitado },
                ]}
              >
                <Icono
                  nombre="mic_off"
                  color={colores.textoDeshabilitado}
                  tamano={32}
                />
              </View>
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
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useEstilos = crearEstilos((colores) => ({
  telon: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 41, 0.45)',
    justifyContent: 'flex-end',
  },
  hoja: {
    backgroundColor: colores.superficie,
    borderTopLeftRadius: radio.xl,
    borderTopRightRadius: radio.xl,
    paddingHorizontal: espacio(5),
    paddingTop: espacio(3),
    minHeight: 280,
    gap: espacio(4),
  },
  manija: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colores.borde,
    alignSelf: 'center',
    marginBottom: espacio(2),
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
  circuloMicrofono: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colores.primario,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconoEstado: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcripcion: {
    ...tipografia.cuerpo,
    color: colores.textoSecundario,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: espacio(4),
  },
  mensaje: {
    ...tipografia.cuerpoEnfasis,
    color: colores.texto,
    textAlign: 'center',
    paddingHorizontal: espacio(4),
  },
  acciones: {
    width: '100%',
    gap: espacio(3),
    marginTop: espacio(2),
  },
}));

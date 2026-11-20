import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { consultarAsistente, type RespuestaAsistente } from '@/api/cliente';
import { Boton } from './Boton';
import { Icono } from './Icono';
import { t } from '@/i18n';
import { espacio, radio, tipografia } from '@/tema/tokens';
import { crearEstilos, useColores } from '@/tema/useEstilos';
import type { Paleta } from '@/tema/paletas';

interface Props {
  visible: boolean;
  alCerrar: () => void;
  onNavegar?: (ruta: string, params?: Record<string, string>) => void;
}

const SUGERENCIAS = [
  'asistente.sugerencia_1',
  'asistente.sugerencia_2',
  'asistente.sugerencia_3',
];

export function TarjetaGuiaAsistente({
  visible,
  alCerrar,
  onNavegar,
}: Props) {
  const colores = useColores();
  const estilos = useEstilos();
  const [consulta, setConsulta] = useState('');
  const [cargando, setCargando] = useState(false);
  const [respuesta, setRespuesta] = useState<RespuestaAsistente | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ejecutarConsulta = async (texto: string) => {
    const limpio = texto.trim();
    if (!limpio || cargando) return;

    setCargando(true);
    setError(null);
    setRespuesta(null);

    try {
      const res = await consultarAsistente(limpio);
      setRespuesta(res);
    } catch {
      setError(t('asistente.error_consulta'));
    } finally {
      setCargando(false);
    }
  };

  const ejecutarNavegacion = (ruta: string, params?: Record<string, string>) => {
    alCerrar();
    if (onNavegar) {
      onNavegar(ruta, params);
    } else {
      router.push({ pathname: ruta as any, params });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={alCerrar}
    >
      <View style={estilos.superposicion}>
        <Pressable style={estilos.fondo} onPress={alCerrar} />
        <View style={estilos.tarjeta} accessibilityRole="dialog">
          {/* Cabecera */}
          <View style={estilos.cabecera}>
            <View style={estilos.tituloFila}>
              <Icono nombre="info" color={colores.primario} tamano={20} />
              <Text style={estilos.titulo}>{t('asistente.titulo')}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('asistente.cerrar')}
              onPress={alCerrar}
              style={estilos.botonCerrar}
            >
              <Icono nombre="close" color={colores.textoSecundario} tamano={20} />
            </Pressable>
          </View>

          <ScrollView style={estilos.cuerpo} keyboardShouldPersistTaps="handled">
            {cargando && (
              <View style={estilos.filaCargando}>
                <ActivityIndicator color={colores.primario} size="small" />
                <Text style={estilos.textoCargando}>
                  {t('asistente.consultando')}
                </Text>
              </View>
            )}

            {error && <Text style={estilos.textoError}>{error}</Text>}

            {respuesta ? (
              <View style={estilos.seccionRespuesta}>
                <Text style={estilos.mensajeRespuesta}>
                  {respuesta.mensaje}
                </Text>

                {respuesta.pasos && respuesta.pasos.length > 0 && (
                  <View style={estilos.contenedorPasos}>
                    {respuesta.pasos.map((paso, idx) => (
                      <View key={idx} style={estilos.itemPaso}>
                        <Text style={estilos.numeroPaso}>{idx + 1}.</Text>
                        <Text style={estilos.textoPaso}>{paso}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {respuesta.accion && (
                  <View style={estilos.contenedorAccion}>
                    <Boton
                      etiqueta={respuesta.accion.etiquetaBoton || t('asistente.ir_ahora')}
                      alPresionar={() =>
                        ejecutarNavegacion(
                          respuesta.accion!.ruta,
                          respuesta.accion!.params,
                        )
                      }
                      variante="primario"
                    />
                  </View>
                )}
              </View>
            ) : (
              !cargando && (
                <View style={estilos.seccionSugerencias}>
                  <Text style={estilos.etiquetaSugerencias}>
                    {t('asistente.descripcion')}
                  </Text>
                  {SUGERENCIAS.map((clave) => (
                    <Pressable
                      key={clave}
                      style={estilos.chipSugerencia}
                      onPress={() => {
                        const texto = t(clave);
                        setConsulta(texto);
                        ejecutarConsulta(texto);
                      }}
                    >
                      <Text style={estilos.textoChip}>{t(clave)}</Text>
                    </Pressable>
                  ))}
                </View>
              )
            )}
          </ScrollView>

          {/* Formulario de entrada */}
          <View style={estilos.formulario}>
            <TextInput
              style={estilos.entrada}
              value={consulta}
              onChangeText={setConsulta}
              placeholder={t('asistente.placeholder')}
              placeholderTextColor={colores.textoPlaceholder}
              returnKeyType="search"
              onSubmitEditing={() => ejecutarConsulta(consulta)}
            />
            <Boton
              etiqueta={t('asistente.consultar')}
              alPresionar={() => ejecutarConsulta(consulta)}
              deshabilitado={!consulta.trim() || cargando}
              variante="primario"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useEstilos = crearEstilos((colores: Paleta) => ({
  superposicion: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    padding: espacio(4),
  },
  fondo: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: espacio(4),
    paddingVertical: espacio(3),
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
    backgroundColor: colores.fondoSutil,
  },
  tituloFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(2),
  },
  titulo: {
    ...tipografia.subtitulo,
    color: colores.texto,
    fontSize: 16,
    fontWeight: '600',
  },
  botonCerrar: {
    padding: espacio(1),
  },
  cuerpo: {
    padding: espacio(4),
  },
  filaCargando: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(2),
    marginVertical: espacio(3),
  },
  textoCargando: {
    ...tipografia.cuerpo,
    color: colores.textoSecundario,
  },
  textoError: {
    ...tipografia.cuerpo,
    color: colores.peligro,
    marginVertical: espacio(2),
  },
  seccionRespuesta: {
    gap: espacio(3),
  },
  mensajeRespuesta: {
    ...tipografia.cuerpo,
    color: colores.texto,
    lineHeight: 22,
  },
  contenedorPasos: {
    gap: espacio(2),
    backgroundColor: colores.fondoSutil,
    padding: espacio(3),
    borderRadius: radio.m,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  itemPaso: {
    flexDirection: 'row',
    gap: espacio(2),
  },
  numeroPaso: {
    ...tipografia.cuerpoEnfasis,
    color: colores.primario,
  },
  textoPaso: {
    ...tipografia.cuerpo,
    color: colores.textoSecundario,
    flex: 1,
  },
  contenedorAccion: {
    marginTop: espacio(2),
  },
  seccionSugerencias: {
    gap: espacio(2),
  },
  etiquetaSugerencias: {
    ...tipografia.pequeno,
    color: colores.textoSecundario,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: espacio(1),
  },
  chipSugerencia: {
    backgroundColor: colores.fondoSutil,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radio.m,
    paddingHorizontal: espacio(3),
    paddingVertical: espacio(2),
  },
  textoChip: {
    ...tipografia.cuerpo,
    color: colores.texto,
    fontSize: 14,
  },
  formulario: {
    flexDirection: 'row',
    padding: espacio(3),
    borderTopWidth: 1,
    borderTopColor: colores.borde,
    gap: espacio(2),
    backgroundColor: colores.superficie,
  },
  entrada: {
    ...tipografia.cuerpo,
    flex: 1,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radio.m,
    paddingHorizontal: espacio(3),
    paddingVertical: espacio(2),
    color: colores.texto,
    backgroundColor: colores.fondoSutil,
  },
}));

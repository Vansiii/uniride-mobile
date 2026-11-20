import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Boton } from './Boton';
import { Icono } from './Icono';
import { t } from '@/i18n';
import { espacio, radio, tipografia } from '@/tema/tokens';
import { crearEstilos, useColores } from '@/tema/useEstilos';
import type { Paleta } from '@/tema/paletas';

interface Props {
  visible: boolean;
  alCerrar: () => void;
}

const PASOS = [
  {
    icono: 'lock' as const,
    tituloClave: 'tutorial.paso_1_titulo',
    descClave: 'tutorial.paso_1_desc',
  },
  {
    icono: 'qr_code_2' as const,
    tituloClave: 'tutorial.paso_2_titulo',
    descClave: 'tutorial.paso_2_desc',
  },
  {
    icono: 'check_circle' as const,
    tituloClave: 'tutorial.paso_3_titulo',
    descClave: 'tutorial.paso_3_desc',
  },
];

export function TutorialUniRide({ visible, alCerrar }: Props) {
  const colores = useColores();
  const estilos = useEstilos();
  const [paso, setPaso] = useState(0);

  const avanzar = () => {
    if (paso < PASOS.length - 1) {
      setPaso(paso + 1);
    } else {
      setPaso(0);
      alCerrar();
    }
  };

  const cerrarTutorial = () => {
    setPaso(0);
    alCerrar();
  };

  const pasoActual = PASOS[paso]!;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={cerrarTutorial}
    >
      <View style={estilos.superposicion}>
        <Pressable style={estilos.fondo} onPress={cerrarTutorial} />
        <View style={estilos.tarjeta} accessibilityRole="dialog">
          {/* Cabecera */}
          <View style={estilos.cabecera}>
            <Text style={estilos.titulo}>{t('tutorial.titulo')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('tutorial.cerrar')}
              onPress={cerrarTutorial}
              style={estilos.botonCerrar}
            >
              <Icono
                nombre="close"
                color={colores.textoSecundario}
                tamano={20}
              />
            </Pressable>
          </View>

          {/* Contenido del paso */}
          <View style={estilos.cuerpo}>
            <View style={estilos.circuloIcono}>
              <Icono
                nombre={pasoActual.icono}
                color={colores.primario}
                tamano={32}
              />
            </View>

            <Text style={estilos.pasoTitulo}>{t(pasoActual.tituloClave)}</Text>
            <Text style={estilos.pasoDesc}>{t(pasoActual.descClave)}</Text>

            {/* Indicadores de progreso */}
            <View style={estilos.indicadores}>
              {PASOS.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    estilos.indicador,
                    idx === paso && estilos.indicadorActivo,
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Pie de acción */}
          <View style={estilos.pie}>
            <Boton
              anchoCompleto
              etiqueta={
                paso < PASOS.length - 1
                  ? t('tutorial.siguiente')
                  : t('tutorial.comenzar')
              }
              alPresionar={avanzar}
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
    padding: espacio(5),
    alignItems: 'center',
    gap: espacio(3),
  },
  circuloIcono: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colores.primarioSuave,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: espacio(2),
  },
  pasoTitulo: {
    ...tipografia.subtitulo,
    color: colores.texto,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
  },
  pasoDesc: {
    ...tipografia.cuerpo,
    color: colores.textoSecundario,
    textAlign: 'center',
    lineHeight: 22,
  },
  indicadores: {
    flexDirection: 'row',
    gap: espacio(2),
    marginTop: espacio(3),
  },
  indicador: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colores.borde,
  },
  indicadorActivo: {
    width: 24,
    backgroundColor: colores.primario,
  },
  pie: {
    padding: espacio(4),
    borderTopWidth: 1,
    borderTopColor: colores.borde,
    backgroundColor: colores.superficie,
  },
}));

import { Redirect, router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarraEstado } from '@/componentes/BarraEstado';
import { BotonIcono } from '@/componentes/Boton';
import { Casilla } from '@/componentes/Casilla';
import { Aviso } from '@/componentes/Mensajes';
import { useSesion } from '@/contexto/sesion';
import { con, t } from '@/i18n';
import { type ModoTema, type TamanoTexto, useTema } from '@/tema/ProveedorTema';
import { espacio, radio, tamano, tipografia } from '@/tema/tokens';
import { crearEstilos } from '@/tema/useEstilos';

const TEMAS: ModoTema[] = ['automatico', 'claro', 'oscuro'];
const TEXTOS: TamanoTexto[] = ['normal', 'grande', 'muy_grande'];

/** Una opción de un grupo: se lee con su nombre y su estado («Tema oscuro, seleccionado», CA-9). */
function Opcion({
  etiqueta,
  nombreAccesible,
  elegida,
  alElegir,
}: {
  etiqueta: string;
  nombreAccesible: string;
  elegida: boolean;
  alElegir: () => void;
}) {
  const estilos = useEstilos();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={nombreAccesible}
      accessibilityState={{ selected: elegida }}
      onPress={alElegir}
      style={[estilos.opcion, elegida && estilos.opcionElegida]}
    >
      <Text
        style={[estilos.etiquetaOpcion, elegida && estilos.etiquetaElegida]}
      >
        {etiqueta}
      </Text>
    </Pressable>
  );
}

/** HU-31: tema, tamaño de texto y alto contraste. Se aplica al tocar y se guarda solo en el teléfono (RN-1). */
export default function AparienciaPantalla() {
  const { cargando, usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const { apariencia, actualizar, noGuardada } = useTema();
  const estilos = useEstilos();

  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;

  return (
    <View style={estilos.raiz}>
      <BarraEstado />
      <View style={[estilos.barra, { paddingTop: top }]}>
        <BotonIcono
          icono="close"
          etiqueta={t('comun.acciones.cerrar')}
          alPresionar={() => router.back()}
        />
      </View>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={estilos.titulo} accessibilityRole="header">
          {t('comun.apariencia.titulo')}
        </Text>
        {noGuardada && (
          <Aviso tono="aviso">{t('comun.apariencia.no_guardada')}</Aviso>
        )}

        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('comun.apariencia.tema')}
          style={estilos.grupo}
        >
          <Text style={estilos.subtitulo}>{t('comun.apariencia.tema')}</Text>
          <View style={estilos.opciones}>
            {TEMAS.map((m) => (
              <Opcion
                key={m}
                etiqueta={t(`comun.apariencia.${m}`)}
                nombreAccesible={con('comun.apariencia.opcion_tema', {
                  opcion: t(`comun.apariencia.${m}`).toLowerCase(),
                })}
                elegida={apariencia.tema === m}
                alElegir={() => actualizar({ tema: m })}
              />
            ))}
          </View>
        </View>

        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('comun.apariencia.texto')}
          style={estilos.grupo}
        >
          <Text style={estilos.subtitulo}>{t('comun.apariencia.texto')}</Text>
          <View style={estilos.opciones}>
            {TEXTOS.map((m) => (
              <Opcion
                key={m}
                etiqueta={t(`comun.apariencia.${m}`)}
                nombreAccesible={con('comun.apariencia.opcion_texto', {
                  opcion: t(`comun.apariencia.${m}`).toLowerCase(),
                })}
                elegida={apariencia.texto === m}
                alElegir={() => actualizar({ texto: m })}
              />
            ))}
          </View>
        </View>

        <View style={estilos.grupo}>
          <Text style={estilos.subtitulo}>
            {t('comun.apariencia.contraste')}
          </Text>
          <Casilla
            etiqueta={t('comun.apariencia.contraste_ayuda')}
            marcada={apariencia.altoContraste}
            alCambiar={(v) => actualizar({ altoContraste: v })}
          />
        </View>
        <Text style={estilos.ayuda}>{t('comun.apariencia.ayuda')}</Text>
      </ScrollView>
    </View>
  );
}

const useEstilos = crearEstilos((colores) => ({
  raiz: { flex: 1, backgroundColor: colores.fondoSutil },
  barra: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: espacio(2),
  },
  contenido: {
    gap: espacio(5),
    padding: espacio(5),
    paddingBottom: espacio(8),
  },
  titulo: { ...tipografia.pantalla, color: colores.texto },
  grupo: {
    gap: espacio(3),
    padding: espacio(4),
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
  },
  subtitulo: { ...tipografia.subtitulo, color: colores.texto },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio(2) },
  opcion: {
    minHeight: tamano.tactilMinimo,
    minWidth: tamano.tactilMinimo,
    justifyContent: 'center',
    paddingHorizontal: espacio(4),
    borderRadius: radio.m,
    borderWidth: 1,
    borderColor: colores.bordeCampo,
    backgroundColor: colores.superficie,
  },
  opcionElegida: {
    borderWidth: 2,
    borderColor: colores.primario,
    backgroundColor: colores.primarioSuave,
  },
  etiquetaOpcion: { ...tipografia.cuerpo, color: colores.texto },
  etiquetaElegida: {
    ...tipografia.cuerpoEnfasis,
    color: colores.primarioTexto,
  },
  ayuda: { ...tipografia.secundario, color: colores.textoSecundario },
}));

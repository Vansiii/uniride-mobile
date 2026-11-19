import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BotonIcono } from '@/componentes/Boton';
import { BotonVoz } from '@/componentes/BotonVoz';
import { PanelVoz } from '@/componentes/PanelVoz';
import { t } from '@/i18n';
import { espacio, radio, sombraTarjeta, tipografia } from '@/tema/tokens';
import { useVoz } from '@/voz/useVoz';
import { crearEstilos } from '@/tema/useEstilos';
import { BarraEstado } from '@/componentes/BarraEstado';

interface ComandoAyuda {
  icono: string;
  titulo: string;
  ejemplo: string;
  alternativa: string;
}

const COMANDOS: ComandoAyuda[] = [
  {
    icono: 'search',
    titulo: 'Buscar viajes',
    ejemplo: '«Busca un viaje a la UAGRM a las 7»',
    alternativa: 'Pestaña Buscar › ingresar destino y hora',
  },
  {
    icono: 'bookmark',
    titulo: 'Reservar viaje',
    ejemplo: '«Reserva el primero» o «Quiero el 2»',
    alternativa: 'Tocar el viaje en la lista y presionar «Reservar y pagar»',
  },
  {
    icono: 'account_balance_wallet',
    titulo: 'Consultar saldo',
    ejemplo: '«¿Cuál es mi saldo?» o «¿Cuánto saldo tengo?»',
    alternativa: 'Pestaña Billetera',
  },
  {
    icono: 'directions_car',
    titulo: 'Ubicación del conductor',
    ejemplo: '«¿Dónde está mi conductor?» o «¿Dónde viene mi conductor?»',
    alternativa: 'Tarjeta de viaje activo o detalle de la reserva',
  },
  {
    icono: 'route',
    titulo: 'Estado de tu viaje',
    ejemplo: '«¿Cómo va mi viaje?» o «Estado de mi viaje»',
    alternativa: 'Tarjeta de viaje activo o pestaña Viajes',
  },
  {
    icono: 'cancel',
    titulo: 'Cancelar viaje o reserva',
    ejemplo: '«Cancela mi viaje» o «Cancelar mi reserva»',
    alternativa: 'Detalle de la reserva o viaje › botón «Cancelar»',
  },
  {
    icono: 'help_outline',
    titulo: 'Pedir ayuda',
    ejemplo: '«Ayúdame» o «¿Qué puedo decir?»',
    alternativa: 'Perfil › Comandos de voz y ayuda',
  },
];

export default function AyudaPantalla() {
  const estilos = useEstilos();
  const { top } = useSafeAreaInsets();
  const voz = useVoz();

  return (
    <View style={estilos.raiz}>
      <BarraEstado />
      <View style={[estilos.cabecera, { paddingTop: top + espacio(2) }]}>
        <BotonIcono
          icono="arrow_back"
          etiqueta="Volver"
          alPresionar={() => router.back()}
        />
        <Text style={estilos.tituloCabecera} accessibilityRole="header">
          {t('perfil.ayuda.titulo')}
        </Text>
        <BotonVoz alPresionar={voz.iniciarEscucha} />
      </View>

      <ScrollView contentContainerStyle={estilos.desplazable}>
        <Text style={estilos.descripcion}>
          Puedes pedirle a UniRide cualquiera de estos comandos con tu voz o
          usar su alternativa táctil en la pantalla:
        </Text>

        <View style={estilos.lista}>
          {COMANDOS.map((c) => (
            <View key={c.titulo} style={estilos.tarjeta}>
              <View style={estilos.iconoContenedor}>
                <Text style={estilos.iconoSimbolo}>{c.icono}</Text>
              </View>
              <View style={estilos.info}>
                <Text style={estilos.tituloComando}>{c.titulo}</Text>
                <Text style={estilos.ejemploTexto}>{c.ejemplo}</Text>
                <View style={estilos.tactilFila}>
                  <Text style={estilos.tactilEtiqueta}>
                    Alternativa táctil:{' '}
                  </Text>
                  <Text style={estilos.tactilValor}>{c.alternativa}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <PanelVoz
        visible={voz.estado !== 'inactivo'}
        estado={voz.estado}
        transcripcion={voz.transcripcion}
        mensaje={voz.mensaje}
        fallosSeguidos={voz.fallosSeguidos}
        alCerrar={voz.cerrar}
        alReintentar={voz.reintentar}
        alTerminar={voz.terminarEscucha}
        alProbar={voz.procesarTexto}
        alUsarTeclado={voz.cerrar}
      />
    </View>
  );
}

const useEstilos = crearEstilos((colores) => ({
  raiz: { flex: 1, backgroundColor: colores.fondoSutil },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: espacio(4),
    paddingBottom: espacio(3),
    backgroundColor: colores.superficie,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
    gap: espacio(3),
  },
  tituloCabecera: {
    ...tipografia.titulo,
    flex: 1,
    color: colores.texto,
  },
  desplazable: {
    padding: espacio(4),
    gap: espacio(4),
    paddingBottom: espacio(8),
  },
  descripcion: {
    ...tipografia.cuerpo,
    color: colores.textoSecundario,
  },
  lista: {
    gap: espacio(3),
  },
  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: radio.l,
    padding: espacio(4),
    flexDirection: 'row',
    gap: espacio(3),
    alignItems: 'flex-start',
    ...sombraTarjeta,
  },
  iconoContenedor: {
    width: 40,
    height: 40,
    borderRadius: radio.m,
    backgroundColor: colores.primarioSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconoSimbolo: {
    fontSize: 20,
    color: colores.primario,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  tituloComando: {
    ...tipografia.subtitulo,
    color: colores.texto,
  },
  ejemploTexto: {
    ...tipografia.cuerpo,
    color: colores.primario,
    fontWeight: '600',
  },
  tactilFila: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  tactilEtiqueta: {
    ...tipografia.secundario,
    color: colores.textoSecundario,
    fontWeight: '500',
  },
  tactilValor: {
    ...tipografia.secundario,
    color: colores.textoPlaceholder,
  },
}));

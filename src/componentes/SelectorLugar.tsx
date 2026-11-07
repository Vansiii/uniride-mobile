import { Ref, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { Icono } from '@/componentes/Icono';
import { t } from '@/i18n';
import { buscarLugares, Lugar } from '@/servicios/geocoding';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';

const MINIMO_BUSQUEDA = 3;

interface Props {
  etiqueta: string;
  lugar: Lugar | null;
  alElegir: (lugar: Lugar | null) => void;
  error?: string;
  refEntrada?: Ref<TextInput>;
}

/** Busca al pedirlo la persona (política de Nominatim) y solo vale un lugar elegido de la lista: trae sus coordenadas (RN-4). */
export function SelectorLugar({
  etiqueta,
  lugar,
  alElegir,
  error,
  refEntrada,
}: Props) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Lugar[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string>();

  const buscar = async () => {
    const consulta = texto.trim();
    setResultados(null);
    if (consulta.length < MINIMO_BUSQUEDA)
      return setAviso(t('viajes.publicar.busqueda_corta'));
    setAviso(undefined);
    setBuscando(true);
    try {
      const encontrados = await buscarLugares(consulta);
      setResultados(encontrados);
      if (!encontrados.length)
        setAviso(t('viajes.publicar.busqueda_sin_resultados'));
    } catch {
      setAviso(t('viajes.publicar.busqueda_fallida'));
    } finally {
      setBuscando(false);
    }
  };

  return (
    <View style={estilos.raiz}>
      <Campo
        refEntrada={refEntrada}
        etiqueta={etiqueta}
        ayuda={lugar ? undefined : t('viajes.publicar.busqueda_ayuda')}
        returnKeyType="search"
        // El intercambio de origen y destino llega por `lugar`: lo elegido manda sobre lo escrito.
        value={lugar ? lugar.nombre : texto}
        // Android deja el cursor al final y un nombre largo se vería sin su comienzo.
        selection={lugar ? { start: 0, end: 0 } : undefined}
        onChangeText={(v) => {
          setTexto(v);
          setResultados(null);
          setAviso(undefined);
          if (lugar) alElegir(null);
        }}
        onSubmitEditing={() => void buscar()}
        // Lo que respondió la última búsqueda dice más que el "elige una opción" de haber tocado Publicar.
        error={aviso ?? error}
      />
      {!lugar && (
        <Boton
          variante="secundario"
          icono="search"
          cargando={buscando}
          etiqueta={t(
            buscando
              ? 'viajes.publicar.buscando'
              : 'viajes.publicar.buscar_lugar',
          )}
          alPresionar={() => void buscar()}
        />
      )}
      {resultados?.map((r) => (
        <Pressable
          key={`${r.lat},${r.lng},${r.detalle}`}
          accessibilityRole="button"
          accessibilityLabel={r.detalle}
          onPress={() => {
            alElegir(r);
            setResultados(null);
          }}
          style={({ pressed }) => [
            estilos.fila,
            pressed && { backgroundColor: colores.primarioSuave },
          ]}
        >
          <Icono
            nombre="location_on"
            color={colores.textoSecundario}
            tamano={20}
          />
          <View style={estilos.textos}>
            <Text style={estilos.nombre}>{r.nombre}</Text>
            <Text style={estilos.detalle} numberOfLines={2}>
              {r.detalle}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { gap: espacio(2) },
  fila: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(2),
    padding: espacio(2),
    borderRadius: radio.m,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
  },
  textos: { flex: 1, gap: 2 },
  nombre: { ...tipografia.cuerpoEnfasis, color: colores.texto },
  detalle: { ...tipografia.secundario, color: colores.textoSecundario },
});

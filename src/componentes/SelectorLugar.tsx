import { Ref, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  type TextInputInstance,
  View,
} from 'react-native';
import { Toque } from '@/componentes/Animado';
import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { Icono } from '@/componentes/Icono';
import { t } from '@/i18n';
import { SelectorMapa } from '@/componentes/SelectorMapa';
import {
  buscarLugares,
  CENTRO_POR_OMISION,
  Lugar,
  nombreDePunto,
} from '@/servicios/geocoding';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';

const MINIMO_BUSQUEDA = 3;

interface Props {
  etiqueta: string;
  lugar: Lugar | null;
  alElegir: (lugar: Lugar | null) => void;
  error?: string;
  refEntrada?: Ref<TextInputInstance>;
  /** Ofrece marcar el punto en el mapa interactivo, con pin fijo y dirección en vivo. */
  conMapa?: boolean;
  /** El lugar se elige solo en el mapa (que trae su buscador): un toque en vez de escribir y buscar. */
  soloMapa?: boolean;
}

/** Busca al pedirlo la persona (política de Nominatim) y solo vale un lugar elegido de la lista: trae sus coordenadas (RN-4). */
export function SelectorLugar({
  etiqueta,
  lugar,
  alElegir,
  error,
  refEntrada,
  conMapa = false,
  soloMapa = false,
}: Props) {
  const [enMapa, setEnMapa] = useState(false);
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Lugar[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string>();
  const [foco, setFoco] = useState(false);
  // Lo que ya se cambió de texto hace vieja la búsqueda en camino: su respuesta no se muestra.
  const edicion = useRef(0);

  const buscar = async () => {
    // El teclado también busca: repetir "buscar" no manda otra petición (política de Nominatim).
    if (buscando) return;
    const consulta = texto.trim();
    setResultados(null);
    if (consulta.length < MINIMO_BUSQUEDA)
      return setAviso(t('viajes.publicar.busqueda_corta'));
    setAviso(undefined);
    setBuscando(true);
    const inicio = edicion.current;
    try {
      const encontrados = await buscarLugares(consulta);
      if (inicio !== edicion.current) return;
      setResultados(encontrados);
      if (!encontrados.length)
        setAviso(t('viajes.publicar.busqueda_sin_resultados'));
    } catch {
      if (inicio === edicion.current)
        setAviso(t('viajes.publicar.busqueda_fallida'));
    } finally {
      setBuscando(false);
    }
  };

  const mapa = enMapa && (
    <SelectorMapa
      inicial={lugar ?? CENTRO_POR_OMISION}
      alCancelar={() => setEnMapa(false)}
      alElegir={({ lat, lng }) => {
        setEnMapa(false);
        const respaldo = t('viajes.buscar.punto_mapa');
        alElegir({ nombre: respaldo, detalle: respaldo, lat, lng });
        // El nombre llega después: si falla queda «Punto en el mapa» y el viaje sigue valiendo.
        void nombreDePunto(lat, lng).then((n) => {
          if (n) alElegir({ nombre: n, detalle: n, lat, lng });
        });
      }}
    />
  );

  // Con mapa, elegir el lugar es un solo toque: abre el mapa con su buscador, «Mi ubicación» y el pin fijo.
  if (soloMapa)
    return (
      <View style={estilos.raiz}>
        <Text style={estilos.etiquetaFila}>{etiqueta}</Text>
        <Toque
          accessibilityRole="button"
          accessibilityLabel={`${etiqueta}: ${lugar ? lugar.nombre : t('viajes.mapa.elegir_en_mapa')}`}
          onPress={() => setEnMapa(true)}
          escala={0.98}
          style={[estilos.campoLugar, error ? estilos.campoError : null]}
        >
          <View style={estilos.iconoLugar}>
            <Icono
              nombre={lugar ? 'location_on' : 'map'}
              color={colores.primario}
              tamano={20}
            />
          </View>
          <Text
            style={[estilos.valorLugar, !lugar && estilos.vacioLugar]}
            numberOfLines={2}
          >
            {lugar ? lugar.nombre : t('viajes.mapa.elegir_en_mapa')}
          </Text>
          {lugar ? (
            <Toque
              accessibilityRole="button"
              accessibilityLabel={t('comun.acciones.cerrar')}
              onPress={() => alElegir(null)}
              escala={0.85}
              hitSlop={8}
              style={estilos.limpiar}
            >
              <Icono
                nombre="close"
                color={colores.textoSecundario}
                tamano={20}
              />
            </Toque>
          ) : (
            <Icono nombre="chevron_right" color={colores.textoSecundario} />
          )}
        </Toque>
        {error && (
          <Text accessibilityRole="alert" style={estilos.errorLugar}>
            {error}
          </Text>
        )}
        {mapa}
      </View>
    );

  return (
    <View style={estilos.raiz}>
      <Campo
        refEntrada={refEntrada}
        etiqueta={etiqueta}
        ayuda={lugar ? undefined : t('viajes.publicar.busqueda_ayuda')}
        returnKeyType="search"
        // El intercambio de origen y destino llega por `lugar`: lo elegido manda sobre lo escrito.
        value={lugar ? lugar.nombre : texto}
        // Android deja el cursor al final y un nombre largo se vería sin su comienzo. Con foco, el cursor es de quien edita.
        selection={lugar && !foco ? { start: 0, end: 0 } : undefined}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
        onChangeText={(v) => {
          edicion.current += 1;
          setTexto(v);
          setResultados(null);
          setAviso(undefined);
          if (lugar) alElegir(null);
        }}
        onSubmitEditing={() => void buscar()}
        // Lo que respondió la última búsqueda dice más que el "elige una opción" de haber tocado Publicar;
        // con un lugar elegido, esa búsqueda ya no cuenta.
        error={lugar ? error : (aviso ?? error)}
      />
      {!lugar && (
        <View style={estilos.acciones}>
          <Boton
            variante="suave"
            icono="search"
            cargando={buscando}
            etiqueta={t(
              buscando
                ? 'viajes.publicar.buscando'
                : 'viajes.publicar.buscar_lugar',
            )}
            alPresionar={() => void buscar()}
          />
          {conMapa && (
            <Boton
              variante="suave"
              icono="map"
              etiqueta={t('viajes.buscar.elegir_mapa')}
              alPresionar={() => setEnMapa(true)}
            />
          )}
        </View>
      )}
      {mapa}
      {!lugar &&
        resultados?.map((r) => (
          <Pressable
            key={`${r.lat},${r.lng},${r.detalle}`}
            accessibilityRole="button"
            accessibilityLabel={r.detalle}
            onPress={() => {
              // Sin foco vuelve el cursor al inicio: el nombre elegido se lee desde su comienzo.
              Keyboard.dismiss();
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
  raiz: { gap: espacio(2), alignItems: 'stretch' },
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
  etiquetaFila: { ...tipografia.etiqueta, color: colores.texto },
  campoLugar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(3),
    paddingLeft: espacio(2),
    paddingRight: espacio(3),
    borderRadius: radio.m,
    backgroundColor: colores.fondoSutil,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  campoError: {
    borderColor: colores.peligro,
    backgroundColor: colores.peligroSuave,
  },
  iconoLugar: {
    width: 40,
    height: 40,
    borderRadius: radio.completo,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.primarioSuave,
  },
  valorLugar: { ...tipografia.cuerpoEnfasis, flex: 1, color: colores.texto },
  vacioLugar: { ...tipografia.cuerpo, color: colores.textoPlaceholder },
  limpiar: { padding: espacio(1) },
  errorLugar: { ...tipografia.secundario, color: colores.peligro },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio(2) },
  textos: { flex: 1, gap: 2 },
  nombre: { ...tipografia.cuerpoEnfasis, color: colores.texto },
  detalle: { ...tipografia.secundario, color: colores.textoSecundario },
});

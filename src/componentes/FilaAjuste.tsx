import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';
import { Toque } from './Animado';
import { Icono } from './Icono';

type NombreIcono = ComponentProps<typeof Icono>['nombre'];

/** Iniciales en círculo; el tamaño grande se usa sobre la banda de marca. */
export function Avatar({
  nombre,
  grande = false,
}: {
  nombre: string;
  grande?: boolean;
}) {
  const lado = grande ? 56 : 36;
  const partes = nombre.trim().split(/\s+/);
  const iniciales =
    (partes[0]?.[0] ?? '') +
    (partes.length > 1 ? partes[partes.length - 1][0] : '');
  return (
    <View
      style={[
        estilos.avatar,
        {
          width: lado,
          height: lado,
          borderRadius: lado / 2,
          backgroundColor: grande ? colores.marcaVelo : colores.primarioSuave,
        },
      ]}
    >
      <Text
        style={[
          grande ? tipografia.subtitulo : tipografia.cuerpoEnfasis,
          { color: grande ? colores.sobreMarca : colores.primarioTexto },
        ]}
      >
        {iniciales.toUpperCase()}
      </Text>
    </View>
  );
}

/** Fila de lista con ícono en baldosa, título, detalle opcional y flecha (patrón de Perfil y ajustes). */
export function FilaAjuste({
  icono,
  titulo,
  detalle,
  alPresionar,
  peligro = false,
}: {
  icono: NombreIcono;
  titulo: string;
  detalle?: string;
  alPresionar: () => void;
  peligro?: boolean;
}) {
  return (
    <Toque
      escala={0.98}
      accessibilityRole="button"
      accessibilityLabel={detalle ? `${titulo}. ${detalle}` : titulo}
      onPress={alPresionar}
      style={estilos.fila}
    >
      <View
        style={[
          estilos.baldosa,
          {
            backgroundColor: peligro
              ? colores.peligroSuave
              : colores.primarioSuave,
          },
        ]}
      >
        <Icono
          nombre={icono}
          color={peligro ? colores.peligro : colores.primario}
          tamano={20}
        />
      </View>
      <View style={estilos.textos}>
        <Text
          style={[estilos.titulo, peligro && { color: colores.peligroTexto }]}
        >
          {titulo}
        </Text>
        {detalle ? <Text style={estilos.detalle}>{detalle}</Text> : null}
      </View>
      {!peligro && (
        <Icono nombre="chevron_right" color={colores.textoPlaceholder} />
      )}
    </Toque>
  );
}

const estilos = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  fila: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(3),
    paddingHorizontal: espacio(4),
  },
  baldosa: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radio.m,
  },
  textos: { flex: 1, gap: 2 },
  titulo: { ...tipografia.cuerpoEnfasis, color: colores.texto },
  detalle: { ...tipografia.secundario, color: colores.textoSecundario },
});

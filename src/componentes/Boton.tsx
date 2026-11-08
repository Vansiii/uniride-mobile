import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colores, espacio, radio, tamano, tipografia } from '@/tema/tokens';
import { Icono } from './Icono';

type NombreIcono = ComponentProps<typeof Icono>['nombre'];

interface Props {
  /** Texto ya traducido con t(); en gerundio cuando `cargando` ("Entrando…"). */
  etiqueta: string;
  alPresionar: () => void;
  /** `suave`: píldora tonal para acciones rápidas junto a un formulario. */
  variante?: 'primario' | 'secundario' | 'texto' | 'suave';
  icono?: NombreIcono;
  /** Bloquea toques repetidos mientras se llama a la API. */
  cargando?: boolean;
  anchoCompleto?: boolean;
  /** Acción que todavía no se puede usar. */
  deshabilitado?: boolean;
}

const colorTexto = {
  primario: colores.sobrePrimario,
  secundario: colores.primario,
  texto: colores.primario,
  suave: colores.primarioTexto,
} as const;

export function Boton({
  etiqueta,
  alPresionar,
  variante = 'primario',
  icono,
  cargando = false,
  anchoCompleto = false,
  deshabilitado = false,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{
        busy: cargando,
        disabled: cargando || deshabilitado,
      }}
      disabled={cargando || deshabilitado}
      onPress={alPresionar}
      style={({ pressed }) => [
        estilos.base,
        estilos[variante],
        pressed && estilos[`${variante}Presionado`],
        anchoCompleto && estilos.completo,
        deshabilitado && estilos.deshabilitado,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={colorTexto[variante]} />
      ) : (
        icono && (
          <Icono nombre={icono} color={colorTexto[variante]} tamano={20} />
        )
      )}
      <Text
        style={[
          estilos.etiqueta,
          {
            color: deshabilitado
              ? colores.textoSecundario
              : colorTexto[variante],
          },
        ]}
      >
        {etiqueta}
      </Text>
    </Pressable>
  );
}

/** Acción con solo ícono (mostrar contraseña). Área táctil de 48 aunque el ícono mida 24 (12.2). */
export function BotonIcono({
  icono,
  etiqueta,
  alPresionar,
  color = colores.textoSecundario,
  deshabilitado = false,
}: {
  icono: NombreIcono;
  /** Nombre accesible obligatorio. */
  etiqueta: string;
  alPresionar: () => void;
  color?: string;
  deshabilitado?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado}
      onPress={alPresionar}
      style={({ pressed }) => [
        estilos.icono,
        deshabilitado && { opacity: 0.5 },
        pressed && { backgroundColor: colores.fondoSutil },
      ]}
    >
      <Icono nombre={icono} color={color} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: tamano.altoControl,
    paddingHorizontal: espacio(5),
    borderRadius: radio.m,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio(2),
  },
  completo: { alignSelf: 'stretch' },
  deshabilitado: { backgroundColor: colores.fondoSutil },
  primario: { backgroundColor: colores.primario },
  primarioPresionado: { backgroundColor: colores.primarioPresionado },
  secundario: {
    backgroundColor: colores.superficie,
    borderColor: colores.bordeCampo,
  },
  secundarioPresionado: {
    backgroundColor: colores.primarioSuave,
    borderColor: colores.primario,
  },
  suave: {
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: espacio(4),
    borderRadius: radio.completo,
    backgroundColor: colores.primarioSuave,
  },
  suavePresionado: { backgroundColor: colores.borde },
  texto: { paddingHorizontal: espacio(3) },
  textoPresionado: { backgroundColor: colores.primarioSuave },
  etiqueta: { ...tipografia.cuerpoEnfasis, textAlign: 'center' },
  icono: {
    width: tamano.tactilMinimo,
    height: tamano.tactilMinimo,
    borderRadius: radio.completo,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

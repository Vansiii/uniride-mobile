import type { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import {
  colores,
  degradadoBoton,
  espacio,
  radio,
  tamano,
  tipografia,
} from '@/tema/tokens';
import { Toque } from './Animado';
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
  secundario: colores.primarioTexto,
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
  const color = deshabilitado
    ? colores.textoDeshabilitado
    : colorTexto[variante];
  return (
    <Toque
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{
        busy: cargando,
        disabled: cargando || deshabilitado,
      }}
      disabled={cargando || deshabilitado}
      onPress={alPresionar}
      escala={variante === 'texto' ? 0.97 : 0.95}
      style={[
        estilos.base,
        estilos[variante],
        anchoCompleto && estilos.completo,
        deshabilitado && estilos.deshabilitado,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={color} />
      ) : (
        icono && <Icono nombre={icono} color={color} tamano={20} />
      )}
      <Text style={[estilos.etiqueta, { color }]}>{etiqueta}</Text>
    </Toque>
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
    <Toque
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado}
      onPress={alPresionar}
      escala={0.86}
      style={[estilos.icono, deshabilitado && { opacity: 0.5 }]}
    >
      <Icono nombre={icono} color={color} />
    </Toque>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: tamano.altoControl,
    paddingHorizontal: espacio(6),
    borderRadius: radio.l,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio(2),
  },
  completo: { alignSelf: 'stretch' },
  deshabilitado: {
    backgroundColor: colores.fondoDeshabilitado,
    experimental_backgroundImage: 'none',
    shadowOpacity: 0,
    elevation: 0,
  },
  primario: {
    backgroundColor: colores.primario,
    experimental_backgroundImage: degradadoBoton,
    shadowColor: '#2A39A6',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 7,
  },
  secundario: {
    backgroundColor: colores.superficie,
    borderWidth: 1.5,
    borderColor: colores.primario,
  },
  suave: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: espacio(4),
    borderRadius: radio.completo,
    backgroundColor: colores.primarioSuave,
  },
  texto: { paddingHorizontal: espacio(3) },
  etiqueta: { ...tipografia.cuerpoEnfasis, textAlign: 'center' },
  icono: {
    width: tamano.tactilMinimo,
    height: tamano.tactilMinimo,
    borderRadius: radio.completo,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

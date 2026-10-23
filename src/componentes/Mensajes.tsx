import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';
import { Icono } from './Icono';

type Tono = 'info' | 'exito' | 'aviso' | 'peligro';
type NombreIcono = ComponentProps<typeof Icono>['nombre'];

const tonos: Record<
  Tono,
  { fondo: string; texto: string; icono: string; simbolo: NombreIcono }
> = {
  info: {
    fondo: colores.primarioSuave,
    texto: colores.primarioTexto,
    icono: colores.primario,
    simbolo: 'info',
  },
  exito: {
    fondo: colores.exitoSuave,
    texto: colores.exitoTexto,
    icono: colores.exito,
    simbolo: 'check_circle',
  },
  aviso: {
    fondo: colores.avisoSuave,
    texto: colores.avisoTexto,
    icono: colores.aviso,
    simbolo: 'warning',
  },
  peligro: {
    fondo: colores.peligroSuave,
    texto: colores.peligroTexto,
    icono: colores.peligro,
    simbolo: 'error',
  },
};

/** Mensaje persistente en contexto (8.6). */
export function Aviso({
  tono,
  titulo,
  children,
}: {
  tono: Tono;
  titulo?: string;
  children: ReactNode;
}) {
  const c = tonos[tono];
  return (
    <View
      accessibilityRole={
        tono === 'peligro' || tono === 'aviso' ? 'alert' : undefined
      }
      style={[estilos.aviso, { backgroundColor: c.fondo }]}
    >
      <Icono nombre={c.simbolo} color={c.icono} tamano={20} />
      <View style={estilos.cuerpo}>
        {titulo && (
          <Text style={[estilos.titulo, { color: c.texto }]}>{titulo}</Text>
        )}
        <Text style={[estilos.texto, { color: c.texto }]}>{children}</Text>
      </View>
    </View>
  );
}

/** Estados con tono, ícono y texto (8.3, 4.1.2). Un estado nuevo se agrega solo aquí. */
const estados: Record<string, [Tono, NombreIcono]> = {
  'membresia.pendiente': ['aviso', 'hourglass_top'],
  'membresia.aprobada': ['exito', 'check_circle'],
  'membresia.rechazada': ['peligro', 'cancel'],
};

export function EtiquetaEstado({
  dominio,
  estado,
  texto,
}: {
  dominio: 'membresia';
  estado: string;
  /** Texto visible ya traducido. */
  texto: string;
}) {
  const [tono, simbolo] = estados[`${dominio}.${estado}`] ?? ['info', 'info'];
  const c = tonos[tono];
  return (
    <View style={[estilos.etiqueta, { backgroundColor: c.fondo }]}>
      <Icono nombre={simbolo} color={c.texto} tamano={16} />
      <Text style={[estilos.textoEtiqueta, { color: c.texto }]}>{texto}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  aviso: {
    flexDirection: 'row',
    gap: espacio(3),
    alignItems: 'flex-start',
    paddingVertical: espacio(3),
    paddingHorizontal: espacio(4),
    borderRadius: radio.m,
  },
  cuerpo: { flex: 1, gap: 2 },
  titulo: { ...tipografia.cuerpoEnfasis },
  texto: { ...tipografia.secundario },
  etiqueta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(1),
    minHeight: 24,
    paddingHorizontal: espacio(2),
    borderRadius: radio.completo,
  },
  textoEtiqueta: { ...tipografia.pequeno },
});

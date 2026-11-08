import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Movimiento, TipoMovimiento } from '@/api/cliente';
import { abrirHttps } from '@/enlaces';
import { formatearHoraLocal, formatearMonto } from '@/formato';
import { t } from '@/i18n';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';
import { Icono } from './Icono';
import { EtiquetaEstado } from './Mensajes';

/** Ícono por tipo (8.8). Solo el bloqueo en garantía resta: los demás entran a la billetera de quien los ve. */
const icono: Record<TipoMovimiento, ComponentProps<typeof Icono>['nombre']> = {
  recarga: 'add',
  bloqueo_reserva: 'lock',
  liberacion_viaje: 'south_west',
  reembolso_reserva: 'undo',
};

/**
 * Un movimiento del historial (8.8): tipo, hora, monto con signo y, si no está confirmado, su estado.
 * `primero` y `ultimo` redondean la tarjeta del día. El enlace al explorador solo existe si la API trae `exploradorUrl`.
 */
export function FilaMovimiento({
  movimiento: m,
  primero,
  ultimo,
}: {
  movimiento: Movimiento;
  primero: boolean;
  ultimo: boolean;
}) {
  const resta = m.tipo === 'bloqueo_reserva';
  const hora = formatearHoraLocal(m.creadoEn);
  return (
    <View
      style={[
        estilos.fila,
        primero && estilos.primero,
        ultimo && estilos.ultimo,
      ]}
    >
      <View style={[estilos.icono, !resta && estilos.iconoEntrada]}>
        <Icono
          nombre={icono[m.tipo]}
          color={resta ? colores.textoSecundario : colores.exito}
        />
      </View>
      <View style={estilos.textos}>
        <Text style={estilos.tipo}>
          {t(`billetera.historial.tipo.${m.tipo}`)}
        </Text>
        <Text style={estilos.secundario}>
          {m.estado === 'pendiente'
            ? `${hora} · ${t('billetera.historial.confirmandose')}`
            : hora}
        </Text>
        {m.exploradorUrl && (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('billetera.historial.explorador')}
            hitSlop={8}
            onPress={() => abrirHttps(m.exploradorUrl!)}
            style={estilos.enlace}
          >
            <Text style={estilos.textoEnlace}>
              {t('billetera.historial.explorador')}
            </Text>
            <Icono nombre="open_in_new" color={colores.primario} tamano={16} />
          </Pressable>
        )}
      </View>
      <View style={estilos.monto}>
        <Text style={estilos.cifra}>
          {resta ? '-' : '+'}
          {formatearMonto(m.monto)}
        </Text>
        {m.estado === 'confirmado' ? (
          <Text style={estilos.unidad}>{t('billetera.pantalla.unidad')}</Text>
        ) : (
          <EtiquetaEstado
            dominio="movimiento"
            estado={m.estado}
            texto={t(`billetera.historial.estado.${m.estado}`)}
          />
        )}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(3),
    paddingHorizontal: espacio(4),
    paddingVertical: espacio(2),
    borderColor: colores.borde,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    backgroundColor: colores.superficie,
  },
  primero: {
    borderTopWidth: 1,
    borderTopLeftRadius: radio.l,
    borderTopRightRadius: radio.l,
  },
  ultimo: {
    borderBottomLeftRadius: radio.l,
    borderBottomRightRadius: radio.l,
  },
  icono: {
    width: 40,
    height: 40,
    borderRadius: radio.completo,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.fondoSutil,
  },
  iconoEntrada: { backgroundColor: colores.exitoSuave },
  textos: { flex: 1, gap: 2 },
  tipo: { ...tipografia.cuerpoEnfasis, color: colores.texto },
  secundario: { ...tipografia.secundario, color: colores.textoSecundario },
  enlace: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  textoEnlace: { ...tipografia.etiqueta, color: colores.primario },
  monto: { alignItems: 'flex-end', gap: 2 },
  cifra: {
    ...tipografia.cuerpoEnfasis,
    color: colores.texto,
    fontVariant: ['tabular-nums'],
  },
  unidad: { ...tipografia.pequeno, color: colores.textoSecundario },
});

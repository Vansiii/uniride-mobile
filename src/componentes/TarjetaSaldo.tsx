import { StyleSheet, Text, View } from 'react-native';
import type { Saldo } from '@/api/cliente';
import { formatearMonto } from '@/formato';
import { t } from '@/i18n';
import { colores, espacio, tipografia } from '@/tema/tokens';
import { Icono } from './Icono';

/** Saldo de HU-14 dentro de la banda de marca (8.8): disponible, en garantía y total. Montos en es-BO sobre el texto de la API. */
export function TarjetaSaldo({ saldo }: { saldo: Saldo }) {
  const disponible = formatearMonto(saldo.saldoDisponible);
  const unidad = t('billetera.pantalla.unidad');
  return (
    <View style={estilos.saldo}>
      <Text style={estilos.etiqueta}>{t('billetera.pantalla.saldo')}</Text>
      <Text
        style={estilos.cifra}
        accessibilityLabel={`${disponible} ${unidad}`}
      >
        {disponible}
        <Text style={estilos.unidad}> {unidad}</Text>
      </Text>
      <View style={estilos.fila}>
        <Icono nombre="lock" color={colores.sobreMarcaSecundario} tamano={16} />
        <Text style={estilos.secundario}>
          {t('billetera.saldo.en_garantia').replace(
            '{monto}',
            formatearMonto(saldo.saldoBloqueadoEscrow),
          )}
        </Text>
      </View>
      <Text style={estilos.secundario}>
        {t('billetera.saldo.total').replace(
          '{monto}',
          formatearMonto(saldo.saldoTotal),
        )}
      </Text>
      <Text style={estilos.nota}>{t('billetera.pantalla.prueba')}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  saldo: { gap: espacio(1) },
  etiqueta: { ...tipografia.secundario, color: colores.sobreMarcaSecundario },
  // Cifra del saldo (DESIGN_SYSTEM §4.2): 34/40, 700.
  cifra: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    color: colores.sobreMarca,
  },
  unidad: { ...tipografia.subtitulo, color: colores.sobreMarcaSecundario },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio(1) },
  secundario: { ...tipografia.secundario, color: colores.sobreMarcaSecundario },
  nota: { ...tipografia.pequeno, color: colores.sobreMarcaSecundario },
});

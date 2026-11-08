import { StyleSheet, Text, View } from 'react-native';
import type { Saldo } from '@/api/cliente';
import { formatearMonto } from '@/formato';
import { t } from '@/i18n';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';
import { useConteo } from './Animado';
import { Icono } from './Icono';

/** Saldo de HU-14 dentro de la banda de marca (8.8): disponible, en garantía y total. Montos en es-BO sobre el texto de la API. */
export function TarjetaSaldo({ saldo }: { saldo: Saldo }) {
  const disponible = formatearMonto(saldo.saldoDisponible);
  const animado = formatearMonto(
    useConteo(Number(saldo.saldoDisponible)).toFixed(2),
  );
  const unidad = t('billetera.pantalla.unidad');
  return (
    <View style={estilos.saldo}>
      <Text style={estilos.etiqueta}>{t('billetera.pantalla.saldo')}</Text>
      <Text
        style={estilos.cifra}
        accessibilityLabel={`${disponible} ${unidad}`}
      >
        {animado}
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
  // Tarjeta de vidrio sobre la banda: la cifra es lo primero que se ve.
  saldo: {
    gap: espacio(1),
    padding: espacio(4),
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.vidrioBorde,
    backgroundColor: colores.vidrio,
  },
  etiqueta: { ...tipografia.secundario, color: colores.sobreMarcaSecundario },
  // Cifra del saldo (DESIGN_SYSTEM §4.2): 34/40, 700.
  cifra: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '800',
    letterSpacing: -1,
    color: colores.sobreMarca,
  },
  unidad: { ...tipografia.subtitulo, color: colores.sobreMarcaSecundario },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio(1) },
  secundario: { ...tipografia.secundario, color: colores.sobreMarcaSecundario },
  nota: { ...tipografia.pequeno, color: colores.sobreMarcaSecundario },
});

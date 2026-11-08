import { StyleSheet, View } from 'react-native';
import { t } from '@/i18n';
import { espacio } from '@/tema/tokens';
import { formatearHoraLocal } from '@/formato';
import { leerSalida } from '@/viajes/salida';
import { Boton } from './Boton';

const PASO_MS = 15 * 60_000;

/**
 * Ajuste rápido de la hora sin teclado: ±15 min a partir de lo escrito (o de ahora si está vacío).
 * Escribir sigue valiendo; esto evita abrir el teclado numérico para corregir unos minutos.
 */
export function AjusteHora({
  fecha,
  hora,
  alCambiar,
}: {
  fecha: Date;
  hora: string;
  alCambiar: (hora: string) => void;
}) {
  const mover = (delta: number) => {
    const base = leerSalida(fecha, hora)?.getTime() ?? Date.now();
    alCambiar(formatearHoraLocal(new Date(base + delta).toISOString()));
  };
  return (
    <View style={estilos.fila}>
      <Boton
        variante="suave"
        icono="remove"
        etiqueta={t('viajes.publicar.hora_menos')}
        alPresionar={() => mover(-PASO_MS)}
      />
      <Boton
        variante="suave"
        icono="add"
        etiqueta={t('viajes.publicar.hora_mas')}
        alPresionar={() => mover(PASO_MS)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', gap: espacio(2) },
});

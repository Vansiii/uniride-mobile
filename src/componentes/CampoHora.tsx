import { Host, TimePickerDialog } from '@expo/ui/jetpack-compose';
import { useState, type Ref } from 'react';
import { Platform, View, type TextInputInstance } from 'react-native';
import { t } from '@/i18n';
import { espacio } from '@/tema/tokens';
import { formatearHoraLocal } from '@/formato';
import { escribirHora, leerSalida } from '@/viajes/salida';
import { Boton } from './Boton';
import { Campo } from './Campo';
import { crearEstilos, useColores } from '@/tema/useEstilos';

const PASO_MS = 15 * 60_000;
const ANDROID = Platform.OS === 'android';

/**
 * Hora de salida sin teclado: en Android tocar el campo abre el reloj nativo de Material 3 y ±15 min corrige
 * sin abrir nada. En web (y en Jest) el campo se sigue pudiendo escribir.
 */
export function CampoHora({
  fecha,
  hora,
  alCambiar,
  ayuda,
  error,
  refEntrada,
}: {
  fecha: Date;
  hora: string;
  alCambiar: (hora: string) => void;
  ayuda?: string;
  error?: string;
  refEntrada?: Ref<TextInputInstance>;
}) {
  const colores = useColores();
  const estilos = useEstilos();
  const [reloj, setReloj] = useState(false);
  const base = () => leerSalida(fecha, hora) ?? new Date();
  const mover = (delta: number) =>
    alCambiar(
      formatearHoraLocal(new Date(base().getTime() + delta).toISOString()),
    );
  return (
    <View style={estilos.grupo}>
      <Campo
        refEntrada={refEntrada}
        etiqueta={t('viajes.publicar.hora')}
        ayuda={
          ayuda ??
          t(
            ANDROID
              ? 'viajes.publicar.hora_tocar'
              : 'viajes.publicar.hora_ayuda',
          )
        }
        keyboardType="number-pad"
        maxLength={5}
        value={hora}
        showSoftInputOnFocus={!ANDROID}
        caretHidden={ANDROID}
        onPressIn={ANDROID ? () => setReloj(true) : undefined}
        onChangeText={(v) => alCambiar(escribirHora(v))}
        error={error}
      />
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
      {ANDROID && reloj && (
        <Host matchContents>
          <TimePickerDialog
            initialDate={base().toISOString()}
            is24Hour
            color={colores.primario}
            confirmButtonLabel={t('comun.acciones.aceptar')}
            dismissButtonLabel={t('comun.acciones.cancelar')}
            onDateSelected={(d) => {
              setReloj(false);
              alCambiar(formatearHoraLocal(d.toISOString()));
            }}
            onDismissRequest={() => setReloj(false)}
          />
        </Host>
      )}
    </View>
  );
}

const useEstilos = crearEstilos(() => ({
  grupo: { gap: espacio(2) },
  fila: { flexDirection: 'row', gap: espacio(2) },
}));

import { colores } from '@/tema/tokens';
import { t } from '@/i18n';
import { BotonIcono } from './Boton';

interface Props {
  alPresionar: () => void;
  color?: string;
  deshabilitado?: boolean;
}

/**
 * BotonVoz (DESIGN_SYSTEM §8.10): BotonIcono de 48x48 con ícono "mic" en el encabezado
 * de las pantallas raíz y de detalle de viaje y reserva.
 */
export function BotonVoz({
  alPresionar,
  color = colores.primario,
  deshabilitado = false,
}: Props) {
  return (
    <BotonIcono
      icono="mic"
      etiqueta={t('voz.boton.etiqueta')}
      color={color}
      alPresionar={alPresionar}
      deshabilitado={deshabilitado}
    />
  );
}

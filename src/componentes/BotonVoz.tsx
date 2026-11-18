import { useColores } from '@/tema/useEstilos';
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
export function BotonVoz({ alPresionar, color, deshabilitado = false }: Props) {
  const colores = useColores();
  return (
    <BotonIcono
      icono="mic"
      etiqueta={t('voz.boton.etiqueta')}
      color={color ?? colores.primario}
      alPresionar={alPresionar}
      deshabilitado={deshabilitado}
    />
  );
}

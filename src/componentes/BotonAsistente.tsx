import { useColores } from '@/tema/useEstilos';
import { t } from '@/i18n';
import { BotonIcono } from './Boton';

interface Props {
  alPresionar: () => void;
  color?: string;
  deshabilitado?: boolean;
}

/**
 * BotonAsistente (DESIGN_SYSTEM P10): BotonIcono discreto con ícono "info".
 * Apenas resalta en el encabezado de las pantallas para no competir con la acción primaria.
 */
export function BotonAsistente({
  alPresionar,
  color,
  deshabilitado = false,
}: Props) {
  const colores = useColores();
  return (
    <BotonIcono
      icono="info"
      etiqueta={t('asistente.boton_etiqueta')}
      color={color ?? colores.textoSecundario}
      alPresionar={alPresionar}
      deshabilitado={deshabilitado}
    />
  );
}

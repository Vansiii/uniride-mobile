import { router } from 'expo-router';
import { Boton } from '@/componentes/Boton';
import { t } from '@/i18n';

/** Salida de una firma que falló por la llave (HU-10 CA-1): lleva a «Mi teléfono» a volver a vincularlo. */
export function BotonRevincular({
  motivo,
}: {
  motivo: 'llave_anulada' | 'sin_llave';
}) {
  return (
    <Boton
      icono="verified_user"
      anchoCompleto
      etiqueta={t(
        motivo === 'llave_anulada'
          ? 'dispositivo.llave_anulada.confirmar'
          : 'dispositivo.revincular.boton',
      )}
      alPresionar={() => router.push(`/dispositivo?motivo=${motivo}`)}
    />
  );
}

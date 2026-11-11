import { Boton } from '@/componentes/Boton';
import type { EstadoAccion } from '@/hooks/useAccionSensible';
import { t } from '@/i18n';

/**
 * Botón de una acción sensible (DESIGN_SYSTEM 9.6): dice la acción y el monto, con `fingerprint`, y abre el diálogo
 * biométrico del sistema. Mientras espera la huella o al servidor queda ocupado; nunca dice «Confirmado» (CA-9).
 * El resumen lo muestra cada pantalla arriba; la falla, `fallaDeFirma` de `useAccionSensible`.
 */
export function ConfirmacionBiometrica({
  etiqueta,
  estado,
  alConfirmar,
  enviando,
}: {
  /** Ya traducida: «Simular pago de 50,00 Bs». */
  etiqueta: string;
  estado: EstadoAccion;
  alConfirmar: () => void;
  /** Lo que dice mientras espera al servidor; por defecto «Confirmando…». */
  enviando?: string;
}) {
  return (
    <Boton
      anchoCompleto
      icono="fingerprint"
      cargando={estado !== 'reposo'}
      etiqueta={
        estado === 'enviando'
          ? (enviando ?? t('comun.biometria.confirmando'))
          : etiqueta
      }
      alPresionar={alConfirmar}
    />
  );
}

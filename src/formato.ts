import { t } from '@/i18n';

/**
 * Monto de la API ("1234.50") a es-BO ("1.234,50"), DESIGN_SYSTEM §13.
 * Trabaja sobre el texto, sin pasar por `Number`: un saldo grande perdería precisión y "5.50" no puede volverse "5.5".
 * Si el texto no es un decimal simple lo devuelve igual: nunca se inventa una cifra.
 */
export function formatearMonto(texto: string): string {
  const partes = /^(-?)(\d+)(?:\.(\d*))?$/.exec(texto);
  if (!partes) return texto;
  const [, signo, entera, fraccion = ''] = partes;
  const miles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${signo}${miles},${fraccion.padEnd(2, '0').slice(0, 2)}`;
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];
const dos = (n: number) => String(n).padStart(2, '0');

/** Día local de una fecha ISO ("2026-11-06"): sirve para agrupar movimientos por día. */
export const claveDia = (iso: string) => {
  const f = new Date(iso);
  return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}`;
};

/** "Hoy" o "mié 21 oct" (DESIGN_SYSTEM §13), en la hora local. Sin `Intl`: Hermes no lo trae completo. */
export function formatearDia(iso: string, ahora = new Date()): string {
  if (claveDia(iso) === claveDia(ahora.toISOString()))
    return t('billetera.historial.hoy');
  const f = new Date(iso);
  return `${DIAS[f.getDay()]} ${f.getDate()} ${MESES[f.getMonth()]}`;
}

/** "350 m" hasta el kilómetro; "1 km" justo en el radio de búsqueda. */
export function formatearDistancia(km: number) {
  const metros = Math.round(km * 1000);
  return metros >= 1000
    ? `${String(Math.round(km * 10) / 10).replace('.', ',')} km`
    : `${metros} m`;
}

/** Hora local en 24 h ("07:05"). */
export const formatearHoraLocal = (iso: string) => {
  const f = new Date(iso);
  return `${dos(f.getHours())}:${dos(f.getMinutes())}`;
};

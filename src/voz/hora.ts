export type Franja = 'manana' | 'tarde' | 'noche';
export type Dia = 'hoy' | 'manana';

const MINUTO_MS = 60_000;
const MARGEN_BUSQUEDA_MS = 30 * MINUTO_MS;

/**
 * RN-4: Resuelve una hora dicha por voz a una fecha/hora concreta.
 * Si es de 1 a 12 sin franja, toma la primera de h o h+12 que sea >= ahora - 30 min (hoy),
 * o si ninguna cumple, mañana a las h.
 */
export function resolverHora(
  hora: number,
  minutos: number = 0,
  franja?: Franja,
  dia?: Dia,
  ahora: Date = new Date(),
): Date {
  const anio = ahora.getFullYear();
  const mes = ahora.getMonth();
  const fecha = ahora.getDate();
  const umbralMs = ahora.getTime() - MARGEN_BUSQUEDA_MS;

  let h = hora;
  const m = minutos;

  if (franja) {
    if (franja === 'manana') {
      if (h === 12) h = 0;
    } else if (franja === 'tarde') {
      if (h < 12) h += 12;
    } else if (franja === 'noche') {
      if (h === 12) {
        h = 0;
      } else if (h < 12) {
        h += 12;
      }
    }

    if (dia === 'manana') {
      return new Date(anio, mes, fecha + 1, h, m, 0, 0);
    }
    if (dia === 'hoy') {
      return new Date(anio, mes, fecha, h, m, 0, 0);
    }

    const hoy = new Date(anio, mes, fecha, h, m, 0, 0);
    if (hoy.getTime() >= umbralMs) {
      return hoy;
    }
    return new Date(anio, mes, fecha + 1, h, m, 0, 0);
  }

  // Sin franja explícita:
  if (h === 0 || h >= 13) {
    if (dia === 'manana') {
      return new Date(anio, mes, fecha + 1, h, m, 0, 0);
    }
    if (dia === 'hoy') {
      return new Date(anio, mes, fecha, h, m, 0, 0);
    }
    const hoy = new Date(anio, mes, fecha, h, m, 0, 0);
    if (hoy.getTime() >= umbralMs) {
      return hoy;
    }
    return new Date(anio, mes, fecha + 1, h, m, 0, 0);
  }

  // De 1 a 12 sin franja:
  if (dia === 'manana') {
    return new Date(anio, mes, fecha + 1, h, m, 0, 0);
  }

  if (dia === 'hoy') {
    const opcion1 = new Date(anio, mes, fecha, h, m, 0, 0);
    if (opcion1.getTime() >= umbralMs) return opcion1;
    const opcion2 = new Date(anio, mes, fecha, h === 12 ? 12 : h + 12, m, 0, 0);
    return opcion2;
  }

  const opcion1 = new Date(anio, mes, fecha, h, m, 0, 0);
  if (opcion1.getTime() >= umbralMs) {
    return opcion1;
  }
  const hTarde = h === 12 ? 12 : h + 12;
  const opcion2 = new Date(anio, mes, fecha, hTarde, m, 0, 0);
  if (opcion2.getTime() >= umbralMs) {
    return opcion2;
  }
  return new Date(anio, mes, fecha + 1, h, m, 0, 0);
}

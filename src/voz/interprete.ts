import { type Dia, type Franja, resolverHora } from './hora';

export type Intencion =
  | {
      tipo: 'buscar';
      destino: string;
      hora: Date;
      textoInterpretado: string;
    }
  | {
      tipo: 'reservar';
      n: number;
    }
  | {
      tipo: 'saldo';
    }
  | {
      tipo: 'conductor';
    }
  | {
      tipo: 'estado_viaje';
    }
  | {
      tipo: 'cancelar';
      n?: number;
    }
  | {
      tipo: 'ayuda';
    }
  | {
      tipo: 'elegir';
      n: number;
    }
  | {
      tipo: 'falta';
      dato: 'hora' | 'destino';
      destino?: string;
      hora?: Date;
    }
  | {
      tipo: 'desconocido';
    };

const ORDINALES: Record<string, number> = {
  primero: 1,
  primer: 1,
  segundo: 2,
  tercero: 3,
  tercer: 3,
  cuarto: 4,
  quinto: 5,
  sexto: 6,
  septimo: 7,
  octavo: 8,
  noveno: 9,
  decimo: 10,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
};

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/[áä]/g, 'a')
    .replace(/[éë]/g, 'e')
    .replace(/[íï]/g, 'i')
    .replace(/[óö]/g, 'o')
    .replace(/[úü]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9: ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * RN-1, RN-2 (HU-27 y HU-28): Interpreta un comando de voz en español para UniRide.
 * Prioridad fija: cancelar > conductor > estado_viaje > saldo > ayuda > elegir > reservar > buscar.
 */
export function interpretar(
  texto: string,
  ahora: Date = new Date(),
): Intencion {
  if (!texto || !texto.trim()) {
    return { tipo: 'desconocido' };
  }

  const normal = normalizarTexto(texto);

  // RN-6: palabras solas de confirmación no tienen efecto y se tratan como desconocido (A-11)
  const comandosProhibidos = new Set([
    'si',
    'confirma',
    'confirmar',
    'reserva',
    'reservar',
  ]);
  if (comandosProhibidos.has(normal)) {
    return { tipo: 'desconocido' };
  }

  // 1. Intención: Cancelar (HU-28 RN-1, CA-8, CA-9) - Prioridad 1
  if (/\b(?:cancela|cancelar|cancelame)\b/.test(normal)) {
    const matchN = normal.match(
      /\b(?:cancela|cancelar|cancelame)\s+(?:el\s+)?([a-z0-9]+)\b/,
    );
    if (matchN) {
      const token = matchN[1];
      const n =
        ORDINALES[token] ??
        (/^\d+$/.test(token) ? parseInt(token, 10) : undefined);
      if (n !== undefined && n >= 1) {
        return { tipo: 'cancelar', n };
      }
    }
    return { tipo: 'cancelar' };
  }

  // 2. Intención: Conductor (HU-28 RN-1, CA-3, CA-4) - Prioridad 2
  if (
    /\bdonde\s+(?:esta|viene)\s+(?:mi\s+|el\s+)?conductor\b/.test(normal) ||
    (/\bdonde\b/.test(normal) && /\bconductor\b/.test(normal))
  ) {
    return { tipo: 'conductor' };
  }

  // 3. Intención: Estado del viaje (HU-28 RN-1, CA-5, CA-6) - Prioridad 3
  if (
    /\bcomo\s+va\s+(?:mi\s+|el\s+)?viaje\b/.test(normal) ||
    /\bestado\s+(?:de\s+|del\s+)(?:mi\s+)?viaje\b/.test(normal)
  ) {
    return { tipo: 'estado_viaje' };
  }

  // 4. Intención: Saldo (HU-28 RN-1, CA-1, CA-2)
  if (
    /\b(?:cual\s+es\s+mi\s+saldo|cuanto\s+saldo\s+tengo|mi\s+saldo)\b/.test(
      normal,
    ) ||
    normal === 'saldo' ||
    normal === 'cual es el saldo' ||
    normal === 'cuanto saldo'
  ) {
    return { tipo: 'saldo' };
  }

  // 5. Intención: Ayuda (HU-28 RN-1, CA-12)
  if (
    /\b(?:ayudame|ayuda)\b/.test(normal) ||
    /\bque\s+puedo\s+decir\b/.test(normal)
  ) {
    return { tipo: 'ayuda' };
  }

  // 6. Intención: Reservar explícito (HU-27): «reserva/reservar/quiero el {n}»
  const matchReserva = normal.match(
    /\b(?:reserva|reservar|quiero)\s+(?:el\s+)?([a-z0-9]+)\b/,
  );
  if (matchReserva) {
    const token = matchReserva[1];
    let n: number | undefined;
    if (ORDINALES[token]) {
      n = ORDINALES[token];
    } else if (/^\d+$/.test(token)) {
      n = parseInt(token, 10);
    }
    if (n !== undefined && n >= 1) {
      return { tipo: 'reservar', n };
    }
  }

  // 7. Intención: Elección simple en listas de resultados o cancelables (HU-28 CA-9)
  // «el primero», «el 2», «segundo», etc.
  const matchElegir = normal.match(/^(?:el\s+)?([a-z0-9]+)$/);
  if (matchElegir) {
    const token = matchElegir[1];
    const n =
      ORDINALES[token] ??
      (/^\d+$/.test(token) ? parseInt(token, 10) : undefined);
    if (n !== undefined && n >= 1) {
      return { tipo: 'elegir', n };
    }
  }

  // 8. Intención: Buscar (HU-27)
  const esBusqueda =
    /\b(?:busca|buscar|buscame|quiero|llevame|viaje|viajar|ir)\b/.test(normal);

  if (!esBusqueda) {
    return { tipo: 'desconocido' };
  }

  // Extraer día: "hoy" o "mañana"
  let dia: Dia | undefined;
  let textoSinDia = normal;
  if (/\bhoy\b/.test(normal)) {
    dia = 'hoy';
    textoSinDia = textoSinDia.replace(/\bhoy\b/g, ' ');
  } else if (
    /\bmanana\b/.test(normal) &&
    !/(?:de|por)\s+la\s+manana/.test(normal)
  ) {
    dia = 'manana';
    textoSinDia = textoSinDia.replace(/\bmanana\b/g, ' ');
  }

  // Extraer franja: mañana, tarde, noche
  let franja: Franja | undefined;
  let textoSinFranja = textoSinDia;
  if (/(?:de|por)\s+la\s+manana/.test(textoSinFranja)) {
    franja = 'manana';
    textoSinFranja = textoSinFranja.replace(/(?:de|por)\s+la\s+manana/g, ' ');
  } else if (/(?:de|por)\s+la\s+tarde/.test(textoSinFranja)) {
    franja = 'tarde';
    textoSinFranja = textoSinFranja.replace(/(?:de|por)\s+la\s+tarde/g, ' ');
  } else if (/(?:de|por)\s+la\s+noche/.test(textoSinFranja)) {
    franja = 'noche';
    textoSinFranja = textoSinFranja.replace(/(?:de|por)\s+la\s+noche/g, ' ');
  }

  // Extraer hora y minutos
  let horaNum: number | undefined;
  let minutosNum: number = 0;
  let textoSinHora = textoSinFranja;

  const matchMediaCuarto = textoSinHora.match(
    /\ba\s+las?\s+(\d{1,2})\s+y\s+(media|cuarto)\b/,
  );
  if (matchMediaCuarto) {
    horaNum = parseInt(matchMediaCuarto[1], 10);
    minutosNum = matchMediaCuarto[2] === 'media' ? 30 : 15;
    textoSinHora = textoSinHora.replace(matchMediaCuarto[0], ' ');
  } else {
    const matchHColonM = textoSinHora.match(
      /(?:\ba\s+las?\s+)?(\d{1,2}):(\d{2})\b/,
    );
    if (matchHColonM) {
      horaNum = parseInt(matchHColonM[1], 10);
      minutosNum = parseInt(matchHColonM[2], 10);
      textoSinHora = textoSinHora.replace(matchHColonM[0], ' ');
    } else {
      const matchHyM = textoSinHora.match(
        /\ba\s+las?\s+(\d{1,2})\s+y\s+(\d{1,2})\b/,
      );
      if (matchHyM) {
        horaNum = parseInt(matchHyM[1], 10);
        minutosNum = parseInt(matchHyM[2], 10);
        textoSinHora = textoSinHora.replace(matchHyM[0], ' ');
      } else {
        const matchHoras = textoSinHora.match(
          /(?:\ba\s+las?\s+)?(\d{1,2})\s+horas\b/,
        );
        if (matchHoras) {
          horaNum = parseInt(matchHoras[1], 10);
          minutosNum = 0;
          textoSinHora = textoSinHora.replace(matchHoras[0], ' ');
        } else {
          const matchSimple = textoSinHora.match(/\ba\s+las?\s+(\d{1,2})\b/);
          if (matchSimple) {
            horaNum = parseInt(matchSimple[1], 10);
            minutosNum = 0;
            textoSinHora = textoSinHora.replace(matchSimple[0], ' ');
          }
        }
      }
    }
  }

  // Extraer destino
  const textoDestino = textoSinHora
    .replace(/\b(?:busca|buscar|buscame|quiero|llevame|por favor)\b/g, ' ')
    .replace(/\b(?:un|el|los|las)\s+viaje\b/g, ' ')
    .replace(/\bviaje\b/g, ' ')
    .replace(/\ba\s+ir\b/g, ' ')
    .replace(/^\s*a\s+/g, ' ')
    .replace(/\s+a\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tieneDestino = textoDestino.length > 0;

  if (tieneDestino && horaNum !== undefined) {
    const fechaResuelta = resolverHora(horaNum, minutosNum, franja, dia, ahora);
    const esHoy = fechaResuelta.getDate() === ahora.getDate();
    const diaTexto = esHoy ? 'hoy' : 'mañana';
    const hh = String(fechaResuelta.getHours()).padStart(2, '0');
    const mm = String(fechaResuelta.getMinutes()).padStart(2, '0');

    const destinoOriginal = recuperarDestinoOriginal(texto, textoDestino);
    const textoInterpretado = `Entendí: viaje a ${destinoOriginal}, ${diaTexto} a las ${hh}:${mm}`;

    return {
      tipo: 'buscar',
      destino: destinoOriginal,
      hora: fechaResuelta,
      textoInterpretado,
    };
  }

  if (tieneDestino && horaNum === undefined) {
    const destinoOriginal = recuperarDestinoOriginal(texto, textoDestino);
    return {
      tipo: 'falta',
      dato: 'hora',
      destino: destinoOriginal,
    };
  }

  if (!tieneDestino && horaNum !== undefined) {
    const fechaResuelta = resolverHora(horaNum, minutosNum, franja, dia, ahora);
    return {
      tipo: 'falta',
      dato: 'destino',
      hora: fechaResuelta,
    };
  }

  return { tipo: 'desconocido' };
}

function recuperarDestinoOriginal(
  textoOriginal: string,
  destinoNormal: string,
): string {
  const palabras = destinoNormal.split(/\s+/).filter(Boolean);
  if (!palabras.length) return destinoNormal;
  const regex = new RegExp(`\\b${palabras.join('\\s+')}\\b`, 'i');
  const match = textoOriginal.match(regex);
  if (match) return match[0].trim();
  return palabras
    .map((p) =>
      p.toUpperCase() === 'UAGRM'
        ? 'UAGRM'
        : p.charAt(0).toUpperCase() + p.slice(1),
    )
    .join(' ');
}

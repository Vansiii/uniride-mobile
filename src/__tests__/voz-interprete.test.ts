import { interpretar } from '../voz/interprete';

describe('HU-27 RN-2, CA-8, CA-9 · interprete de voz (pure function)', () => {
  const ahora = new Date('2026-11-16T06:00:00');

  describe('Intención: Buscar', () => {
    it.each([
      ['busca un viaje a la UAGRM a las 7'],
      ['buscar un viaje a la UAGRM a las 7'],
      ['quiero un viaje a la UAGRM a las 7'],
      ['llévame a la UAGRM a las 7'],
      ['viaje a la UAGRM a las 7'],
    ])('reconoce comando de búsqueda: "%s"', (texto) => {
      const res = interpretar(texto, ahora);
      expect(res.tipo).toBe('buscar');
      if (res.tipo === 'buscar') {
        expect(res.destino.toLowerCase()).toContain('uagrm');
        expect(res.hora.getHours()).toBe(7);
        expect(res.hora.getMinutes()).toBe(0);
        expect(res.textoInterpretado).toContain('Entendí: viaje a');
        expect(res.textoInterpretado).toContain('07:00');
      }
    });

    it('acepta destino y hora en orden inverso: "busca un viaje a las 7 a la UAGRM"', () => {
      const res = interpretar('busca un viaje a las 7 a la UAGRM', ahora);
      expect(res.tipo).toBe('buscar');
      if (res.tipo === 'buscar') {
        expect(res.destino.toLowerCase()).toContain('uagrm');
        expect(res.hora.getHours()).toBe(7);
      }
    });

    it('acepta "mañana a las 7"', () => {
      const res = interpretar(
        'quiero un viaje a la UAGRM mañana a las 7',
        ahora,
      );
      expect(res.tipo).toBe('buscar');
      if (res.tipo === 'buscar') {
        expect(res.hora.getDate()).toBe(17);
        expect(res.textoInterpretado).toContain('mañana a las 07:00');
      }
    });

    it('acepta horas compuestas: "7 y media" (7:30)', () => {
      const res = interpretar(
        'busca un viaje a la UAGRM a las 7 y media',
        ahora,
      );
      expect(res.tipo).toBe('buscar');
      if (res.tipo === 'buscar') {
        expect(res.hora.getHours()).toBe(7);
        expect(res.hora.getMinutes()).toBe(30);
      }
    });

    it('acepta formato hh:mm: "7:30"', () => {
      const res = interpretar('busca un viaje a la UAGRM a las 7:30', ahora);
      expect(res.tipo).toBe('buscar');
      if (res.tipo === 'buscar') {
        expect(res.hora.getHours()).toBe(7);
        expect(res.hora.getMinutes()).toBe(30);
      }
    });

    it('acepta formato 24h: "19 horas"', () => {
      const res = interpretar('busca un viaje al Campus a las 19 horas', ahora);
      expect(res.tipo).toBe('buscar');
      if (res.tipo === 'buscar') {
        expect(res.hora.getHours()).toBe(19);
      }
    });

    it('acepta franjas: "7 de la tarde" (19:00)', () => {
      const res = interpretar('viaje a la UAGRM a las 7 de la tarde', ahora);
      expect(res.tipo).toBe('buscar');
      if (res.tipo === 'buscar') {
        expect(res.hora.getHours()).toBe(19);
      }
    });
  });

  describe('Intención: Reservar', () => {
    it.each([
      ['reserva el primero', 1],
      ['reserva el segundo', 2],
      ['reserva el 2', 2],
      ['reservar el tercero', 3],
      ['quiero el cuarto', 4],
      ['reserva el décimo', 10],
      ['reserva el 5', 5],
    ])('reconoce comando de reserva: "%s" → n=%d', (texto, esperado) => {
      const res = interpretar(texto, ahora);
      expect(res).toEqual({ tipo: 'reservar', n: esperado });
    });
  });

  describe('CA-8 · Datos faltantes', () => {
    it('falta hora: "busca un viaje a la UAGRM" repregunta hora', () => {
      const res = interpretar('busca un viaje a la UAGRM', ahora);
      expect(res.tipo).toBe('falta');
      if (res.tipo === 'falta') {
        expect(res.dato).toBe('hora');
        expect(res.destino?.toLowerCase()).toContain('uagrm');
      }
    });

    it('falta destino: "busca un viaje a las 7" repregunta destino', () => {
      const res = interpretar('busca un viaje a las 7', ahora);
      expect(res.tipo).toBe('falta');
      if (res.tipo === 'falta') {
        expect(res.dato).toBe('destino');
        expect(res.hora).toBeDefined();
      }
    });
  });

  describe('RN-6, CA-6, CA-9 · Comandos no reconocidos o prohibidos', () => {
    it.each([
      ['si'],
      ['sí'],
      ['confirma'],
      ['confirmar'],
      ['reserva'],
      ['reservar'],
      ['hola UniRide'],
      [''],
      ['   '],
    ])('comando "%s" devuelve desconocido (la voz nunca confirma)', (texto) => {
      const res = interpretar(texto, ahora);
      expect(res.tipo).toBe('desconocido');
    });
  });

  describe('HU-28 RN-1 · Intenciones de consulta, cancelación y ayuda', () => {
    it.each([
      ['¿cuál es mi saldo?'],
      ['cual es mi saldo'],
      ['¿cuánto saldo tengo?'],
      ['cuanto saldo tengo'],
      ['mi saldo'],
      ['saldo'],
    ])('reconoce saldo: "%s"', (texto) => {
      expect(interpretar(texto, ahora)).toEqual({ tipo: 'saldo' });
    });

    it.each([
      ['¿dónde está mi conductor?'],
      ['donde esta mi conductor'],
      ['¿dónde viene mi conductor?'],
      ['donde viene mi conductor'],
      ['donde esta el conductor'],
      ['donde viene el conductor'],
    ])('reconoce conductor: "%s"', (texto) => {
      expect(interpretar(texto, ahora)).toEqual({ tipo: 'conductor' });
    });

    it.each([
      ['¿cómo va mi viaje?'],
      ['como va mi viaje'],
      ['estado de mi viaje'],
      ['estado del viaje'],
      ['como va el viaje'],
    ])('reconoce estado del viaje: "%s"', (texto) => {
      expect(interpretar(texto, ahora)).toEqual({ tipo: 'estado_viaje' });
    });

    it.each([
      ['cancela mi viaje'],
      ['cancelar mi viaje'],
      ['cancelar mi reserva'],
      ['cancela la reserva'],
      ['cancela el viaje'],
      ['cancelar viaje'],
    ])('reconoce cancelar general: "%s"', (texto) => {
      expect(interpretar(texto, ahora)).toEqual({ tipo: 'cancelar' });
    });

    it.each([
      ['cancela el primero', 1],
      ['cancelar el segundo', 2],
      ['cancela el 2', 2],
      ['cancela el tercero', 3],
      ['cancela el 1', 1],
    ])('reconoce cancelar con ordinal: "%s" -> n=%d', (texto, n) => {
      expect(interpretar(texto, ahora)).toEqual({ tipo: 'cancelar', n });
    });

    it.each([
      ['ayúdame'],
      ['ayudame'],
      ['ayuda'],
      ['¿qué puedo decir?'],
      ['que puedo decir'],
    ])('reconoce ayuda: "%s"', (texto) => {
      expect(interpretar(texto, ahora)).toEqual({ tipo: 'ayuda' });
    });

    it.each([
      ['el primero', 1],
      ['el 1', 1],
      ['primero', 1],
      ['el segundo', 2],
      ['el 2', 2],
      ['segundo', 2],
      ['el tercero', 3],
      ['el 3', 3],
    ])('reconoce elección en lista: "%s" -> n=%d', (texto, n) => {
      expect(interpretar(texto, ahora)).toEqual({ tipo: 'elegir', n });
    });

    describe('Prioridad fija: cancelar > conductor > estado_viaje', () => {
      it('cancela mi viaje prioritario sobre estado de mi viaje o buscar', () => {
        expect(interpretar('cancela mi viaje', ahora).tipo).toBe('cancelar');
      });

      it('donde esta mi conductor en mi viaje prioritario sobre estado de viaje', () => {
        expect(
          interpretar('donde esta mi conductor en mi viaje', ahora).tipo,
        ).toBe('conductor');
      });
    });
  });
});

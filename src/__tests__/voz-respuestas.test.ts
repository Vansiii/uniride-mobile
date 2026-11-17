import {
  formatoDistanciaMetros,
  formatoMontoUrc,
  respuestaAyuda,
  respuestaCancelarLista,
  respuestaCancelarNada,
  respuestaCancelarNumeroInvalido,
  respuestaCancelarVistaPrevia,
  respuestaConductor,
  respuestaEstadoConductor,
  respuestaEstadoReserva,
  respuestaProximoViaje,
  respuestaSaldo,
} from '../voz/respuestas';

describe('HU-28 · generador de respuestas por voz (pure functions)', () => {
  describe('Formateadores auxiliares', () => {
    it('formatea montos con coma decimal', () => {
      expect(formatoMontoUrc('50.00')).toBe('50,00');
      expect(formatoMontoUrc(12.5)).toBe('12,50');
      expect(formatoMontoUrc(0)).toBe('0,00');
    });

    it('formatea distancias: metros bajo 1 km y km desde 1 km', () => {
      expect(formatoDistanciaMetros(50)).toBe('50 metros');
      expect(formatoDistanciaMetros(300)).toBe('300 metros');
      expect(formatoDistanciaMetros(1000)).toBe('1 km');
      expect(formatoDistanciaMetros(1500)).toBe('1,5 km');
      expect(formatoDistanciaMetros(2340)).toBe('2,3 km');
    });
  });

  describe('CA-1, CA-2 · Saldo', () => {
    it('CA-1: con billetera lee disponible y en garantía', () => {
      const res = respuestaSaldo({
        tieneBilletera: true,
        disponible: '50.00',
        enGarantia: '12.00',
      });
      expect(res).toBe('Tienes 50,00 URC disponibles y 12,00 en garantía.');
    });

    it('CA-2: sin billetera avisa que aún no tiene', () => {
      const res = respuestaSaldo({ tieneBilletera: false });
      expect(res).toBe('Aún no tienes billetera.');
    });
  });

  describe('CA-3, CA-4 · Distancia del conductor', () => {
    it('CA-3: conductor a 300 metros', () => {
      const res = respuestaConductor({
        disponible: true,
        distanciaM: 300,
        enPuntoDeEncuentro: false,
      });
      expect(res).toBe('Tu conductor está a 300 metros del punto de encuentro.');
    });

    it('CA-3: conductor a 1,5 km', () => {
      const res = respuestaConductor({
        disponible: true,
        distanciaM: 1500,
        enPuntoDeEncuentro: false,
      });
      expect(res).toBe('Tu conductor está a 1,5 km del punto de encuentro.');
    });

    it('CA-3: conductor a ≤ 50 m avisa que ya está en el punto de encuentro', () => {
      const res = respuestaConductor({
        disponible: true,
        distanciaM: 40,
        enPuntoDeEncuentro: true,
      });
      expect(res).toBe('Tu conductor ya está en el punto de encuentro.');
    });

    it('CA-4: sin ubicación reciente responde hora y origen', () => {
      const res = respuestaConductor({
        disponible: false,
        distanciaM: null,
        enPuntoDeEncuentro: false,
        horaSalida: 'las 07:00',
        origenNombre: 'Campus UAGRM',
      });
      expect(res).toBe(
        'Aún no tenemos la ubicación de tu conductor. Tu viaje sale a las las 07:00 desde Campus UAGRM.',
      );
    });
  });

  describe('CA-5, RN-5 · Estado de la reserva', () => {
    it('confirmada', () => {
      expect(
        respuestaEstadoReserva({ estado: 'confirmada', horaSalida: '07:00' }),
      ).toBe('Tu reserva está confirmada para las 07:00.');
    });

    it('abordada', () => {
      expect(respuestaEstadoReserva({ estado: 'abordada' })).toBe(
        'Estás a bordo. Tu ubicación se comparte cada 15 s.',
      );
    });

    it('verificada', () => {
      expect(respuestaEstadoReserva({ estado: 'verificada' })).toBe(
        'Tu viaje quedó verificado. El pago al conductor está en camino.',
      );
    });

    it('pagada', () => {
      expect(respuestaEstadoReserva({ estado: 'pagada' })).toBe(
        'Tu viaje terminó y quedó pagado.',
      );
    });

    it('cancelada con monto', () => {
      expect(
        respuestaEstadoReserva({ estado: 'cancelada', montoDevuelto: '12.00' }),
      ).toBe('Tu reserva está cancelada. Te devolvimos 12,00 URC.');
    });

    it('expirada con monto', () => {
      expect(
        respuestaEstadoReserva({ estado: 'expirada', montoDevuelto: '15.00' }),
      ).toBe(
        'Tu reserva venció porque no se verificó el abordaje. Te devolvimos 15,00 URC.',
      );
    });

    it('verificacion_fallida', () => {
      expect(respuestaEstadoReserva({ estado: 'verificacion_fallida' })).toBe(
        'No pudimos verificar tu viaje. Tu dinero sigue en garantía.',
      );
    });
  });

  describe('CA-6 · Estado para el conductor', () => {
    it('informa pasajeros confirmados y a bordo', () => {
      const res = respuestaEstadoConductor({
        horaSalida: '07:00',
        confirmados: 2,
        abordados: 1,
      });
      expect(res).toBe(
        'Tu viaje de las 07:00 tiene 2 pasajeros confirmados y 1 a bordo.',
      );
    });

    it('maneja singular de pasajero', () => {
      const res = respuestaEstadoConductor({
        horaSalida: '07:00',
        confirmados: 1,
        abordados: 0,
      });
      expect(res).toBe(
        'Tu viaje de las 07:00 tiene 1 pasajero confirmado y 0 a bordo.',
      );
    });
  });

  describe('CA-7 · Próximo viaje', () => {
    it('informa próximo viaje cuando existe', () => {
      const res = respuestaProximoViaje({
        dia: 'mañana',
        hora: '07:00',
        destino: 'UAGRM',
      });
      expect(res).toBe('Tu próximo viaje sale mañana a las 07:00 a UAGRM.');
    });

    it('avisa que no tiene viajes cuando es null', () => {
      expect(respuestaProximoViaje(null)).toBe('No tienes viajes próximos.');
    });
  });

  describe('CA-8, CA-9, CA-10 · Cancelar', () => {
    it('CA-8: vista previa de cancelación', () => {
      const res = respuestaCancelarVistaPrevia('12.00');
      expect(res).toBe(
        'Si cancelas ahora te devolvemos 12,00 URC. Confirma con tu huella.',
      );
    });

    it('CA-9: lista de cancelables cuando hay 2', () => {
      const res = respuestaCancelarLista([
        { hora: '07:00', destino: 'UAGRM' },
        { hora: '18:00', destino: 'Equipetrol' },
      ]);
      expect(res).toBe(
        'Tienes 2 viajes: el primero a las 07:00 a UAGRM, el segundo a las 18:00 a Equipetrol. ¿Cuál cancelo?',
      );
    });

    it('CA-10: nada que se pueda cancelar', () => {
      expect(respuestaCancelarNada()).toBe(
        'No tienes viajes que se puedan cancelar.',
      );
    });

    it('número inválido de cancelables', () => {
      expect(respuestaCancelarNumeroInvalido(3)).toBe(
        'Tienes 3 viajes cancelables. ¿Cuál cancelo?',
      );
    });
  });

  describe('CA-12 · Ayuda', () => {
    it('lista los comandos disponibles', () => {
      expect(respuestaAyuda()).toBe(
        'Puedes pedirme: buscar un viaje, reservar, tu saldo, dónde está tu conductor, cómo va tu viaje o cancelar tu viaje.',
      );
    });
  });
});


import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { con, t } from '@/i18n';
import { obtenerUbicacion } from '@/servicios/ubicacion';
import {
  cancelablesActivos,
  ejecutarAccionAyuda,
  ejecutarAccionCancelar,
  ejecutarAccionConductor,
  ejecutarAccionEstadoViaje,
  ejecutarAccionSaldo,
} from './acciones';
import { interpretar } from './interprete';
import { resultadosEnPantalla } from './resultados';

export type EstadoVoz =
  | 'inactivo'
  | 'escuchando'
  | 'procesando'
  | 'respuesta'
  | 'no_entendi'
  | 'sin_permiso'
  | 'permiso_bloqueado'
  | 'no_disponible';

const SILENCIO_MS = 5000;
/** Errores del reconocedor que significan «no llegó voz», no «no te entendí». */
const SIN_VOZ = new Set(['no-speech', 'speech-timeout']);

export function useVoz() {
  const [estado, setEstado] = useState<EstadoVoz>('inactivo');
  const [transcripcion, setTranscripcion] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [fallosSeguidos, setFallosSeguidos] = useState(0);

  const timerSilencio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const estadoRef = useRef<EstadoVoz>(estado);
  // Lo último que se oyó: algunos Android cierran la escucha sin marcar un resultado final.
  const ultimoTexto = useRef('');
  // Cada consulta lleva un número: una respuesta que llega tras cerrar o tras otra pregunta no pisa el panel.
  const turno = useRef(0);

  const cambiarEstado = useCallback((nuevo: EstadoVoz) => {
    estadoRef.current = nuevo;
    setEstado(nuevo);
  }, []);

  const hablar = useCallback(async (texto: string) => {
    try {
      await Speech.stop();
      Speech.speak(texto, { language: 'es-BO' });
    } catch {
      // Si la síntesis de voz no está disponible o falla, el texto se muestra igualmente (RN-8).
    }
  }, []);

  const limpiarSilencio = useCallback(() => {
    if (timerSilencio.current) {
      clearTimeout(timerSilencio.current);
      timerSilencio.current = null;
    }
  }, []);

  const detenerEscucha = useCallback(() => {
    limpiarSilencio();
    try {
      ExpoSpeechRecognitionModule?.abort?.();
    } catch {
      // Ignora error si ya estaba detenido
    }
  }, [limpiarSilencio]);

  const cerrar = useCallback(() => {
    turno.current++;
    detenerEscucha();
    try {
      Speech.stop();
    } catch {}
    cambiarEstado('inactivo');
    setTranscripcion('');
    setMensaje('');
    setFallosSeguidos(0);
  }, [cambiarEstado, detenerEscucha]);

  /** «No entendí» con su mensaje dicho en voz alta; tras dos seguidos el panel ofrece el teclado. */
  const fallar = useCallback(
    (msg: string) => {
      setFallosSeguidos((n) => n + 1);
      cambiarEstado('no_entendi');
      setMensaje(msg);
      void hablar(msg);
    },
    [cambiarEstado, hablar],
  );

  /** Mientras la consulta va a la API el panel dice «Procesando…»; la respuesta llega ya hablada por la acción. */
  const responder = useCallback(
    (accion: Promise<string>) => {
      const mio = ++turno.current;
      setFallosSeguidos(0);
      cambiarEstado('procesando');
      setMensaje('');
      void accion.then((m) => {
        if (mio !== turno.current) return;
        cambiarEstado('respuesta');
        setMensaje(m);
      });
    },
    [cambiarEstado],
  );

  const irAViaje = useCallback(
    (id: string) => {
      setFallosSeguidos(0);
      cerrar();
      router.push({ pathname: '/viajes/[id]', params: { id, porVoz: '1' } });
    },
    [cerrar],
  );

  const procesarTextoReconocido = useCallback(
    (texto: string) => {
      detenerEscucha();
      setTranscripcion(texto);

      if (!texto || !texto.trim()) return fallar(t('voz.comun.no_te_escuche'));

      cambiarEstado('procesando');
      const intencion = interpretar(texto, new Date());

      switch (intencion.tipo) {
        case 'buscar': {
          const mio = ++turno.current;
          setFallosSeguidos(0);
          cambiarEstado('respuesta');
          setMensaje(intencion.textoInterpretado);
          void hablar(intencion.textoInterpretado);
          void obtenerUbicacion(false).then((ubicacion) => {
            if (mio !== turno.current) return;
            if (ubicacion.tipo !== 'ok')
              return fallar(t('voz.buscar.sin_ubicacion'));
            cerrar();
            router.push({
              pathname: '/viajes/buscar',
              params: {
                origenLat: String(ubicacion.lat),
                origenLng: String(ubicacion.lng),
                horaSalida: intencion.hora.toISOString(),
                destino: intencion.destino,
                porVoz: '1',
              },
            });
          });
          return;
        }
        case 'reservar': {
          const lista = resultadosEnPantalla.obtener();
          if (!lista || lista.length === 0)
            return fallar(t('voz.reservar.sin_resultados'));
          if (intencion.n < 1 || intencion.n > lista.length)
            return fallar(
              con('voz.reservar.numero_invalido', { total: lista.length }),
            );
          return irAViaje(lista[intencion.n - 1].id);
        }
        case 'saldo':
          return responder(ejecutarAccionSaldo(hablar));
        case 'conductor':
          return responder(ejecutarAccionConductor(hablar));
        case 'estado_viaje':
          return responder(ejecutarAccionEstadoViaje(hablar));
        case 'ayuda':
          return responder(ejecutarAccionAyuda(hablar));
        case 'cancelar':
          return responder(
            ejecutarAccionCancelar(intencion.n, hablar).then((r) => r.mensaje),
          );
        case 'elegir': {
          if (cancelablesActivos.obtener().length > 0)
            return responder(
              ejecutarAccionCancelar(intencion.n, hablar).then(
                (r) => r.mensaje,
              ),
            );
          const lista = resultadosEnPantalla.obtener();
          if (lista && intencion.n >= 1 && intencion.n <= lista.length)
            return irAViaje(lista[intencion.n - 1].id);
          return fallar(t('voz.comun.no_entendi'));
        }
        case 'falta':
          return fallar(
            t(
              intencion.dato === 'hora'
                ? 'voz.buscar.falta_hora'
                : 'voz.buscar.falta_destino',
            ),
          );
        default:
          return fallar(t('voz.comun.no_entendi'));
      }
    },
    [
      cambiarEstado,
      cerrar,
      detenerEscucha,
      fallar,
      hablar,
      irAViaje,
      responder,
    ],
  );

  const reiniciarSilencio = useCallback(() => {
    limpiarSilencio();
    timerSilencio.current = setTimeout(() => {
      if (estadoRef.current !== 'escuchando') return;
      // Si ya se oyó algo, el silencio es el fin de la frase: se procesa en vez de descartarla.
      if (ultimoTexto.current.trim())
        procesarTextoReconocido(ultimoTexto.current);
      else {
        detenerEscucha();
        fallar(t('voz.comun.no_te_escuche'));
      }
    }, SILENCIO_MS);
  }, [detenerEscucha, fallar, limpiarSilencio, procesarTextoReconocido]);

  const iniciarEscucha = useCallback(async () => {
    turno.current++;
    try {
      Speech.stop();
    } catch {}

    try {
      // CA-13: Comprueba si el reconocimiento está disponible
      if (
        typeof ExpoSpeechRecognitionModule?.isRecognitionAvailable ===
          'function' &&
        !ExpoSpeechRecognitionModule.isRecognitionAvailable()
      ) {
        cambiarEstado('no_disponible');
        setMensaje(t('voz.comun.no_disponible'));
        return;
      }

      // CA-11: Permiso de micrófono
      if (
        typeof ExpoSpeechRecognitionModule?.requestPermissionsAsync ===
        'function'
      ) {
        const resPermiso =
          await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!resPermiso.granted) {
          // Solo si Android ya no muestra el diálogo («No volver a preguntar») hay que ir a Ajustes.
          const bloqueado = resPermiso.canAskAgain === false;
          cambiarEstado(bloqueado ? 'permiso_bloqueado' : 'sin_permiso');
          setMensaje(
            t(bloqueado ? 'voz.permiso.bloqueado' : 'voz.permiso.microfono'),
          );
          return;
        }
      }

      ultimoTexto.current = '';
      setTranscripcion('');
      setMensaje(t('voz.panel.te_escucho'));
      cambiarEstado('escuchando');
      // Vibración leve: avisa que ya puede hablar sin mirar la pantalla.
      Haptics.selectionAsync().catch(() => undefined);

      reiniciarSilencio();

      if (typeof ExpoSpeechRecognitionModule?.start === 'function') {
        ExpoSpeechRecognitionModule.start({
          lang: 'es-BO',
          interimResults: true,
          continuous: false,
          // El nivel de la voz anima las ondas del micrófono en el panel.
          volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
        });
      }
    } catch {
      cambiarEstado('no_disponible');
      setMensaje(t('voz.comun.no_disponible'));
    }
  }, [cambiarEstado, reiniciarSilencio]);

  /** «Listo» mientras escucha: termina la frase ya, sin esperar el silencio. */
  const terminarEscucha = useCallback(() => {
    if (estadoRef.current !== 'escuchando') return;
    procesarTextoReconocido(ultimoTexto.current);
  }, [procesarTextoReconocido]);

  useSpeechRecognitionEvent('result', (event) => {
    if (estadoRef.current !== 'escuchando') return;
    reiniciarSilencio();
    const resultado = event.results?.[0]?.transcript ?? '';
    ultimoTexto.current = resultado;
    setTranscripcion(resultado);
    if (event.isFinal) procesarTextoReconocido(resultado);
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'aborted' || estadoRef.current !== 'escuchando') return;
    detenerEscucha();
    fallar(
      t(
        SIN_VOZ.has(event.error)
          ? 'voz.comun.no_te_escuche'
          : 'voz.comun.no_entendi',
      ),
    );
  });

  // Si la escucha termina sin resultado final, se procesa lo último oído en vez de quedarse «escuchando».
  useSpeechRecognitionEvent('end', () => {
    if (estadoRef.current === 'escuchando')
      procesarTextoReconocido(ultimoTexto.current);
    else limpiarSilencio();
  });

  const reintentar = useCallback(() => {
    void iniciarEscucha();
  }, [iniciarEscucha]);

  useEffect(() => {
    return () => {
      limpiarSilencio();
      try {
        ExpoSpeechRecognitionModule?.abort?.();
        Speech.stop();
      } catch {}
    };
  }, [limpiarSilencio]);

  return {
    estado,
    transcripcion,
    mensaje,
    fallosSeguidos,
    escuchando: estado === 'escuchando',
    iniciarEscucha,
    detenerEscucha,
    terminarEscucha,
    cerrar,
    reintentar,
    hablar,
    procesarTexto: procesarTextoReconocido,
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { con, t } from '@/i18n';
import { obtenerUbicacion } from '@/servicios/ubicacion';
import { type Intencion, interpretar } from './interprete';
import { resultadosEnPantalla } from './resultados';

export type EstadoVoz =
  | 'inactivo'
  | 'escuchando'
  | 'procesando'
  | 'respuesta'
  | 'no_entendi'
  | 'sin_permiso'
  | 'no_disponible';

const SILENCIO_MS = 5000;

interface UseVozOpciones {
  onComando?: (intencion: Intencion) => void;
  onCerrar?: () => void;
}

export function useVoz(opciones: UseVozOpciones = {}) {
  const [estado, setEstado] = useState<EstadoVoz>('inactivo');
  const [transcripcion, setTranscripcion] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [fallosSeguidos, setFallosSeguidos] = useState(0);

  const timerSilencio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const estadoRef = useRef<EstadoVoz>(estado);

  useEffect(() => {
    estadoRef.current = estado;
  }, [estado]);

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
    detenerEscucha();
    try {
      Speech.stop();
    } catch {}
    setEstado('inactivo');
    setTranscripcion('');
    setMensaje('');
    setFallosSeguidos(0);
    opciones.onCerrar?.();
  }, [detenerEscucha, opciones]);

  const procesarTextoReconocido = useCallback(
    (texto: string) => {
      limpiarSilencio();
      detenerEscucha();

      if (!texto || !texto.trim()) {
        const nuevosFallos = fallosSeguidos + 1;
        setFallosSeguidos(nuevosFallos);
        setEstado('no_entendi');
        const msg = t('voz.comun.no_te_escuche');
        setMensaje(msg);
        hablar(msg);
        return;
      }

      setEstado('procesando');
      const intencion = interpretar(texto, new Date());

      if (intencion.tipo === 'buscar') {
        setFallosSeguidos(0);
        setEstado('respuesta');
        setMensaje(intencion.textoInterpretado);
        hablar(intencion.textoInterpretado);
        if (opciones.onComando) {
          opciones.onComando(intencion);
        } else {
          void obtenerUbicacion(false).then((ubicacion) => {
            if (ubicacion.tipo === 'ok') {
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
            } else {
              setEstado('no_entendi');
              const msg = t('voz.buscar.sin_ubicacion');
              setMensaje(msg);
              hablar(msg);
            }
          });
        }
      } else if (intencion.tipo === 'reservar') {
        if (opciones.onComando) {
          opciones.onComando(intencion);
        } else {
          const lista = resultadosEnPantalla.obtener();
          if (!lista || lista.length === 0) {
            const nuevosFallos = fallosSeguidos + 1;
            setFallosSeguidos(nuevosFallos);
            setEstado('no_entendi');
            const msg = t('voz.reservar.sin_resultados');
            setMensaje(msg);
            hablar(msg);
            return;
          }
          if (intencion.n < 1 || intencion.n > lista.length) {
            const nuevosFallos = fallosSeguidos + 1;
            setFallosSeguidos(nuevosFallos);
            setEstado('no_entendi');
            const msg = con('voz.reservar.numero_invalido', {
              total: lista.length,
            });
            setMensaje(msg);
            hablar(msg);
            return;
          }
          const elegido = lista[intencion.n - 1];
          setFallosSeguidos(0);
          setEstado('respuesta');
          cerrar();
          router.push({
            pathname: '/viajes/[id]',
            params: { id: elegido.id, porVoz: '1' },
          });
        }
      } else if (intencion.tipo === 'falta') {
        const nuevosFallos = fallosSeguidos + 1;
        setFallosSeguidos(nuevosFallos);
        setEstado('no_entendi');
        const msg =
          intencion.dato === 'hora'
            ? t('voz.buscar.falta_hora')
            : t('voz.buscar.falta_destino');
        setMensaje(msg);
        hablar(msg);
      } else {
        const nuevosFallos = fallosSeguidos + 1;
        setFallosSeguidos(nuevosFallos);
        setEstado('no_entendi');
        const msg = t('voz.comun.no_entendi');
        setMensaje(msg);
        hablar(msg);
      }
    },
    [cerrar, detenerEscucha, fallosSeguidos, hablar, limpiarSilencio, opciones],
  );

  const reiniciarSilencio = useCallback(() => {
    limpiarSilencio();
    timerSilencio.current = setTimeout(() => {
      if (estadoRef.current === 'escuchando') {
        detenerEscucha();
        const nuevosFallos = fallosSeguidos + 1;
        setFallosSeguidos(nuevosFallos);
        setEstado('no_entendi');
        const msg = t('voz.comun.no_te_escuche');
        setMensaje(msg);
        hablar(msg);
      }
    }, SILENCIO_MS);
  }, [detenerEscucha, fallosSeguidos, hablar, limpiarSilencio]);

  const iniciarEscucha = useCallback(async () => {
    try {
      Speech.stop();
    } catch {}

    try {
      // CA-13: Comprueba si el reconocimiento está disponible
      if (
        typeof ExpoSpeechRecognitionModule?.isRecognitionAvailable === 'function' &&
        !ExpoSpeechRecognitionModule.isRecognitionAvailable()
      ) {
        setEstado('no_disponible');
        setMensaje(t('voz.comun.no_disponible'));
        return;
      }

      // CA-11: Permiso de micrófono
      if (
        typeof ExpoSpeechRecognitionModule?.requestPermissionsAsync === 'function'
      ) {
        const resPermiso =
          await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!resPermiso.granted) {
          setEstado('sin_permiso');
          setMensaje(t('voz.permiso.microfono'));
          return;
        }
      }

      setTranscripcion('');
      setMensaje(t('voz.panel.te_escucho'));
      setEstado('escuchando');

      reiniciarSilencio();

      if (typeof ExpoSpeechRecognitionModule?.start === 'function') {
        ExpoSpeechRecognitionModule.start({
          lang: 'es-BO',
          interimResults: true,
          continuous: false,
        });
      }
    } catch {
      setEstado('no_disponible');
      setMensaje(t('voz.comun.no_disponible'));
    }
  }, [reiniciarSilencio]);

  useSpeechRecognitionEvent('result', (event) => {
    if (estadoRef.current !== 'escuchando') return;
    reiniciarSilencio();
    const resultado = event.results?.[0]?.transcript ?? '';
    setTranscripcion(resultado);
    if (event.isFinal) {
      procesarTextoReconocido(resultado);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'aborted') return;
    limpiarSilencio();
    detenerEscucha();
    const nuevosFallos = fallosSeguidos + 1;
    setFallosSeguidos(nuevosFallos);
    setEstado('no_entendi');
    const msg = t('voz.comun.no_entendi');
    setMensaje(msg);
    hablar(msg);
  });

  useSpeechRecognitionEvent('end', () => {
    limpiarSilencio();
  });

  const reintentar = useCallback(() => {
    iniciarEscucha();
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
    cerrar,
    reintentar,
    hablar,
    procesarTexto: procesarTextoReconocido,
  };
}

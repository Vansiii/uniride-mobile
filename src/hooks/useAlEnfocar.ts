import * as Router from 'expo-router';
import { useEffect } from 'react';

/**
 * Ejecuta `accion` cada vez que la pantalla vuelve a estar al frente (las pestañas se quedan montadas).
 * `accion` debe ir en `useCallback`. Sin navegador (pruebas que simulan `expo-router` a medias) corre al montar.
 */
export function useAlEnfocar(accion: () => void | (() => void)) {
  // `Router.useFocusEffect` es fijo durante toda la vida de la app: el orden de los hooks no cambia.
  const enfoque: (cb: () => void | (() => void)) => void =
    Router.useFocusEffect ??
    ((cb) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useEffect(cb, [cb]);
    });
  enfoque(accion);
}

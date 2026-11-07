import { MapaCompleto, type Punto } from '@/componentes/MapaCompleto';

const ZOOM_INICIAL = 16;

/** Elegir un punto moviendo el mapa bajo un pin fijo. Quien no puede usar el mapa tiene el buscador de lugares. */
export function SelectorMapa({
  inicial,
  alCancelar,
  alElegir,
}: {
  inicial: Punto;
  alCancelar: () => void;
  alElegir: (punto: Punto) => void;
}) {
  return (
    <MapaCompleto
      inicial={{ center: [inicial.lng, inicial.lat], zoom: ZOOM_INICIAL }}
      alCerrar={alCancelar}
      alElegir={alElegir}
    />
  );
}

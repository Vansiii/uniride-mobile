import { type ReactNode, useImperativeHandle } from 'react';
import { View } from 'react-native';

/** En Jest no hay vista nativa. El centro y el zoom que devuelve el mapa se fijan desde la prueba. */
export const mapaSimulado = {
  centro: [-63.18, -17.78],
  zoom: 16,
  estilo: null as unknown,
  camara: { easeTo: jest.fn(), zoomTo: jest.fn() },
};

export function Map({
  ref,
  mapStyle,
  children,
}: {
  ref?: React.Ref<unknown>;
  mapStyle: unknown;
  children?: ReactNode;
}) {
  mapaSimulado.estilo = mapStyle;
  useImperativeHandle(ref, () => ({
    getCenter: async () => mapaSimulado.centro,
    getZoom: async () => mapaSimulado.zoom,
  }));
  return <View>{children}</View>;
}

export function Camera({ ref }: { ref?: React.Ref<unknown> }) {
  useImperativeHandle(ref, () => mapaSimulado.camara);
  return null;
}

export const Marker = ({ children }: { children?: ReactNode }) => (
  <View>{children}</View>
);
export const NativeUserLocation = () => null;

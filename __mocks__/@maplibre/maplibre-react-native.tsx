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
  onPress,
  children,
}: {
  ref?: React.Ref<unknown>;
  mapStyle: unknown;
  onPress?: unknown;
  children?: ReactNode;
}) {
  Object.assign(mapaSimulado, { estilo: mapStyle }); // la regla react-hooks/immutability de SDK 58 rechaza la asignación directa
  useImperativeHandle(ref, () => ({
    getCenter: async () => mapaSimulado.centro,
    getZoom: async () => mapaSimulado.zoom,
  }));
  // La prueba simula un toque con fireEvent(getByTestId('mapa'), 'press', { nativeEvent: { lngLat } }).
  return (
    <View testID="mapa" {...{ onPress }}>
      {children}
    </View>
  );
}

export function Camera({ ref }: { ref?: React.Ref<unknown> }) {
  useImperativeHandle(ref, () => mapaSimulado.camara);
  return null;
}

export const Marker = ({
  lngLat,
  children,
}: {
  lngLat: number[];
  children?: ReactNode;
}) => <View testID={`marcador ${lngLat.join(',')}`}>{children}</View>;
export const NativeUserLocation = () => null;
export const GeoJSONSource = ({ children }: { children?: ReactNode }) => (
  <View>{children}</View>
);
export const Layer = () => null;

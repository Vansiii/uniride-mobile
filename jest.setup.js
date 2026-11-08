/* global jest */
// Reanimated y worklets corren en un hilo nativo que Jest no tiene: se sustituyen por una simulación mínima
// con lo que usa la app (valores compartidos, estilos animados, entradas y utilidades de movimiento).
jest.mock('react-native-worklets', () => ({}));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const cadena = () => {
    const efecto = new Proxy(() => efecto, { get: () => () => efecto });
    return efecto;
  };
  const facil = () => ({ inOut: () => facil, quad: facil, sin: facil });
  const animacion = (valor) => valor;
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c) => c },
    createAnimatedComponent: (c) => c,
    useSharedValue: (valor) => ({
      value: valor,
      get() {
        return this.value;
      },
      set(nuevo) {
        this.value = nuevo;
      },
    }),
    useAnimatedStyle: (f) => f(),
    withSpring: animacion,
    withTiming: animacion,
    withRepeat: animacion,
    withSequence: (...pasos) => pasos[pasos.length - 1],
    interpolateColor: (_v, _e, salidas) => salidas[0],
    Easing: { inOut: facil, quad: facil, sin: facil },
    FadeInDown: cadena(),
    ReduceMotion: { System: 'system' },
  };
});

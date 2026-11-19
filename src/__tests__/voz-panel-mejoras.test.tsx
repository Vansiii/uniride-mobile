import { act, fireEvent, render } from '@testing-library/react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { PanelVoz } from '../componentes/PanelVoz';
import { useVoz } from '../voz/useVoz';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const base = { visible: true, alCerrar: jest.fn(), alReintentar: jest.fn() };

describe('PanelVoz: sugerencias, terminar y respuesta', () => {
  it('escuchando sin texto: tocar una sugerencia hace lo mismo que decirla', async () => {
    const alProbar = jest.fn();
    const { getByRole } = await render(
      <PanelVoz {...base} estado="escuchando" alProbar={alProbar} />,
    );
    await fireEvent.press(getByRole('button', { name: '¿Cuál es mi saldo?' }));
    expect(alProbar).toHaveBeenCalledWith('¿Cuál es mi saldo?');
  });

  it('escuchando: tocar el micrófono termina la frase', async () => {
    const alTerminar = jest.fn();
    const { getByRole } = await render(
      <PanelVoz {...base} estado="escuchando" alTerminar={alTerminar} />,
    );
    await fireEvent.press(getByRole('button', { name: 'Terminar de hablar' }));
    expect(alTerminar).toHaveBeenCalledTimes(1);
  });

  it('respuesta: muestra lo que dijiste y ofrece preguntar otra cosa o terminar', async () => {
    const alReintentar = jest.fn();
    const alCerrar = jest.fn();
    const { getByText } = await render(
      <PanelVoz
        visible
        estado="respuesta"
        transcripcion="cuál es mi saldo"
        mensaje="Tienes 25,00 URC disponibles."
        alCerrar={alCerrar}
        alReintentar={alReintentar}
      />,
    );
    expect(getByText('Dijiste «cuál es mi saldo»')).toBeTruthy();
    await fireEvent.press(getByText('Preguntar otra cosa'));
    expect(alReintentar).toHaveBeenCalledTimes(1);
    await fireEvent.press(getByText('Listo'));
    expect(alCerrar).toHaveBeenCalledTimes(1);
  });
});

async function montarVoz() {
  let ref: ReturnType<typeof useVoz> | null = null;
  function Componente() {
    ref = useVoz();
    return null;
  }
  await render(<Componente />);
  return { current: () => ref! };
}

describe('useVoz: fin de la escucha', () => {
  const eventos: Record<string, (e: unknown) => void> = {};
  beforeEach(() => {
    jest.mocked(useSpeechRecognitionEvent).mockImplementation((nombre, fn) => {
      eventos[nombre] = fn as (e: unknown) => void;
    });
  });

  it('si Android cierra sin resultado final, procesa lo último oído y no queda «escuchando»', async () => {
    const voz = await montarVoz();
    await act(() => voz.current().iniciarEscucha());
    expect(voz.current().estado).toBe('escuchando');
    expect(ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith(
      expect.objectContaining({
        volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
      }),
    );
    await act(async () => {
      eventos.result({
        isFinal: false,
        results: [{ transcript: 'hola que tal' }],
      });
    });
    await act(async () => eventos.end(null));
    expect(voz.current().estado).toBe('no_entendi');
    expect(voz.current().transcripcion).toBe('hola que tal');
  });

  it('sin voz (no-speech) dice «No te escuché» en vez de «No entendí»', async () => {
    const voz = await montarVoz();
    await act(() => voz.current().iniciarEscucha());
    await act(async () => eventos.error({ error: 'no-speech' }));
    expect(voz.current().mensaje).toBe(
      'No te escuché. Toca el micrófono para hablar.',
    );
  });
});

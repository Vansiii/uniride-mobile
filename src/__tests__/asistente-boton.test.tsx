import { fireEvent, render } from '@testing-library/react-native';
import { BotonAsistente } from '../componentes/BotonAsistente';

describe('BotonAsistente (DESIGN_SYSTEM P10)', () => {
  it('se renderiza con etiqueta accesible y ejecuta alPresionar', async () => {
    const alPresionar = jest.fn();
    const { getByLabelText } = await render(
      <BotonAsistente alPresionar={alPresionar} />,
    );

    const boton = getByLabelText('Abrir asistente de UniRide');
    expect(boton).toBeTruthy();

    fireEvent.press(boton);
    expect(alPresionar).toHaveBeenCalledTimes(1);
  });
});


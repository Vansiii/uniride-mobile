import { act, fireEvent, render } from '@testing-library/react-native';
import { TutorialUniRide } from '../componentes/TutorialUniRide';

describe('TutorialUniRide (Tour autoguiado)', () => {
  it('avanza por los 3 pasos y se cierra al terminar', async () => {
    const alCerrar = jest.fn();
    const { getByText, getByRole } = await render(
      <TutorialUniRide visible alCerrar={alCerrar} />,
    );

    // Paso 1
    expect(getByText('1. Reserva con garantía')).toBeTruthy();

    // Avanza a Paso 2
    await act(async () => {
      fireEvent.press(getByRole('button', { name: 'Siguiente' }));
    });
    expect(getByText('2. Abordaje seguro')).toBeTruthy();

    // Avanza a Paso 3
    await act(async () => {
      fireEvent.press(getByRole('button', { name: 'Siguiente' }));
    });
    expect(getByText('3. Pago automático al bajar')).toBeTruthy();

    // Finaliza con "Entendido"
    await act(async () => {
      fireEvent.press(getByRole('button', { name: 'Entendido' }));
    });

    expect(alCerrar).toHaveBeenCalledTimes(1);
  });
});

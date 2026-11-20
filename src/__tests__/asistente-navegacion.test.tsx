import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import * as api from '../api/cliente';
import { TarjetaGuiaAsistente } from '../componentes/TarjetaGuiaAsistente';

jest.mock('../api/cliente', () => ({
  consultarAsistente: jest.fn(),
}));

describe('TarjetaGuiaAsistente', () => {
  it('muestra título y sugerencias cuando está visible', async () => {
    const alCerrar = jest.fn();
    const { getByText } = await render(
      <TarjetaGuiaAsistente visible alCerrar={alCerrar} />,
    );

    expect(getByText('Asistente UniRide')).toBeTruthy();
    expect(getByText('¿Cómo funciona el pago?')).toBeTruthy();
  });

  it('ejecuta consulta al tocar una sugerencia y muestra pasos y acción', async () => {
    jest.mocked(api.consultarAsistente).mockResolvedValueOnce({
      modo: 'guia',
      mensaje: 'El pasaje queda en garantía.',
      pasos: ['Reservas tu asiento', 'Escaneas el QR', 'Se libera al bajar'],
      accion: {
        ruta: '/billetera',
        etiquetaBoton: 'Ver mi Billetera',
      },
    });

    const onNavegar = jest.fn();
    const alCerrar = jest.fn();

    const { getByText } = await render(
      <TarjetaGuiaAsistente
        visible
        alCerrar={alCerrar}
        onNavegar={onNavegar}
      />,
    );

    const chip = getByText('¿Cómo funciona el pago?');
    await act(async () => {
      fireEvent.press(chip);
    });

    await waitFor(() => {
      expect(getByText('El pasaje queda en garantía.')).toBeTruthy();
      expect(getByText('Reservas tu asiento')).toBeTruthy();
      expect(getByText('Ver mi Billetera')).toBeTruthy();
    });

    const botonAccion = getByText('Ver mi Billetera');
    fireEvent.press(botonAccion);

    expect(alCerrar).toHaveBeenCalledTimes(1);
    expect(onNavegar).toHaveBeenCalledWith('/billetera', undefined);
  });

  it('se cierra al presionar el botón de cierre', async () => {
    const alCerrar = jest.fn();
    const { getByLabelText } = await render(
      <TarjetaGuiaAsistente visible alCerrar={alCerrar} />,
    );

    const botonCerrar = getByLabelText('Cerrar asistente');
    fireEvent.press(botonCerrar);

    expect(alCerrar).toHaveBeenCalledTimes(1);
  });
});

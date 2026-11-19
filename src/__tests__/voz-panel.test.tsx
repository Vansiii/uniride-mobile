import { fireEvent, render } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { BotonVoz } from '../componentes/BotonVoz';
import { PanelVoz } from '../componentes/PanelVoz';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('HU-27 CA-1, CA-11, CA-13 · BotonVoz y PanelVoz', () => {
  it('CA-1: BotonVoz se renderiza con etiqueta accesible "Hablar con UniRide"', async () => {
    const alPresionar = jest.fn();
    const { getByLabelText } = await render(
      <BotonVoz alPresionar={alPresionar} />,
    );
    const boton = getByLabelText('Hablar con UniRide');
    expect(boton).toBeTruthy();
    fireEvent.press(boton);
    expect(alPresionar).toHaveBeenCalledTimes(1);
  });

  it('estado "escuchando": muestra "Te escucho…" y el ejemplo si no hay transcripción', async () => {
    const { getByText } = await render(
      <PanelVoz
        visible
        estado="escuchando"
        alCerrar={jest.fn()}
        alReintentar={jest.fn()}
      />,
    );
    expect(getByText('Te escucho…')).toBeTruthy();
    expect(
      getByText('Ejemplo: «Busca un viaje a la UAGRM a las 7»'),
    ).toBeTruthy();
  });

  it('estado "escuchando": muestra la transcripción en vivo', async () => {
    const { getByText } = await render(
      <PanelVoz
        visible
        estado="escuchando"
        transcripcion="busca un viaje a la UAGRM"
        alCerrar={jest.fn()}
        alReintentar={jest.fn()}
      />,
    );
    expect(getByText('«busca un viaje a la UAGRM»')).toBeTruthy();
  });

  it('estado "procesando": muestra texto de procesamiento', async () => {
    const { getByText } = await render(
      <PanelVoz
        visible
        estado="procesando"
        mensaje="Entendí: viaje a UAGRM, hoy a las 07:00"
        alCerrar={jest.fn()}
        alReintentar={jest.fn()}
      />,
    );
    expect(getByText('Entendí: viaje a UAGRM, hoy a las 07:00')).toBeTruthy();
  });

  it('estado "no_entendi": muestra mensaje y botón de volver a intentar', async () => {
    const alReintentar = jest.fn();
    const { getByText } = await render(
      <PanelVoz
        visible
        estado="no_entendi"
        mensaje="¿A qué hora quieres salir?"
        fallosSeguidos={1}
        alCerrar={jest.fn()}
        alReintentar={alReintentar}
      />,
    );
    expect(getByText('¿A qué hora quieres salir?')).toBeTruthy();
    const botonReintentar = getByText('Volver a intentar');
    fireEvent.press(botonReintentar);
    expect(alReintentar).toHaveBeenCalledTimes(1);
  });

  it('tras 2 fallos seguidos: ofrece "Hazlo con el teclado"', async () => {
    const alUsarTeclado = jest.fn();
    const { getByText } = await render(
      <PanelVoz
        visible
        estado="no_entendi"
        mensaje="No entendí. Puedes decir: busca un viaje a la UAGRM a las 7"
        fallosSeguidos={2}
        alCerrar={jest.fn()}
        alReintentar={jest.fn()}
        alUsarTeclado={alUsarTeclado}
      />,
    );
    const botonTeclado = getByText('Hazlo con el teclado');
    expect(botonTeclado).toBeTruthy();
    fireEvent.press(botonTeclado);
    expect(alUsarTeclado).toHaveBeenCalledTimes(1);
  });

  it('CA-11: estado "sin_permiso" vuelve a pedir el permiso, sin mandar a Ajustes', async () => {
    const spyOpenSettings = jest
      .spyOn(Linking, 'openSettings')
      .mockImplementation(jest.fn());
    const alReintentar = jest.fn();
    const { getByText, queryByText } = await render(
      <PanelVoz
        visible
        estado="sin_permiso"
        alCerrar={jest.fn()}
        alReintentar={alReintentar}
      />,
    );
    expect(
      getByText('UniRide usa el micrófono para escuchar tus comandos de voz.'),
    ).toBeTruthy();
    expect(queryByText('Abrir ajustes')).toBeNull();
    fireEvent.press(getByText('Permitir micrófono'));
    expect(alReintentar).toHaveBeenCalledTimes(1);
    expect(spyOpenSettings).not.toHaveBeenCalled();
    spyOpenSettings.mockRestore();
  });

  it('CA-11: permiso bloqueado en Android ofrece abrir ajustes', async () => {
    const spyOpenSettings = jest
      .spyOn(Linking, 'openSettings')
      .mockImplementation(jest.fn());
    const { getByText } = await render(
      <PanelVoz
        visible
        estado="permiso_bloqueado"
        alCerrar={jest.fn()}
        alReintentar={jest.fn()}
      />,
    );
    const botonAjustes = getByText('Abrir ajustes');
    fireEvent.press(botonAjustes);
    expect(spyOpenSettings).toHaveBeenCalled();
    spyOpenSettings.mockRestore();
  });

  it('CA-13: estado "no_disponible" muestra aviso y permite cerrar', async () => {
    const alCerrar = jest.fn();
    const { getByText } = await render(
      <PanelVoz
        visible
        estado="no_disponible"
        alCerrar={alCerrar}
        alReintentar={jest.fn()}
      />,
    );
    expect(
      getByText('La voz no está disponible ahora. Usa la búsqueda.'),
    ).toBeTruthy();
    fireEvent.press(getByText('Cerrar'));
    expect(alCerrar).toHaveBeenCalledTimes(1);
  });
});

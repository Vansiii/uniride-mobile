import { convertFormDataAsync } from 'expo/src/winter/fetch/convertFormData';
import { registrarVehiculo } from '@/api/cliente';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Como en el teléfono: el FormData de React Native con el parche de Expo, y expo/fetch como `fetch` global.
// Jest trae el FormData de Node (convierte cualquier objeto en texto) y jest-expo simula el parche: con ellos
// el fallo no se reproduce.
globalThis.FormData = jest.requireActual(
  'react-native/Libraries/Network/FormData',
).default;
jest.requireActual('expo/src/winter/FormData').installFormDataPatch(FormData);

/** El formulario que la app entrega a `fetch`. */
async function formularioEnviado(): Promise<FormData> {
  let cuerpo: unknown;
  globalThis.fetch = jest.fn(async (_url: string, init: { body: unknown }) => {
    cuerpo = init.body;
    return new Response('{}', { status: 201 });
  }) as unknown as typeof fetch;
  await registrarVehiculo({
    placa: '1234ABC',
    marca: 'Toyota',
    modelo: 'Corolla',
    color: 'Blanco',
    capacidad: 4,
    aceptaUsoFoto: true,
    foto: {
      uri: 'file:///cache/foto.jpg',
      tipo: 'image/jpeg',
      base64: '/9j/4AAQ',
    },
  });
  return cuerpo as FormData;
}

describe('HU-11 · la foto sale por expo/fetch', () => {
  it('expo/fetch arma el multipart con los bytes de la foto (antes lanzaba y la app decía «sin conexión»)', async () => {
    const { body, boundary } = await convertFormDataAsync(
      await formularioEnviado(),
    );
    const texto = String.fromCharCode(...body);
    expect(texto).toContain(`--${boundary}`);
    expect(texto).toContain(
      'content-disposition: form-data; name="foto"; filename="foto"',
    );
    expect(texto).toContain('content-type: image/jpeg');
    expect(texto).toContain('\xff\xd8\xff\xe0\x00\x10');
  });

  it('una parte `{ uri }` de React Native es la que expo/fetch rechaza', async () => {
    const formulario = new FormData();
    formulario.append('foto', {
      uri: 'file:///cache/foto.jpg',
      name: 'foto',
      type: 'image/jpeg',
    } as unknown as Blob);
    await expect(convertFormDataAsync(formulario)).rejects.toThrow(
      'Unsupported FormDataPart implementation',
    );
  });
});

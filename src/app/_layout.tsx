import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ProveedorSesion } from '@/contexto/sesion';
import { ProveedorTema, useTema } from '@/tema/ProveedorTema';
// HU-23: la tarea de ubicación se define al arrancar; Android la llama también con la app cerrada.
import '@/viajes/seguimiento';

/** HU-31: el fondo y la barra de estado siguen el tema elegido, al instante. */
function Pila() {
  const { colores, esquema } = useTema();
  return (
    <>
      <StatusBar style={esquema === 'oscuro' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colores.fondo },
        }}
      />
    </>
  );
}

export default function Diseno() {
  return (
    <ProveedorTema>
      <ProveedorSesion>
        <Pila />
      </ProveedorSesion>
    </ProveedorTema>
  );
}

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ProveedorSesion } from '@/contexto/sesion';
import { colores } from '@/tema/tokens';
// HU-23: la tarea de ubicación se define al arrancar; Android la llama también con la app cerrada.
import '@/viajes/seguimiento';

export default function Diseno() {
  return (
    <ProveedorSesion>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colores.fondo },
        }}
      />
    </ProveedorSesion>
  );
}

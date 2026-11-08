import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ProveedorSesion } from '@/contexto/sesion';
import { colores } from '@/tema/tokens';

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

import { Stack } from 'expo-router';
import { ProveedorSesion } from '@/contexto/sesion';

export default function Diseno() {
  return (
    <ProveedorSesion>
      <Stack screenOptions={{ headerShown: false }} />
    </ProveedorSesion>
  );
}

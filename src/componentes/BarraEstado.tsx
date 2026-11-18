import { StatusBar } from 'expo-status-bar';
import { useTema } from '@/tema/ProveedorTema';

/** HU-31: íconos de la barra de estado claros sobre fondo oscuro y oscuros sobre fondo claro. */
export function BarraEstado() {
  const { esquema } = useTema();
  return <StatusBar style={esquema === 'oscuro' ? 'light' : 'dark'} />;
}

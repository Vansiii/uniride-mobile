import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { consultarMisReservas, Reserva, RESERVA_ACTIVA } from '@/api/cliente';
import { useAlEnfocar } from '@/hooks/useAlEnfocar';
import { t } from '@/i18n';
import { colores, espacio, tipografia } from '@/tema/tokens';
import { TarjetaReserva } from './TarjetaReserva';

/** El viaje reservado que sale primero y todavía no salió (paso 4 del flujo, DESIGN_SYSTEM §10.2). */
export const proximaReserva = (reservas: Reserva[], ahora = Date.now()) =>
  reservas
    .filter(
      (r) =>
        RESERVA_ACTIVA.includes(r.estado) &&
        // Una hora de gracia: el viaje en curso sigue siendo «el viaje activo».
        Date.parse(r.viaje.fechaHoraSalida) > ahora - 60 * 60_000,
    )
    .sort(
      (a, b) =>
        Date.parse(a.viaje.fechaHoraSalida) -
        Date.parse(b.viaje.fechaHoraSalida),
    )[0];

/** Tarjeta de «Tu próximo viaje» en Inicio. Si no hay reservas o no se pueden leer, no ocupa lugar. */
export function ViajeActivo() {
  const [reserva, setReserva] = useState<Reserva>();
  useAlEnfocar(
    useCallback(() => {
      consultarMisReservas()
        .then((todas) => setReserva(proximaReserva(todas)))
        // Es un atajo: si falla, Mis viajes sigue ahí y dice por qué.
        .catch(() => setReserva(undefined));
    }, []),
  );
  if (!reserva) return null;
  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.titulo} accessibilityRole="header">
        {t('reservas.mis_viajes.activo_titulo')}
      </Text>
      <TarjetaReserva
        reserva={reserva}
        alPresionar={() => router.push(`/reserva/${reserva.reservaId}`)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    gap: espacio(2),
    marginTop: espacio(4),
    marginHorizontal: espacio(4),
  },
  titulo: { ...tipografia.titulo, color: colores.texto },
});

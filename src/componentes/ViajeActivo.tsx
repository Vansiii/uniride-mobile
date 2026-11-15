import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  consultarMisReservas,
  consultarMisViajes,
  MiViaje,
  Reserva,
  RESERVA_ACTIVA,
} from '@/api/cliente';
import { Boton } from '@/componentes/Boton';
import { TarjetaMiViaje } from '@/componentes/TarjetaMiViaje';
import { useAlEnfocar } from '@/hooks/useAlEnfocar';
import { t } from '@/i18n';
import { colores, espacio, tipografia } from '@/tema/tokens';
import { TarjetaReserva } from './TarjetaReserva';

const MIN = 60_000;

/** El viaje reservado que sale primero y todavía no salió (paso 4 del flujo, DESIGN_SYSTEM §10.2). */
export const proximaReserva = (reservas: Reserva[], ahora = Date.now()) =>
  reservas
    .filter(
      (r) =>
        RESERVA_ACTIVA.includes(r.estado) &&
        // A bordo sigue siendo el viaje activo aunque dure más; si no, una hora de gracia tras la salida.
        (r.estado === 'abordada' ||
          Date.parse(r.viaje.fechaHoraSalida) > ahora - 60 * MIN),
    )
    .sort(
      (a, b) =>
        Date.parse(a.viaje.fechaHoraSalida) -
        Date.parse(b.viaje.fechaHoraSalida),
    )[0];

export type Anclado =
  { reserva: Reserva; viaje?: never } | { viaje: MiViaje; reserva?: never };

/**
 * DESIGN_SYSTEM N7: el viaje que va arriba en Buscar y en Mis viajes. Primero el que está en curso (conductor o a
 * bordo), sin límite de hora; si no, el que sale desde 30 min antes hasta una hora después de la salida.
 */
export function viajeAnclado(
  reservas: Reserva[],
  viajes: MiViaje[],
  ahora = Date.now(),
): Anclado | undefined {
  const viajeEnCurso = viajes.find((v) => v.estado === 'en_curso');
  if (viajeEnCurso) return { viaje: viajeEnCurso };
  const aBordo = reservas.find((r) => r.estado === 'abordada');
  if (aBordo) return { reserva: aBordo };
  const cerca = (salida: string) => {
    const falta = Date.parse(salida) - ahora;
    return falta <= 30 * MIN && falta > -60 * MIN;
  };
  const candidatos: (Anclado & { salida: number })[] = [
    ...reservas
      .filter(
        (r) => r.estado === 'confirmada' && cerca(r.viaje.fechaHoraSalida),
      )
      .map((r) => ({
        reserva: r,
        salida: Date.parse(r.viaje.fechaHoraSalida),
      })),
    ...viajes
      .filter((v) => v.estado === 'reservado' && cerca(v.fechaHoraSalida))
      .map((v) => ({ viaje: v, salida: Date.parse(v.fechaHoraSalida) })),
  ];
  const [primero] = candidatos.sort((a, b) => a.salida - b.salida);
  if (!primero) return undefined;
  return primero.viaje
    ? { viaje: primero.viaje }
    : { reserva: primero.reserva };
}

/** Acción del momento del pasajero (HU-22, HU-23): escanear el abordaje o, a bordo, el viaje en curso con la bajada. */
export function AccionDeReserva({
  reserva,
  anchoCompleto,
}: {
  reserva: Pick<Reserva, 'reservaId' | 'estado'>;
  anchoCompleto?: boolean;
}) {
  if (reserva.estado === 'abordada')
    return (
      <Boton
        anchoCompleto={anchoCompleto}
        icono="near_me"
        etiqueta={t('presencia.trayecto.ver_viaje')}
        alPresionar={() =>
          router.push(`/viaje-activo/${reserva.reservaId}?rol=pasajero`)
        }
      />
    );
  if (reserva.estado === 'confirmada')
    return (
      <Boton
        anchoCompleto={anchoCompleto}
        icono="qr_code_scanner"
        etiqueta={t('presencia.abordaje.boton_escanear')}
        alPresionar={() =>
          router.push(`/abordaje/escanear/${reserva.reservaId}`)
        }
      />
    );
  return null;
}

/** El viaje anclado con su título y su acción; lo usan Buscar y Mis viajes. */
export function TarjetaAnclada({ anclado }: { anclado: Anclado }) {
  const enCurso =
    anclado.viaje?.estado === 'en_curso' ||
    anclado.reserva?.estado === 'abordada';
  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.titulo} accessibilityRole="header">
        {t(
          enCurso
            ? 'reservas.mis_viajes.activo_en_curso'
            : 'reservas.mis_viajes.activo_titulo',
        )}
      </Text>
      {anclado.viaje ? (
        <TarjetaMiViaje viaje={anclado.viaje} />
      ) : (
        <>
          <TarjetaReserva
            reserva={anclado.reserva}
            alPresionar={() =>
              router.push(`/reserva/${anclado.reserva.reservaId}`)
            }
          />
          <AccionDeReserva reserva={anclado.reserva} />
        </>
      )}
    </View>
  );
}

/**
 * Tarjeta del viaje activo en Buscar (N7). Sin viaje del momento, la próxima reserva sin acción (HU-19). Si no se
 * puede leer, no ocupa lugar: es un atajo y Mis viajes dice por qué.
 */
export function ViajeActivo() {
  const [anclado, setAnclado] = useState<Anclado>();
  const [proxima, setProxima] = useState<Reserva>();
  useAlEnfocar(
    useCallback(() => {
      Promise.all([
        consultarMisReservas(),
        // Sin viajes que ofrezca, Buscar sigue mostrando la reserva.
        consultarMisViajes().catch(() => [] as MiViaje[]),
      ])
        .then(([reservas, viajes]) => {
          setAnclado(viajeAnclado(reservas, viajes));
          setProxima(proximaReserva(reservas));
        })
        .catch(() => {
          setAnclado(undefined);
          setProxima(undefined);
        });
    }, []),
  );
  if (anclado)
    return (
      <View style={estilos.margen}>
        <TarjetaAnclada anclado={anclado} />
      </View>
    );
  if (!proxima) return null;
  return (
    <View style={[estilos.contenedor, estilos.margen]}>
      <Text style={estilos.titulo} accessibilityRole="header">
        {t('reservas.mis_viajes.activo_titulo')}
      </Text>
      <TarjetaReserva
        reserva={proxima}
        alPresionar={() => router.push(`/reserva/${proxima.reservaId}`)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio(2) },
  margen: {
    marginTop: espacio(4),
    marginHorizontal: espacio(4),
    // El formulario sube espacio(6) para montarse en la banda: con la tarjeta en medio, eso se compensa aquí.
    marginBottom: espacio(10),
  },
  titulo: { ...tipografia.titulo, color: colores.texto },
});

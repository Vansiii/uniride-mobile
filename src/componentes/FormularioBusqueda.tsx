import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { consultarSaldo, Saldo } from '@/api/cliente';
import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { Icono } from '@/componentes/Icono';
import { Aviso } from '@/componentes/Mensajes';
import { SelectorFecha } from '@/componentes/SelectorFecha';
import { SelectorLugar } from '@/componentes/SelectorLugar';
import { SelectorMapa } from '@/componentes/SelectorMapa';
import { formatearHoraLocal, formatearMonto } from '@/formato';
import { con, t } from '@/i18n';
import { Lugar } from '@/servicios/geocoding';
import { obtenerUbicacion } from '@/servicios/ubicacion';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';
import {
  escribirHora,
  leerSalida,
  medianoche,
  salidaPorOmision,
} from '@/viajes/salida';

const MEDIA_HORA_MS = 30 * 60_000;
// Donde abre el mapa si todavía no se sabe dónde está la persona.
const CENTRO_POR_OMISION = { lat: -17.783327, lng: -63.182129 };

type AvisoUbicacion = 'sin_permiso' | 'ir_a_ajustes' | 'fallo';

const lugarDe = (nombre: string, lat: number, lng: number): Lugar => ({
  nombre,
  detalle: nombre,
  lat,
  lng,
});

/** Origen y hora ya con valores por defecto (DESIGN_SYSTEM §10.2). No hay destino: la búsqueda no filtra por él (spec §5). */
export function FormularioBusqueda() {
  const [origen, setOrigen] = useState<Lugar | null>(null);
  const [{ fecha, hora }, setSalida] = useState(() =>
    salidaPorOmision(Date.now()),
  );
  const [errorOrigen, setErrorOrigen] = useState<string>();
  const [errorHora, setErrorHora] = useState<string>();
  const [avisoUbicacion, setAvisoUbicacion] = useState<AvisoUbicacion>();
  const [ubicando, setUbicando] = useState(false);
  const [enMapa, setEnMapa] = useState(false);
  const [saldo, setSaldo] = useState<Saldo | null>(null);

  const usarUbicacion = async () => {
    setUbicando(true);
    const ubicacion = await obtenerUbicacion(true);
    setUbicando(false);
    if (ubicacion.tipo === 'ok') {
      setAvisoUbicacion(undefined);
      setErrorOrigen(undefined);
      setOrigen(
        lugarDe(t('viajes.buscar.mi_ubicacion'), ubicacion.lat, ubicacion.lng),
      );
    } else {
      setAvisoUbicacion(
        ubicacion.tipo === 'fallo'
          ? 'fallo'
          : ubicacion.puedePedir
            ? 'sin_permiso'
            : 'ir_a_ajustes',
      );
    }
  };

  // Con permiso ya dado, el origen sale solo, sin pisar lo que ya se haya elegido; sin permiso, el diálogo espera a que la persona toque el botón.
  useEffect(() => {
    void obtenerUbicacion(false).then((ubicacion) => {
      if (ubicacion.tipo === 'ok')
        setOrigen(
          (o) =>
            o ??
            lugarDe(
              t('viajes.buscar.mi_ubicacion'),
              ubicacion.lat,
              ubicacion.lng,
            ),
        );
    });
  }, []);

  // Sin saldo legible (sin identidad verificada o sin billetera) la fila no se muestra.
  useFocusEffect(
    useCallback(() => {
      consultarSaldo()
        .then(setSaldo)
        .catch(() => setSaldo(null));
      // La pestaña sigue montada de un día para otro: una fecha que ya pasó no está entre las opciones.
      setSalida((s) =>
        s.fecha < medianoche(new Date()) ? salidaPorOmision(Date.now()) : s,
      );
    }, []),
  );

  const salida = leerSalida(fecha, hora);

  const buscar = () => {
    setErrorOrigen(origen ? undefined : t('viajes.publicar.lugar_requerido'));
    setErrorHora(salida ? undefined : t('viajes.publicar.hora_invalida'));
    if (!origen || !salida) return;
    router.push({
      pathname: '/viajes/buscar',
      params: {
        origenLat: String(origen.lat),
        origenLng: String(origen.lng),
        horaSalida: salida.toISOString(),
      },
    });
  };

  return (
    <>
      <View style={estilos.tarjeta}>
        <SelectorLugar
          etiqueta={t('viajes.buscar.desde')}
          lugar={origen}
          error={errorOrigen}
          alElegir={(l) => {
            setOrigen(l);
            setErrorOrigen(undefined);
          }}
        />
        <View style={estilos.acciones}>
          <Boton
            variante="texto"
            icono="my_location"
            cargando={ubicando}
            etiqueta={t('viajes.buscar.usar_ubicacion')}
            alPresionar={() => void usarUbicacion()}
          />
          <Boton
            variante="texto"
            icono="map"
            etiqueta={t('viajes.buscar.elegir_mapa')}
            alPresionar={() => setEnMapa(true)}
          />
        </View>
        {avisoUbicacion && (
          <Aviso tono="info">{t(`viajes.buscar.${avisoUbicacion}`)}</Aviso>
        )}
        {avisoUbicacion === 'ir_a_ajustes' && (
          <Boton
            variante="secundario"
            icono="settings"
            etiqueta={t('viajes.buscar.abrir_ajustes')}
            alPresionar={() => void Linking.openSettings()}
          />
        )}
        <SelectorFecha
          enUnaLinea
          fecha={fecha}
          alElegir={(f) => setSalida((s) => ({ ...s, fecha: f }))}
        />
        <Campo
          etiqueta={t('viajes.publicar.hora')}
          ayuda={
            salida
              ? con('viajes.buscar.ventana', {
                  desde: formatearHoraLocal(
                    new Date(salida.getTime() - MEDIA_HORA_MS).toISOString(),
                  ),
                  hasta: formatearHoraLocal(
                    new Date(salida.getTime() + MEDIA_HORA_MS).toISOString(),
                  ),
                })
              : t('viajes.publicar.hora_ayuda')
          }
          keyboardType="number-pad"
          maxLength={5}
          value={hora}
          onChangeText={(v) => {
            setSalida((s) => ({ ...s, hora: escribirHora(v) }));
            setErrorHora(undefined);
          }}
          error={errorHora}
        />
        <Boton
          anchoCompleto
          icono="search"
          etiqueta={t('viajes.buscar.buscar')}
          alPresionar={buscar}
        />
      </View>
      {saldo && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('billetera.pantalla.saldo')}: ${formatearMonto(saldo.saldoDisponible)} ${t('billetera.pantalla.unidad')}`}
          onPress={() => router.push('/billetera')}
          style={({ pressed }) => [
            estilos.saldo,
            pressed && { backgroundColor: colores.primarioSuave },
          ]}
        >
          <Icono nombre="account_balance_wallet" color={colores.primario} />
          <View style={estilos.textosSaldo}>
            <Text style={estilos.secundario}>
              {t('billetera.pantalla.saldo')}
            </Text>
            <Text style={estilos.enfasis}>
              {formatearMonto(saldo.saldoDisponible)}{' '}
              {t('billetera.pantalla.unidad')}
            </Text>
          </View>
          <Icono nombre="chevron_right" color={colores.textoSecundario} />
        </Pressable>
      )}
      {enMapa && (
        <SelectorMapa
          inicial={origen ?? CENTRO_POR_OMISION}
          alCancelar={() => setEnMapa(false)}
          alElegir={({ lat, lng }) => {
            setEnMapa(false);
            setErrorOrigen(undefined);
            setOrigen(lugarDe(t('viajes.buscar.punto_mapa'), lat, lng));
          }}
        />
      )}
    </>
  );
}

const estilos = StyleSheet.create({
  // Tarjeta que se superpone 24 a la banda (elevación 0,5, 4.6).
  tarjeta: {
    marginTop: -espacio(6),
    marginHorizontal: espacio(4),
    padding: espacio(4),
    gap: espacio(3),
    borderRadius: radio.l,
    backgroundColor: colores.superficie,
    elevation: 3,
  },
  // El relleno de los botones de texto sale del borde: así caben los dos en una fila a 360.
  acciones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -espacio(3),
  },
  saldo: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(3),
    marginTop: espacio(3),
    marginHorizontal: espacio(4),
    paddingHorizontal: espacio(4),
    borderRadius: radio.l,
    backgroundColor: colores.superficie,
    elevation: 1,
  },
  textosSaldo: { flex: 1, gap: 2 },
  secundario: { ...tipografia.secundario, color: colores.textoSecundario },
  enfasis: { ...tipografia.cuerpoEnfasis, color: colores.texto },
});

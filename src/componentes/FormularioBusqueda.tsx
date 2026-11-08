import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { consultarSaldo, Saldo } from '@/api/cliente';
import { Entra, Esqueleto, Toque, useConteo } from '@/componentes/Animado';
import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { Icono } from '@/componentes/Icono';
import { Aviso } from '@/componentes/Mensajes';
import { SelectorFecha } from '@/componentes/SelectorFecha';
import { SelectorLugar } from '@/componentes/SelectorLugar';
import { SelectorMapa } from '@/componentes/SelectorMapa';
import { formatearMonto } from '@/formato';
import { con, t } from '@/i18n';
import { Lugar } from '@/servicios/geocoding';
import { obtenerUbicacion } from '@/servicios/ubicacion';
import {
  colores,
  degradadoSaldo,
  espacio,
  radio,
  tipografia,
  sombraElevada,
} from '@/tema/tokens';
import {
  escribirHora,
  leerSalida,
  medianoche,
  salidaPorOmision,
  ventanaDe,
  ventanaPasada,
} from '@/viajes/salida';
// Donde abre el mapa si todavía no se sabe dónde está la persona.
const CENTRO_POR_OMISION = { lat: -17.783327, lng: -63.182129 };

type AvisoUbicacion = 'sin_permiso' | 'ir_a_ajustes' | 'fallo';

/** Saldo en grande: la cifra sube hasta su valor y la tarjeta se hunde al tocarla. */
function TarjetaSaldoMini({ saldo }: { saldo: Saldo }) {
  const valor = useConteo(Number(saldo.saldoDisponible));
  const unidad = t('billetera.pantalla.unidad');
  return (
    <Toque
      accessibilityRole="button"
      accessibilityLabel={`${t('billetera.pantalla.saldo')}: ${formatearMonto(saldo.saldoDisponible)} ${unidad}`}
      onPress={() => router.push('/billetera')}
      style={estilos.saldo}
    >
      <View style={estilos.iconoSaldo}>
        <Icono nombre="account_balance_wallet" color={colores.sobreMarca} />
      </View>
      <View style={estilos.textosSaldo}>
        <Text style={estilos.etiquetaSaldo}>
          {t('billetera.pantalla.saldo')}
        </Text>
        <Text style={estilos.cifraSaldo}>
          {formatearMonto(valor.toFixed(2))}{' '}
          <Text style={estilos.unidadSaldo}>{unidad}</Text>
        </Text>
      </View>
      <Icono nombre="chevron_right" color={colores.sobreMarca} />
    </Toque>
  );
}

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
  const [saldo, setSaldo] = useState<Saldo | null | undefined>(undefined);

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
      // La pestaña sigue montada horas o días: una salida que ya pasó vuelve a la próxima media hora.
      setSalida((s) => {
        const elegida = leerSalida(s.fecha, s.hora);
        return s.fecha < medianoche(new Date()) ||
          (elegida && ventanaPasada(elegida.getTime()))
          ? salidaPorOmision(Date.now())
          : s;
      });
    }, []),
  );

  const salida = leerSalida(fecha, hora);

  const buscar = () => {
    setErrorOrigen(origen ? undefined : t('viajes.publicar.lugar_requerido'));
    const pasada = salida !== null && ventanaPasada(salida.getTime());
    setErrorHora(
      !salida
        ? t('viajes.publicar.hora_invalida')
        : pasada
          ? t('viajes.buscar.hora_pasada')
          : undefined,
    );
    if (!origen || !salida || pasada) return;
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
      <Entra indice={1} style={estilos.tarjeta}>
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
            variante="suave"
            icono="my_location"
            cargando={ubicando}
            etiqueta={t('viajes.buscar.usar_ubicacion')}
            alPresionar={() => void usarUbicacion()}
          />
          <Boton
            variante="suave"
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
              ? con('viajes.buscar.ventana', ventanaDe(salida.getTime()))
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
      </Entra>
      {saldo === undefined && (
        <Esqueleto
          alto={76}
          redondeo={radio.l}
          style={estilos.saldoEsqueleto}
        />
      )}
      {saldo && (
        <Entra indice={2}>
          <TarjetaSaldoMini saldo={saldo} />
        </Entra>
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
    borderRadius: radio.xl,
    borderWidth: 1,
    borderColor: colores.vidrioBorde,
    backgroundColor: colores.superficie,
    ...sombraElevada,
  },
  // El relleno de los botones de texto sale del borde: así caben los dos en una fila a 360.
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio(2) },
  saldo: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(3),
    marginTop: espacio(3),
    marginHorizontal: espacio(4),
    paddingHorizontal: espacio(4),
    borderRadius: radio.l,
    borderWidth: 1,
    backgroundColor: colores.superficie,
    experimental_backgroundImage: degradadoSaldo,
  },
  saldoEsqueleto: { marginTop: espacio(3), marginHorizontal: espacio(4) },
  iconoSaldo: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radio.m,
    backgroundColor: colores.vidrio,
  },
  etiquetaSaldo: {
    ...tipografia.secundario,
    color: colores.sobreMarcaSecundario,
  },
  cifraSaldo: { ...tipografia.subtitulo, color: colores.sobreMarca },
  unidadSaldo: { ...tipografia.etiqueta, color: colores.sobreMarcaSecundario },
  textosSaldo: { flex: 1, gap: 2 },
  secundario: { ...tipografia.secundario, color: colores.textoSecundario },
  enfasis: { ...tipografia.cuerpoEnfasis, color: colores.texto },
});

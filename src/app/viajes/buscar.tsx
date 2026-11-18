import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import { buscarViajes, ErrorApi, ViajeEncontrado } from '@/api/cliente';
import { Entra, Esqueleto } from '@/componentes/Animado';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { BotonVoz } from '@/componentes/BotonVoz';
import { ZonaAccion } from '@/componentes/Estructura';
import { Ilustracion } from '@/componentes/Ilustracion';
import { Aviso, EtiquetaEstado } from '@/componentes/Mensajes';
import { PanelVoz } from '@/componentes/PanelVoz';
import { TarjetaViaje } from '@/componentes/TarjetaViaje';
import { useSesion } from '@/contexto/sesion';
import { formatearDia, formatearHoraLocal } from '@/formato';
import { con, t } from '@/i18n';
import { espacio, tipografia } from '@/tema/tokens';
import { ventanaDe } from '@/viajes/salida';
import { resultadosEnPantalla } from '@/voz/resultados';
import { useVoz } from '@/voz/useVoz';
import { crearEstilos, useColores } from '@/tema/useEstilos';
import { BarraEstado } from '@/componentes/BarraEstado';

type Vista =
  | { tipo: 'cargando' }
  | { tipo: 'lista'; viajes: ViajeEncontrado[] }
  | { tipo: 'sin_membresia' }
  | { tipo: 'falla'; texto: string };

/** Resultados de la búsqueda (HU-18): por hora de salida, a 1 km y ± 30 min. Sin firma: no pide huella (RN-6). */
export default function ResultadosPantalla() {
  const colores = useColores();
  const estilos = useEstilos();
  const { cargando, usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const { origenLat, origenLng, horaSalida, destino, porVoz } =
    useLocalSearchParams<{
      origenLat: string;
      origenLng: string;
      horaSalida: string;
      destino?: string;
      porVoz?: string;
    }>();

  const salida = Date.parse(horaSalida ?? '');
  // Un enlace viejo o editado puede traer la ruta incompleta: sin esto la ventana no se puede dibujar.
  const consultaValida =
    Number.isFinite(salida) &&
    [origenLat, origenLng].every((v) => v && Number.isFinite(Number(v)));
  const [vista, setVista] = useState<Vista>(() =>
    consultaValida
      ? { tipo: 'cargando' }
      : { tipo: 'falla', texto: t('comun.errores.coordenadas_invalidas') },
  );
  const [resumenVoz, setResumenVoz] = useState<string>();
  const voz = useVoz();

  const leer = useCallback(
    () =>
      buscarViajes({ origenLat, origenLng, horaSalida, destino })
        .then((viajes) => {
          setVista({ tipo: 'lista', viajes });
          resultadosEnPantalla.establecer(
            viajes.map((v) => ({
              id: v.id,
              origenNombre: v.origenNombre,
              destinoNombre: v.destinoNombre,
              fechaHoraSalida: v.fechaHoraSalida,
              precioPorAsiento: v.precioPorAsiento,
            })),
          );
          if (porVoz === '1') {
            if (viajes.length === 0) {
              const msg = con('voz.buscar.sin_resultados', {
                destino: destino ?? '',
              });
              setResumenVoz(msg);
              try {
                Speech.stop();
                Speech.speak(msg, { language: 'es-BO' });
              } catch {}
            } else {
              const primero = viajes[0];
              const hora = formatearHoraLocal(primero.fechaHoraSalida);
              const precio = primero.precioPorAsiento.toFixed(2);
              const claveMsg =
                viajes.length === 1
                  ? 'voz.buscar.resultado_uno'
                  : 'voz.buscar.resultados';
              const msg = con(claveMsg, {
                n: viajes.length,
                hora,
                destino: primero.destinoNombre,
                precio,
              });
              setResumenVoz(msg);
              try {
                Speech.stop();
                Speech.speak(msg, { language: 'es-BO' });
              } catch {}
            }
          }
        })
        .catch((error: unknown) => {
          const codigo = error instanceof ErrorApi ? error.codigo : '';
          if (codigo === 'NO_AUTORIZADO')
            return setVista({ tipo: 'sin_membresia' });
          setVista({
            tipo: 'falla',
            texto: t(
              codigo === 'COORDENADAS_INVALIDAS'
                ? 'comun.errores.coordenadas_invalidas'
                : codigo === 'SIN_CONEXION'
                  ? 'comun.errores.sin_conexion'
                  : 'comun.errores.desconocido',
            ),
          });
        }),
    [origenLat, origenLng, horaSalida, destino, porVoz],
  );

  useEffect(() => {
    return () => {
      resultadosEnPantalla.limpiar();
    };
  }, []);

  // Al entrar por un enlace la sesión todavía se está restaurando: sin token la API respondería 401.
  const conSesion = !cargando && Boolean(usuario);
  useEffect(() => {
    if (conSesion && consultaValida) void leer();
  }, [conSesion, consultaValida, leer]);

  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;

  const ventana = consultaValida
    ? con('viajes.buscar.resumen', {
        dia: formatearDia(horaSalida),
        ...ventanaDe(salida),
      })
    : '';
  const activa = usuario.membresias.find(
    (m) => m.organizacionId === usuario.organizacionActiva,
  );

  return (
    <View style={[estilos.raiz, { paddingTop: top }]}>
      <BarraEstado />
      <View style={estilos.encabezado}>
        <BotonIcono
          icono="arrow_back"
          etiqueta={t('comun.acciones.volver')}
          color={colores.texto}
          alPresionar={() => router.back()}
        />
        <Text style={estilos.titulo} accessibilityRole="header">
          {t('viajes.buscar.titulo_resultados')}
        </Text>
        <BotonVoz alPresionar={voz.iniciarEscucha} />
      </View>

      {vista.tipo === 'cargando' && (
        <View
          style={estilos.lista}
          accessibilityLabel={t('comun.estados.cargando')}
        >
          {[0, 1, 2].map((i) => (
            <Esqueleto key={i} alto={190} redondeo={28} />
          ))}
        </View>
      )}

      {vista.tipo === 'sin_membresia' && (
        <View style={estilos.centrado}>
          {activa?.estado === 'pendiente' && (
            <EtiquetaEstado
              dominio="membresia"
              estado="pendiente"
              texto={t('membresias.estado.pendiente')}
            />
          )}
          <Aviso tono="info">{t('viajes.buscar.sin_membresia')}</Aviso>
          <Boton
            variante="secundario"
            etiqueta={t('viajes.publicar.elegir_organizacion')}
            alPresionar={() => router.push('/organizaciones')}
          />
        </View>
      )}

      {vista.tipo === 'falla' && (
        <View style={estilos.centrado}>
          <Aviso tono="peligro">{vista.texto}</Aviso>
          <Boton
            variante="secundario"
            icono="refresh"
            etiqueta={t('comun.acciones.reintentar')}
            alPresionar={() => {
              setVista({ tipo: 'cargando' });
              void leer();
            }}
          />
        </View>
      )}

      {vista.tipo === 'lista' && vista.viajes.length === 0 && (
        <>
          <View style={estilos.centrado}>
            <Ilustracion icono="search" color={colores.primario} />
            <Text style={estilos.tituloVacio} accessibilityRole="header">
              {t('viajes.buscar.sin_resultados')}
            </Text>
            <Text style={estilos.textoVacio}>
              {resumenVoz ??
                con('viajes.buscar.sin_resultados_texto', { ventana })}
            </Text>
          </View>
          <ZonaAccion>
            <Boton
              anchoCompleto
              etiqueta={t('viajes.buscar.cambiar_hora')}
              alPresionar={() => router.back()}
            />
          </ZonaAccion>
        </>
      )}

      {vista.tipo === 'lista' && vista.viajes.length > 0 && (
        <FlatList
          data={vista.viajes}
          keyExtractor={(v) => v.id}
          contentContainerStyle={estilos.lista}
          ListHeaderComponent={
            <View style={estilos.cabeceraLista}>
              {resumenVoz && <Aviso tono="info">{resumenVoz}</Aviso>}
              <Text style={estilos.resumen}>{ventana}</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <Entra indice={Math.min(index, 6)}>
              <TarjetaViaje
                viaje={item}
                alPresionar={() => router.push(`/viajes/${item.id}`)}
              />
            </Entra>
          )}
        />
      )}
      <PanelVoz
        visible={voz.estado !== 'inactivo'}
        estado={voz.estado}
        transcripcion={voz.transcripcion}
        mensaje={voz.mensaje}
        fallosSeguidos={voz.fallosSeguidos}
        alCerrar={voz.cerrar}
        alReintentar={voz.reintentar}
        alUsarTeclado={voz.cerrar}
      />
    </View>
  );
}

const useEstilos = crearEstilos((colores) => ({
  raiz: { flex: 1, backgroundColor: colores.fondoSutil },
  encabezado: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: espacio(1),
  },
  titulo: { ...tipografia.titulo, flex: 1, color: colores.texto },
  cabeceraLista: { gap: espacio(2) },
  resumen: { ...tipografia.secundario, color: colores.textoSecundario },
  lista: {
    gap: espacio(3),
    paddingHorizontal: espacio(4),
    paddingBottom: espacio(6),
  },
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio(3),
    padding: espacio(4),
  },
  tituloVacio: {
    ...tipografia.titulo,
    color: colores.texto,
    textAlign: 'center',
  },
  textoVacio: {
    ...tipografia.cuerpo,
    color: colores.textoSecundario,
    textAlign: 'center',
  },
}));

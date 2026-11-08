import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorApi, Membresia } from '@/api/cliente';
import { useSesion } from '@/contexto/sesion';
import { Entra, Toque } from '@/componentes/Animado';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { ZonaAccion } from '@/componentes/Estructura';
import { Icono } from '@/componentes/Icono';
import { Aviso, EtiquetaEstado } from '@/componentes/Mensajes';
import { t } from '@/i18n';
import {
  colores,
  espacio,
  radio,
  sombraTarjeta,
  tamano,
  tipografia,
} from '@/tema/tokens';

interface Mensaje {
  tono: 'exito' | 'aviso' | 'peligro';
  texto: string;
}

/** Activa primero, luego aprobadas, pendientes y rechazadas. */
const orden = { aprobada: 0, pendiente: 1, rechazada: 2 } as const;

const textoDe = (clave: string, organizacion: string) =>
  t(clave).replace('{organizacion}', organizacion);

/** Mensaje al volver de agregar una organización (pantalla Código, propósito `agregar_organizacion`). */
function mensajeDeAgregada(
  agregada?: string,
  organizacion = '',
): Mensaje | null {
  if (agregada === 'aprobada') {
    return {
      tono: 'exito',
      texto: textoDe('membresias.agregar.aprobada', organizacion),
    };
  }
  if (agregada === 'pendiente') {
    return {
      tono: 'aviso',
      texto: textoDe('membresias.agregar.pendiente', organizacion),
    };
  }
  return null;
}

/** Mis organizaciones (HU-07 CA-3 a CA-5): estado de cada membresía, la activa marcada y cambio sin cerrar sesión. */
export default function Organizaciones() {
  const { cargando, usuario, cambiarOrganizacion } = useSesion();
  const { top } = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    agregada?: string;
    organizacion?: string;
  }>();
  const agregada = mensajeDeAgregada(params.agregada, params.organizacion);
  const [mensaje, setMensaje] = useState<Mensaje | null>(agregada);
  const [cambiando, setCambiando] = useState<string | null>(null);

  // La pantalla ya existe en la pila: al volver de agregar solo cambian los parámetros.
  const claveParams = `${params.agregada}|${params.organizacion}`;
  const [claveVista, setClaveVista] = useState(claveParams);
  if (claveVista !== claveParams) {
    setClaveVista(claveParams);
    if (agregada) setMensaje(agregada);
  }

  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;

  const membresias = [...usuario.membresias].sort(
    (a, b) =>
      Number(b.organizacionId === usuario.organizacionActiva) -
        Number(a.organizacionId === usuario.organizacionActiva) ||
      orden[a.estado] - orden[b.estado],
  );

  const elegir = async (m: Membresia) => {
    setMensaje(null);
    setCambiando(m.organizacionId);
    try {
      await cambiarOrganizacion(m.organizacionId);
      setMensaje({
        tono: 'exito',
        texto: textoDe('membresias.activa.cambiada', m.organizacion),
      });
    } catch (error) {
      const codigo = error instanceof ErrorApi ? error.codigo : '';
      setMensaje({
        tono: 'peligro',
        texto:
          codigo === 'MEMBRESIA_NO_APROBADA'
            ? t('membresias.activa.no_aprobada')
            : codigo === 'SIN_CONEXION'
              ? t('comun.errores.sin_conexion')
              : t('comun.errores.desconocido'),
      });
    } finally {
      setCambiando(null);
    }
  };

  return (
    <View style={estilos.raiz}>
      <View style={[estilos.encabezado, { paddingTop: top }]}>
        <BotonIcono
          icono="arrow_back"
          etiqueta={t('comun.acciones.volver')}
          alPresionar={() => router.back()}
        />
        <Text style={estilos.tituloBarra} accessibilityRole="header">
          {t('membresias.lista.titulo')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={estilos.texto}>{t('membresias.lista.explicacion')}</Text>
        {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}
        <View style={estilos.lista}>
          {membresias.map((m, i) => {
            const activa = m.organizacionId === usuario.organizacionActiva;
            const elegible = m.estado === 'aprobada' && !activa;
            const ocupada = cambiando === m.organizacionId;
            return (
              <Entra key={m.organizacionId} indice={i}>
                <Toque
                  escala={0.98}
                  disabled={!elegible || cambiando !== null}
                  onPress={() => elegir(m)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    elegible
                      ? textoDe('membresias.lista.cambiar_a', m.organizacion)
                      : m.organizacion
                  }
                  accessibilityState={{
                    selected: activa,
                    disabled: !elegible,
                    busy: ocupada,
                  }}
                  style={[estilos.fila, activa && estilos.filaActiva]}
                >
                  <View style={estilos.icono}>
                    <Icono
                      nombre="corporate_fare"
                      color={
                        m.estado === 'aprobada'
                          ? colores.primario
                          : colores.textoDeshabilitado
                      }
                    />
                  </View>
                  <View style={estilos.textos}>
                    <Text
                      style={[
                        estilos.nombre,
                        m.estado !== 'aprobada' && estilos.nombreInactivo,
                      ]}
                    >
                      {m.organizacion}
                    </Text>
                    {m.estado !== 'aprobada' && (
                      <Text style={estilos.detalle}>
                        {t('membresias.lista.no_activable')}
                      </Text>
                    )}
                  </View>
                  {activa ? (
                    <EtiquetaEstado
                      dominio="membresia"
                      estado="activa"
                      texto={t('membresias.lista.activa')}
                    />
                  ) : (
                    <EtiquetaEstado
                      dominio="membresia"
                      estado={m.estado}
                      texto={t(`membresias.lista.${m.estado}`)}
                    />
                  )}
                </Toque>
              </Entra>
            );
          })}
        </View>
      </ScrollView>
      <ZonaAccion>
        <Boton
          anchoCompleto
          icono="add"
          etiqueta={t('membresias.lista.agregar')}
          alPresionar={() => router.push('/agregar-organizacion')}
        />
      </ZonaAccion>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondoSutil },
  encabezado: {
    minHeight: 56,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: espacio(1),
    paddingHorizontal: espacio(2),
  },
  tituloBarra: {
    ...tipografia.pantalla,
    width: '100%',
    paddingHorizontal: espacio(2),
    paddingBottom: espacio(2),
    color: colores.texto,
  },
  contenido: {
    flexGrow: 1,
    gap: espacio(4),
    paddingHorizontal: espacio(4),
    paddingVertical: espacio(4),
  },
  texto: { ...tipografia.cuerpo, color: colores.textoSecundario },
  lista: { gap: espacio(3) },
  fila: {
    minHeight: tamano.tactilMinimo + espacio(4),
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(3),
    paddingHorizontal: espacio(4),
    paddingVertical: espacio(3),
    borderRadius: radio.l,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
    ...sombraTarjeta,
  },
  filaActiva: {
    borderColor: colores.primario,
    borderWidth: 2,
    backgroundColor: colores.primarioSuave,
  },
  icono: {
    width: 40,
    height: 40,
    borderRadius: radio.m,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colores.fondoSutil,
  },
  textos: { flex: 1, gap: 2 },
  nombre: { ...tipografia.cuerpoEnfasis, color: colores.texto },
  nombreInactivo: { color: colores.textoSecundario },
  detalle: { ...tipografia.secundario, color: colores.textoSecundario },
});

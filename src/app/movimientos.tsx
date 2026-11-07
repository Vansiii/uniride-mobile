import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  consultarMovimientos,
  consultarSaldo,
  crearBilletera,
  ErrorApi,
  Movimiento,
  PaginaMovimientos,
  TipoMovimiento,
} from '@/api/cliente';
import { Boton, BotonIcono } from '@/componentes/Boton';
import { FilaMovimiento } from '@/componentes/FilaMovimiento';
import { Ilustracion } from '@/componentes/Ilustracion';
import { Aviso } from '@/componentes/Mensajes';
import { useSesion } from '@/contexto/sesion';
import { claveDia, formatearDia, formatearMonto } from '@/formato';
import { t } from '@/i18n';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';

type Filtro = 'todos' | 'recargas' | 'pagos' | 'reembolsos';

/** Chips del prototipo m-movimientos: cada uno pide al servidor uno o varios tipos. */
const FILTROS: Record<Filtro, TipoMovimiento[]> = {
  todos: [],
  recargas: ['recarga'],
  pagos: ['bloqueo_reserva', 'liberacion_viaje'],
  reembolsos: ['reembolso_reserva'],
};

type Falla = (
  { tipo: 'identidad' } | { tipo: 'error'; texto: string; reintentar: boolean }
) & {
  /** Página que falló: el reintento pide esa misma. */
  pagina: number;
};

type Resultado = { id: number; numero: number } & (
  { pagina: PaginaMovimientos } | { falla: Falla }
);

type Fila =
  | { clave: string; dia: string }
  | {
      clave: string;
      movimiento: Movimiento;
      primero: boolean;
      ultimo: boolean;
    };

/** Traduce el error a lo que ve la persona; nunca muestra códigos técnicos (DESIGN_SYSTEM §13.4). */
function fallaDe(error: unknown, pagina: number): Falla {
  const texto = (clave: string, reintentar = true): Falla => ({
    tipo: 'error',
    texto: t(clave),
    reintentar,
    pagina,
  });
  if (!(error instanceof ErrorApi)) return texto('comun.errores.desconocido');
  switch (error.codigo) {
    // CA-6: sin identidad verificada no hay billetera.
    case 'IDENTIDAD_NO_VERIFICADA':
      return { tipo: 'identidad', pagina };
    case 'CUENTA_SUSPENDIDA':
      return texto('billetera.pantalla.cuenta_suspendida', false);
    case 'SIN_CONEXION':
      return texto('comun.errores.sin_conexion');
    default:
      return texto('billetera.historial.error');
  }
}

/** Movimientos (HU-14 CA-2, CA-3, CA-5): del más reciente al más antiguo, por día, con filtros, pull-to-refresh y scroll infinito. */
export default function MovimientosPantalla() {
  const { usuario } = useSesion();
  // Otra persona nunca ve lo que quedó en memoria de la anterior: se monta de cero.
  return <Contenido key={usuario?.id} />;
}

function Contenido() {
  const { cargando, usuario } = useSesion();
  const { top } = useSafeAreaInsets();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [items, setItems] = useState<Movimiento[]>([]);
  const [pagina, setPagina] = useState({ actual: 0, total: 0 });
  // 'cargando' = primera página (con la lista vacía o refrescando); 'mas' = página siguiente.
  const [fase, setFase] = useState<'cargando' | 'listo' | 'mas'>('cargando');
  const [falla, setFalla] = useState<Falla | null>(null);
  // Último saldo contable cuando el nodo no responde (spec §4); null si está en línea o no se pudo leer.
  const [saldoSinSincronizar, setSaldoSinSincronizar] = useState<string | null>(
    null,
  );
  // Solo cuenta la respuesta de la última petición: un filtro nuevo descarta las anteriores.
  const peticion = useRef(0);
  const yaCreo = useRef(false);
  // Hay una petición vigente: dos avisos de "fin de lista" seguidos no piden la misma página dos veces.
  const ocupado = useRef(false);

  // Lo que se ve mientras llega una página; lo llaman los gestos, no el efecto de entrada (que parte de este estado).
  const preparar = (numero: number) => {
    setFalla(null);
    setFase(numero === 1 ? 'cargando' : 'mas');
  };
  // Pide una página (con el reintento de creación de HU-12 si la billetera no existe) y devuelve qué pasó.
  const pedir = useCallback(
    async (f: Filtro, numero: number): Promise<Resultado> => {
      const id = ++peticion.current;
      ocupado.current = true;
      const leer = () => consultarMovimientos(numero, FILTROS[f]);
      try {
        try {
          return { id, numero, pagina: await leer() };
        } catch (error) {
          // Verificada pero sin billetera (404): el reintento de la creación, una sola vez.
          if (
            !(error instanceof ErrorApi) ||
            error.codigo !== 'BILLETERA_NO_ENCONTRADA' ||
            yaCreo.current
          )
            throw error;
          yaCreo.current = true;
          await crearBilletera();
          return { id, numero, pagina: await leer() };
        }
      } catch (error) {
        return { id, numero, falla: fallaDe(error, numero) };
      }
    },
    [],
  );
  const aplicar = useCallback((res: Resultado) => {
    if (res.id !== peticion.current) return;
    ocupado.current = false;
    if ('falla' in res) setFalla(res.falla);
    else {
      const { pagina: r } = res;
      // Si entró un movimiento nuevo entre páginas, las filas se corren: no se repite ninguna.
      setItems((previos) => {
        if (res.numero === 1) return r.items;
        const vistos = new Set(previos.map((m) => m.id));
        return [...previos, ...r.items.filter((m) => !vistos.has(m.id))];
      });
      setPagina({ actual: r.pagina, total: r.paginas });
    }
    setFase('listo');
  }, []);
  const cargar = useCallback(
    (f: Filtro, numero: number) => void pedir(f, numero).then(aplicar),
    [pedir, aplicar],
  );

  const personaId = usuario?.id;
  useEffect(() => {
    if (cargando || !personaId) return;
    cargar(filtro, 1);
  }, [cargando, personaId, filtro, cargar]);

  // Saldo solo para avisar si la red de prueba no responde; sin firma, así que no pide huella.
  const leerSaldo = useCallback(() => {
    consultarSaldo()
      .then((s) =>
        setSaldoSinSincronizar(
          s.enLinea ? null : formatearMonto(s.saldoDisponible),
        ),
      )
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!cargando && personaId) leerSaldo();
  }, [cargando, personaId, leerSaldo]);

  const filas = useMemo(() => {
    const salida: Fila[] = [];
    items.forEach((m, i) => {
      const dia = claveDia(m.creadoEn);
      const primero = i === 0 || claveDia(items[i - 1].creadoEn) !== dia;
      const ultimo =
        i === items.length - 1 || claveDia(items[i + 1].creadoEn) !== dia;
      if (primero)
        salida.push({ clave: `dia-${dia}`, dia: formatearDia(m.creadoEn) });
      salida.push({ clave: m.id, movimiento: m, primero, ultimo });
    });
    return salida;
  }, [items]);

  if (cargando) return null;
  if (!usuario) return <Redirect href="/iniciar-sesion" />;

  const hayMas = pagina.actual > 0 && pagina.actual < pagina.total;
  const cargarMas = () => {
    if (!ocupado.current && fase === 'listo' && !falla && hayMas) {
      preparar(pagina.actual + 1);
      cargar(filtro, pagina.actual + 1);
    }
  };
  // Otro filtro empieza de cero: la lista anterior no se queda mientras llega la nueva.
  const elegirFiltro = (f: Filtro) => {
    if (f === filtro) return;
    setItems([]);
    setPagina({ actual: 0, total: 0 });
    preparar(1);
    setFiltro(f);
  };
  const refrescar = () => {
    preparar(1);
    cargar(filtro, 1);
    leerSaldo();
  };
  // Sin nada que mostrar: la falla de la primera página ocupa la pantalla; en otra, se conserva lo ya cargado.
  const sinLista = items.length === 0;

  const encabezado = (
    <View style={estilos.encabezadoLista}>
      <View
        style={estilos.filtros}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('billetera.historial.filtros')}
      >
        {(Object.keys(FILTROS) as Filtro[]).map((f) => (
          <Pressable
            key={f}
            accessibilityRole="radio"
            accessibilityLabel={t(`billetera.historial.filtro.${f}`)}
            accessibilityState={{ selected: filtro === f }}
            hitSlop={8}
            onPress={() => elegirFiltro(f)}
            style={[estilos.chip, filtro === f && estilos.chipActivo]}
          >
            <Text
              style={[
                estilos.textoChip,
                filtro === f && estilos.textoChipActivo,
              ]}
            >
              {t(`billetera.historial.filtro.${f}`)}
            </Text>
          </Pressable>
        ))}
      </View>
      {saldoSinSincronizar && (
        <Aviso tono="aviso">
          {t('billetera.saldo.sincronizacion_pendiente').replace(
            '{monto}',
            saldoSinSincronizar,
          )}
        </Aviso>
      )}
    </View>
  );

  const vacio = falla ? null : fase === 'cargando' ? (
    <View style={estilos.centro}>
      <ActivityIndicator
        color={colores.primario}
        size="large"
        accessibilityLabel={t('comun.estados.cargando')}
      />
      <Text style={estilos.secundario}>{t('comun.estados.cargando')}</Text>
    </View>
  ) : (
    <View style={estilos.centro}>
      <Ilustracion icono="receipt_long" color={colores.primario} />
      <Text style={estilos.tituloVacio} accessibilityRole="header">
        {filtro === 'todos'
          ? t('billetera.historial.vacio')
          : t('billetera.historial.vacio_filtro')}
      </Text>
      {filtro === 'todos' && (
        <Text style={estilos.textoVacio}>
          {t('billetera.historial.vacio_detalle')}
        </Text>
      )}
    </View>
  );

  return (
    <View style={estilos.raiz}>
      <View style={[estilos.barra, { paddingTop: top }]}>
        <BotonIcono
          icono="arrow_back"
          etiqueta={t('comun.acciones.volver')}
          alPresionar={() => router.back()}
        />
        <Text style={estilos.tituloBarra} accessibilityRole="header">
          {t('billetera.historial.titulo')}
        </Text>
      </View>
      <FlatList
        testID="lista-movimientos"
        data={filas}
        keyExtractor={(fila) => fila.clave}
        renderItem={({ item }) =>
          'dia' in item ? (
            <Text style={estilos.dia} accessibilityRole="header">
              {item.dia}
            </Text>
          ) : (
            <FilaMovimiento
              movimiento={item.movimiento}
              primero={item.primero}
              ultimo={item.ultimo}
            />
          )
        }
        ListHeaderComponent={encabezado}
        ListEmptyComponent={vacio}
        ListFooterComponent={
          <View style={estilos.pie}>
            {fase === 'mas' && (
              <View style={estilos.cargandoMas}>
                <ActivityIndicator color={colores.primario} />
                <Text style={estilos.secundario}>
                  {t('billetera.historial.cargando_mas')}
                </Text>
              </View>
            )}
            {falla?.tipo === 'identidad' && (
              <View style={estilos.bloque}>
                <Aviso tono="info">
                  {t('billetera.creacion.identidad_requerida')}
                </Aviso>
                <Boton
                  icono="verified_user"
                  anchoCompleto
                  etiqueta={t('billetera.pantalla.verificar')}
                  alPresionar={() => router.push('/identidad')}
                />
              </View>
            )}
            {falla?.tipo === 'error' && (
              <View style={estilos.bloque}>
                <Aviso tono="peligro">
                  {sinLista || falla.pagina === 1
                    ? falla.texto
                    : t('billetera.historial.error_pagina')}
                </Aviso>
                {falla.reintentar && (
                  <Boton
                    variante="secundario"
                    icono="refresh"
                    anchoCompleto
                    etiqueta={t('comun.acciones.reintentar')}
                    alPresionar={() => {
                      preparar(falla.pagina);
                      cargar(filtro, falla.pagina);
                    }}
                  />
                )}
              </View>
            )}
          </View>
        }
        refreshing={fase === 'cargando' && !sinLista}
        onRefresh={refrescar}
        onEndReached={cargarMas}
        onEndReachedThreshold={0.5}
        contentContainerStyle={estilos.contenido}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondo },
  barra: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio(1),
    paddingHorizontal: espacio(2),
  },
  tituloBarra: { ...tipografia.titulo, color: colores.texto },
  contenido: {
    flexGrow: 1,
    paddingHorizontal: espacio(4),
    paddingBottom: espacio(6),
  },
  encabezadoLista: { gap: espacio(3), paddingBottom: espacio(2) },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio(2) },
  chip: {
    height: 32,
    paddingHorizontal: espacio(3),
    borderRadius: radio.s,
    borderWidth: 1,
    borderColor: colores.bordeCampo,
    justifyContent: 'center',
  },
  chipActivo: {
    backgroundColor: colores.primarioSuave,
    borderColor: colores.primario,
  },
  textoChip: { ...tipografia.etiqueta, color: colores.texto },
  textoChipActivo: { color: colores.primarioTexto },
  dia: {
    ...tipografia.pequeno,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colores.textoSecundario,
    marginTop: espacio(3),
    marginBottom: espacio(2),
  },
  centro: {
    alignItems: 'center',
    gap: espacio(3),
    paddingVertical: espacio(8),
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
  secundario: { ...tipografia.secundario, color: colores.textoSecundario },
  pie: { gap: espacio(3), paddingTop: espacio(3) },
  cargandoMas: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: espacio(2),
  },
  bloque: { gap: espacio(3) },
});

import { Ref, useEffect, useState } from 'react';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Text,
  TextInput,
  type TextInputInstance,
  TextInputProps,
  View,
} from 'react-native';
import { t } from '@/i18n';
import { espacio, radio, tamano, tipografia } from '@/tema/tokens';
import { BotonIcono } from './Boton';
import { Icono } from './Icono';
import { crearEstilos, useColores } from '@/tema/useEstilos';

interface Props extends TextInputProps {
  /** La etiqueta siempre es visible; nunca se reemplaza por el placeholder. */
  etiqueta: string;
  ayuda?: string;
  error?: string;
  /** Para llevar el foco a este campo cuando el formulario falla (DESIGN_SYSTEM §9.2). */
  refEntrada?: Ref<TextInputInstance>;
}

/** Campo de texto (8.4). Con `secureTextEntry` agrega el botón Mostrar/Ocultar contraseña. */
export function Campo({
  etiqueta,
  ayuda,
  error,
  secureTextEntry,
  onFocus,
  onBlur,
  refEntrada,
  ...resto
}: Props) {
  const colores = useColores();
  const estilos = useEstilos();
  const [foco, setFoco] = useState(false);
  const [ver, setVer] = useState(false);
  // 0 = reposo, 1 = foco: el borde y el fondo cambian con una transición, no de golpe.
  const progreso = useSharedValue(0);
  useEffect(() => {
    progreso.set(withTiming(foco ? 1 : 0, { duration: 180 }));
  }, [foco, progreso]);
  const animada = useAnimatedStyle(() => ({
    // El estilo animado manda sobre el estático: el color de error se decide aquí.
    borderColor: error
      ? colores.peligro
      : interpolateColor(
          progreso.value,
          [0, 1],
          [colores.bordeCampo, colores.primario],
        ),
  }));
  return (
    <View style={estilos.campo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <Animated.View
        style={[
          estilos.caja,
          animada,
          foco || error ? estilos.grueso : null,
          error ? estilos.conError : null,
        ]}
      >
        <TextInput
          ref={refEntrada}
          accessibilityLabel={etiqueta}
          placeholderTextColor={colores.textoPlaceholder}
          // «Siguiente» deja el teclado abierto y pasa al campo que sigue en lugar de cerrarlo.
          submitBehavior={resto.returnKeyType === 'next' ? 'submit' : undefined}
          {...resto}
          secureTextEntry={secureTextEntry && !ver}
          onFocus={(e) => {
            setFoco(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFoco(false);
            onBlur?.(e);
          }}
          style={estilos.entrada}
        />
        {secureTextEntry && (
          <BotonIcono
            icono={ver ? 'visibility_off' : 'visibility'}
            etiqueta={t(
              ver
                ? 'autenticacion.sesion.ocultar_contrasena'
                : 'autenticacion.sesion.mostrar_contrasena',
            )}
            alPresionar={() => setVer(!ver)}
          />
        )}
      </Animated.View>
      {(error || ayuda) && (
        <View style={estilos.fila}>
          {error && (
            <Icono nombre="error" color={colores.peligro} tamano={16} />
          )}
          <Text
            accessibilityRole={error ? 'alert' : undefined}
            style={error ? estilos.error : estilos.ayuda}
          >
            {error ?? ayuda}
          </Text>
        </View>
      )}
    </View>
  );
}

const useEstilos = crearEstilos((colores) => ({
  campo: { gap: espacio(2) },
  etiqueta: { ...tipografia.etiqueta, color: colores.texto },
  // §8.4: borde 1 `bordeCampo` sobre `superficie` (visible también sobre `fondoSutil`); con foco o error,
  // borde 2. El relleno compensa el grosor para que el texto no se mueva.
  caja: {
    minHeight: tamano.altoControl,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radio.m,
    borderWidth: 1,
    padding: 1,
    backgroundColor: colores.superficie,
  },
  grueso: { borderWidth: 2, padding: 0 },
  conError: {
    borderColor: colores.peligro,
    backgroundColor: colores.peligroSuave,
  },
  entrada: {
    flex: 1,
    minHeight: tamano.altoControl - 4,
    paddingHorizontal: espacio(3),
    color: colores.texto,
    ...tipografia.cuerpo,
  },
  fila: { flexDirection: 'row', gap: espacio(1), alignItems: 'flex-start' },
  ayuda: { ...tipografia.secundario, color: colores.textoSecundario, flex: 1 },
  error: { ...tipografia.secundario, color: colores.peligro, flex: 1 },
}));

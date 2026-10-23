import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { t } from '@/i18n';
import { colores, espacio, radio, tamano, tipografia } from '@/tema/tokens';
import { BotonIcono } from './Boton';
import { Icono } from './Icono';

interface Props extends TextInputProps {
  /** La etiqueta siempre es visible; nunca se reemplaza por el placeholder. */
  etiqueta: string;
  ayuda?: string;
  error?: string;
}

/** Campo de texto (8.4). Con `secureTextEntry` agrega el botón Mostrar/Ocultar contraseña. */
export function Campo({
  etiqueta,
  ayuda,
  error,
  secureTextEntry,
  onFocus,
  onBlur,
  ...resto
}: Props) {
  const [foco, setFoco] = useState(false);
  const [ver, setVer] = useState(false);
  return (
    <View style={estilos.campo}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <View
        style={[
          estilos.caja,
          foco && estilos.conFoco,
          error ? estilos.conError : null,
        ]}
      >
        <TextInput
          accessibilityLabel={etiqueta}
          placeholderTextColor={colores.textoPlaceholder}
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
      </View>
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

const estilos = StyleSheet.create({
  campo: { gap: espacio(2) },
  etiqueta: { ...tipografia.etiqueta, color: colores.texto },
  // El borde activo de 2 se compensa con el margen para que el texto no se mueva.
  caja: {
    minHeight: tamano.altoControl,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radio.m,
    borderWidth: 1,
    borderColor: colores.bordeCampo,
    backgroundColor: colores.superficie,
    padding: 1,
  },
  conFoco: { borderWidth: 2, borderColor: colores.primario, padding: 0 },
  conError: { borderWidth: 2, borderColor: colores.peligro, padding: 0 },
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
});

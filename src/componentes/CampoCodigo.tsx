import { StyleSheet, Text, TextInput, View } from 'react-native';
import { t } from '@/i18n';
import { colores, espacio, radio, tipografia } from '@/tema/tokens';
import { Icono } from './Icono';

const LONGITUD = 6;

interface Props {
  valor: string;
  alCambiar: (valor: string) => void;
  /** Se llama una sola vez, al escribir o pegar el sexto dígito. */
  alCompletar: (codigo: string) => void;
  error?: string;
  deshabilitado?: boolean;
}

/**
 * Código de 6 dígitos (8.5). Para lectores de pantalla es un solo campo: un `TextInput` invisible
 * recibe el teclado y el pegado, y seis celdas dibujan lo escrito.
 */
export function CampoCodigo({
  valor,
  alCambiar,
  alCompletar,
  error,
  deshabilitado,
}: Props) {
  const cambiar = (texto: string) => {
    const digitos = texto.replace(/\D/g, '').slice(0, LONGITUD);
    alCambiar(digitos);
    if (digitos.length === LONGITUD && valor.length < LONGITUD) {
      alCompletar(digitos);
    }
  };
  return (
    <View style={estilos.campo}>
      <View style={estilos.celdas}>
        {Array.from({ length: LONGITUD }, (_, i) => (
          <View
            key={i}
            style={[
              estilos.celda,
              i === Math.min(valor.length, LONGITUD - 1) &&
                !deshabilitado &&
                estilos.conFoco,
              error ? estilos.conError : null,
            ]}
          >
            <Text style={estilos.cifra}>{valor[i] ?? ''}</Text>
          </View>
        ))}
        <TextInput
          accessibilityLabel={t('autenticacion.otp.etiqueta')}
          value={valor}
          onChangeText={cambiar}
          editable={!deshabilitado}
          autoFocus
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          maxLength={LONGITUD}
          caretHidden
          style={estilos.entrada}
        />
      </View>
      {error && (
        <View style={estilos.filaError}>
          <Icono nombre="error" color={colores.peligro} tamano={16} />
          <Text accessibilityRole="alert" style={estilos.error}>
            {error}
          </Text>
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { gap: espacio(2) },
  celdas: { flexDirection: 'row', justifyContent: 'center', gap: espacio(2) },
  celda: {
    width: 48,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radio.s,
    borderWidth: 1,
    borderColor: colores.bordeCampo,
    backgroundColor: colores.superficie,
  },
  conFoco: { borderWidth: 2, borderColor: colores.primario },
  conError: { borderWidth: 2, borderColor: colores.peligro },
  cifra: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colores.texto,
  },
  // Cubre las celdas: el toque abre el teclado y el texto no se ve.
  entrada: {
    ...StyleSheet.absoluteFill,
    color: 'transparent',
    backgroundColor: 'transparent',
    // En web el navegador dibujaría un contorno sobre las seis celdas; el foco ya se ve en la celda activa.
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  filaError: {
    flexDirection: 'row',
    gap: espacio(1),
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  error: { ...tipografia.secundario, color: colores.peligro },
});

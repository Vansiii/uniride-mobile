import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icono } from '@/componentes/Icono';
import { t } from '@/i18n';
import { colores, espacio, tamano, tipografia } from '@/tema/tokens';

/**
 * Barra de pestañas (DESIGN_SYSTEM §6.1): ícono y etiqueta siempre. Solo están las pestañas que ya existen; Mis viajes
 * y Perfil se suman con sus historias. Cada pestaña se monta al entrar por primera vez y se
 * queda montada: cambiar de pestaña no la reinicia (en Billetera cada lectura pide la huella). Publicar relee sus requisitos al volver.
 */
export default function Pestanas() {
  const { bottom } = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colores.primario,
        tabBarInactiveTintColor: colores.textoSecundario,
        tabBarLabelStyle: tipografia.pequeno,
        // 64 + área segura, con aire arriba y abajo para que ícono y etiqueta no se peguen al borde.
        tabBarStyle: {
          backgroundColor: colores.fondo,
          height: tamano.altoBarraPestanas + bottom,
          paddingTop: espacio(2),
          paddingBottom: bottom + espacio(2),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('inicio.pestana'),
          tabBarIcon: ({ color }) => (
            <Icono nombre="search" color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="publicar"
        options={{
          title: t('viajes.publicar.pestana'),
          tabBarIcon: ({ color }) => (
            <Icono nombre="add_circle" color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="billetera"
        options={{
          title: t('billetera.pantalla.titulo'),
          tabBarIcon: ({ color }) => (
            <Icono nombre="account_balance_wallet" color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}

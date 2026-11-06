import { Tabs } from 'expo-router';
import { Icono } from '@/componentes/Icono';
import { t } from '@/i18n';
import { colores, tipografia } from '@/tema/tokens';

/**
 * Barra de pestañas (DESIGN_SYSTEM §6.1): ícono y etiqueta siempre. Solo están las pestañas que ya existen; Buscar,
 * Mis viajes, Publicar y Perfil se suman con sus historias. Cada pestaña se monta al entrar por primera vez y se
 * queda montada: cambiar de pestaña no vuelve a cargar nada (en Billetera cada lectura pide la huella).
 */
export default function Pestanas() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colores.primario,
        tabBarInactiveTintColor: colores.textoSecundario,
        tabBarLabelStyle: tipografia.pequeno,
        tabBarStyle: { backgroundColor: colores.fondo },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('inicio.pestana'),
          tabBarIcon: ({ color }) => (
            <Icono nombre="home" color={color as string} />
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

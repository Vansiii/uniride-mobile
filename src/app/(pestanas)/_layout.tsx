import { Tabs } from 'expo-router';
import { BarraPestanas } from '@/componentes/BarraPestanas';
import { Icono } from '@/componentes/Icono';
import { t } from '@/i18n';

/**
 * Barra de pestañas (DESIGN_SYSTEM §6.1): ícono y etiqueta siempre. Solo están las pestañas que ya existen; Mis viajes
 * y Perfil se suman con sus historias. Cada pestaña se monta al entrar por primera vez y se
 * queda montada: cambiar de pestaña no la reinicia (en Billetera cada lectura pide la huella). Publicar relee sus requisitos al volver.
 */
export default function Pestanas() {
  return (
    <Tabs
      tabBar={(props) => <BarraPestanas {...props} />}
      screenOptions={{ headerShown: false, animation: 'fade' }}
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
      <Tabs.Screen
        name="perfil"
        options={{
          title: t('perfil.pestana'),
          tabBarIcon: ({ color }) => (
            <Icono nombre="person" color={color as string} />
          ),
        }}
      />
    </Tabs>
  );
}

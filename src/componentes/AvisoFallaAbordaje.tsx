import { router } from 'expo-router';
import { Linking } from 'react-native';
import { Boton } from '@/componentes/Boton';
import { BotonRevincular } from '@/componentes/BotonRevincular';
import { Aviso } from '@/componentes/Mensajes';
import { t } from '@/i18n';
import type { FallaAbordaje } from '@/viajes/abordaje';

/** El aviso de una falla del abordaje y su salida: revincular, vincular el teléfono o abrir los ajustes. */
export function AvisoFallaAbordaje({ falla }: { falla: FallaAbordaje }) {
  return (
    <>
      <Aviso tono={falla.tono}>{falla.texto}</Aviso>
      {falla.revincular && <BotonRevincular motivo={falla.revincular} />}
      {falla.vincular && (
        <Boton
          variante="secundario"
          icono="smartphone"
          etiqueta={t('billetera.pantalla.vincular')}
          alPresionar={() => router.push('/dispositivo')}
        />
      )}
      {falla.ajustes && (
        <Boton
          variante="secundario"
          icono="settings"
          etiqueta={t('presencia.abordaje.abrir_ajustes')}
          alPresionar={() => void Linking.openSettings()}
        />
      )}
    </>
  );
}

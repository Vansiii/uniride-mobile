import { Linking } from 'react-native';

/** La URL la arma el servidor; aun así solo se abre https. */
export function abrirHttps(url: string) {
  if (url.startsWith('https://')) Linking.openURL(url).catch(() => undefined);
}

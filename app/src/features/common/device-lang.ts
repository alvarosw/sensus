// Idioma do aparelho (código ISO 639-1, ex.: "pt"), usado para escolher os rótulos do mapa.
import { getLocales } from 'expo-localization';

/** Código do idioma principal do aparelho; "en" se não puder ler (o OpenFreeMap sempre traz `name` como reserva). */
export function deviceLanguage(): string {
  try {
    return getLocales()[0]?.languageCode?.toLowerCase() || 'en';
  } catch {
    return 'en';
  }
}

/** Idioma do aparelho, lido uma vez por execução do app (trocar o idioma do sistema pede reiniciar o app). */
export const DEVICE_LANG: string = deviceLanguage();

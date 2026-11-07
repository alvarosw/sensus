// Idioma usado para recomendar Bíblias: o idioma do app (app/src/i18n).
import { currentLang } from '@/i18n/lang-store';

export function bibleUiLang(): string {
  return currentLang();
}

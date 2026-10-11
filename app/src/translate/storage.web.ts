// Web: sem expo-file-system. Mesma API de storage.ts, em localStorage (a tradução não roda na web).
import type { StoredTranslatePrefs } from './storage';

export type { StoredTranslatePrefs } from './storage';

const KEY = 'sensus.translate.prefs';

export async function readTranslatePrefs(): Promise<StoredTranslatePrefs | null> {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as StoredTranslatePrefs) : null;
  } catch {
    return null;
  }
}

export function writeTranslatePrefs(prefs: StoredTranslatePrefs): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // armazenamento indisponível: vale até fechar o app
  }
}

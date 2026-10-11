// Web: sem expo-file-system nem Keychain. Configuração e chave ficam no localStorage do navegador
// (a chave NÃO é protegida: use só chaves de teste na web). Mesma API de provider-store.ts.
import type { StoredProviderSettings } from './provider-store';

export type { StoredProviderSettings } from './provider-store';

const SETTINGS_KEY = 'sensus.provider.settings';
const API_KEY_ITEM = 'sensus.provider.apiKey';
const PREFS_KEY = 'sensus.provider.prefs';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export async function readStoredSettings(): Promise<StoredProviderSettings | null> {
  try {
    const raw = storage()?.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as StoredProviderSettings).presetId === 'string' &&
      typeof (parsed as StoredProviderSettings).baseUrl === 'string' &&
      typeof (parsed as StoredProviderSettings).model === 'string'
    ) {
      return parsed as StoredProviderSettings;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeStoredSettings(settings: StoredProviderSettings): void {
  storage()?.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function readApiKey(): Promise<string | null> {
  try {
    return storage()?.getItem(API_KEY_ITEM) ?? null;
  } catch {
    return null;
  }
}

export async function writeApiKey(apiKey: string): Promise<void> {
  storage()?.setItem(API_KEY_ITEM, apiKey);
}

export async function deleteApiKey(): Promise<void> {
  storage()?.removeItem(API_KEY_ITEM);
}

/** Preferências não secretas (ver provider-store.ts). */
export interface StoredProviderPrefs {
  mode: string;
  pause: { until: number; known: boolean } | null;
}

export async function readProviderPrefs(): Promise<StoredProviderPrefs | null> {
  try {
    const raw = storage()?.getItem(PREFS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as StoredProviderPrefs) : null;
  } catch {
    return null;
  }
}

export function writeProviderPrefs(prefs: StoredProviderPrefs): void {
  storage()?.setItem(PREFS_KEY, JSON.stringify(prefs));
}

/** Preferências de leitura e aparência (ver provider-store.ts). */
export interface StoredAppPrefs {
  theme?: unknown;
  textSource?: unknown;
  greekDefault?: unknown;
}

const APP_PREFS_KEY = 'sensus.app.prefs';

export async function readAppPrefs(): Promise<StoredAppPrefs | null> {
  try {
    const raw = storage()?.getItem(APP_PREFS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as StoredAppPrefs) : null;
  } catch {
    return null;
  }
}

export function writeAppPrefs(prefs: StoredAppPrefs): void {
  storage()?.setItem(APP_PREFS_KEY, JSON.stringify(prefs));
}

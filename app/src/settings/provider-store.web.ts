// Web: sem expo-file-system nem Keychain. Configuração e chave ficam no localStorage do navegador
// (a chave NÃO é protegida: use só chaves de teste na web). Mesma API de provider-store.ts.
import type { StoredProviderSettings } from './provider-store';

export type { StoredProviderSettings } from './provider-store';

const SETTINGS_KEY = 'sensus.provider.settings';
const API_KEY_ITEM = 'sensus.provider.apiKey';

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

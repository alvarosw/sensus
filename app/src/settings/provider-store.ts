// Persistência do provedor de IA.
// - Configuração não secreta (preset, URL base, modelo): arquivo JSON no diretório de documentos.
// - Chave de API: expo-secure-store (Keychain / Keystore). Nunca vai para o arquivo.
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

export interface StoredProviderSettings {
  presetId: string;
  baseUrl: string;
  model: string;
  /**
   * Corpo extra das requisições escolhido com o modelo (modelo recomendado, ex.: raciocínio desligado).
   * Quando existe, substitui o do preset; ausente = o do preset (ver resolve.ts, formConfig).
   */
  extraBody?: Record<string, unknown>;
}

const FILE_NAME = 'provider-settings.json';
const PREFS_FILE_NAME = 'provider-prefs.json';
const API_KEY_ITEM = 'sensus.provider.apiKey';

function settingsFile(): File {
  return new File(Paths.document, FILE_NAME);
}

export async function readStoredSettings(): Promise<StoredProviderSettings | null> {
  try {
    const file = settingsFile();
    if (!file.exists) return null;
    const parsed: unknown = JSON.parse(await file.text());
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
  const file = settingsFile();
  if (!file.exists) file.create();
  file.write(JSON.stringify(settings));
}

export async function readApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(API_KEY_ITEM);
  } catch {
    return null;
  }
}

export async function writeApiKey(apiKey: string): Promise<void> {
  await SecureStore.setItemAsync(API_KEY_ITEM, apiKey);
}

export async function deleteApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(API_KEY_ITEM);
}

/** Preferências não secretas: modo de escolha e pausa do ChatGPT (arquivo JSON, sem chave). */
export interface StoredProviderPrefs {
  mode: string;
  pause: { until: number; known: boolean } | null;
}

function prefsFile(): File {
  return new File(Paths.document, PREFS_FILE_NAME);
}

export async function readProviderPrefs(): Promise<StoredProviderPrefs | null> {
  try {
    const file = prefsFile();
    if (!file.exists) return null;
    const parsed: unknown = JSON.parse(await file.text());
    return parsed && typeof parsed === 'object' ? (parsed as StoredProviderPrefs) : null;
  } catch {
    return null;
  }
}

export function writeProviderPrefs(prefs: StoredProviderPrefs): void {
  const file = prefsFile();
  if (!file.exists) file.create();
  file.write(JSON.stringify(prefs));
}

/** Preferências de leitura e aparência (não secretas): arquivo JSON no diretório de documentos. */
export interface StoredAppPrefs {
  theme?: unknown;
  textSource?: unknown;
  greekDefault?: unknown;
  /** Favoritos da linha do tempo: cite_ids de linhas e de eventos (listas de texto). */
  timelineLines?: unknown;
  timelineEvents?: unknown;
}

const APP_PREFS_FILE_NAME = 'app-prefs.json';

function appPrefsFile(): File {
  return new File(Paths.document, APP_PREFS_FILE_NAME);
}

export async function readAppPrefs(): Promise<StoredAppPrefs | null> {
  try {
    const file = appPrefsFile();
    if (!file.exists) return null;
    const parsed: unknown = JSON.parse(await file.text());
    return parsed && typeof parsed === 'object' ? (parsed as StoredAppPrefs) : null;
  } catch {
    return null;
  }
}

export function writeAppPrefs(prefs: StoredAppPrefs): void {
  const file = appPrefsFile();
  if (!file.exists) file.create();
  file.write(JSON.stringify(prefs));
}

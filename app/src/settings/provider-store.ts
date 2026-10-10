// Persistência do provedor de IA.
// - Configuração não secreta (preset, URL base, modelo): arquivo JSON no diretório de documentos.
// - Chave de API: expo-secure-store (Keychain / Keystore). Nunca vai para o arquivo.
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

export interface StoredProviderSettings {
  presetId: string;
  baseUrl: string;
  model: string;
}

const FILE_NAME = 'provider-settings.json';
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

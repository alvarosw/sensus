import Constants from 'expo-constants';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ProviderConfig } from '@sensus/core';
import {
  deleteApiKey,
  readApiKey,
  readStoredSettings,
  writeApiKey,
  writeStoredSettings,
  type StoredProviderSettings,
} from './provider-store';
import { resolveProvider, type DevProvider } from './resolve';

export interface SettingsValue {
  loaded: boolean;
  stored: StoredProviderSettings | null;
  savedApiKey: string | null;
  devProvider: DevProvider | null;
  /** Provedor pronto para uso pela IA, ou null se não houver chave. */
  provider: ProviderConfig | null;
  save: (settings: StoredProviderSettings, newApiKey?: string) => Promise<void>;
  removeApiKey: () => Promise<void>;
}

const SettingsContext = createContext<SettingsValue | null>(null);

function readDevProvider(): DevProvider | null {
  const extra = Constants.expoConfig?.extra as { devProvider?: unknown } | undefined;
  const dev = extra?.devProvider as Partial<DevProvider> | undefined;
  if (!dev || typeof dev.apiKey !== 'string' || !dev.apiKey) return null;
  return {
    apiKey: dev.apiKey,
    baseUrl: typeof dev.baseUrl === 'string' ? dev.baseUrl : '',
    model: typeof dev.model === 'string' ? dev.model : '',
  };
}

const devProvider = readDevProvider();

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [stored, setStored] = useState<StoredProviderSettings | null>(null);
  const [savedApiKey, setSavedApiKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([readStoredSettings(), readApiKey()]).then(([settings, key]) => {
      if (!alive) return;
      setStored(settings);
      setSavedApiKey(key);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const save = useCallback(async (settings: StoredProviderSettings, newApiKey?: string) => {
    writeStoredSettings(settings);
    if (newApiKey) await writeApiKey(newApiKey);
    setStored(settings);
    if (newApiKey) setSavedApiKey(newApiKey);
  }, []);

  const removeApiKey = useCallback(async () => {
    await deleteApiKey();
    setSavedApiKey(null);
  }, []);

  const value = useMemo<SettingsValue>(
    () => ({
      loaded,
      stored,
      savedApiKey,
      devProvider,
      provider: resolveProvider(stored, savedApiKey, devProvider),
      save,
      removeApiKey,
    }),
    [loaded, stored, savedApiKey, save, removeApiKey],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings fora de SettingsProvider');
  return value;
}

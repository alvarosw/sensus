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
import { DEMO_POLICY } from './demo';
import {
  isPlanActive,
  readChatGPTAccount,
  signInWithChatGPT,
  signOutChatGPT,
  subscribeChatGPT,
  retryChatGPTPlan,
} from '@/auth/chatgpt/service';
import { isChatGPTNativeAvailable } from '@/auth/chatgpt/loopback';
import type { ChatGPTAccountView } from '@/auth/chatgpt/accounts';

export interface ChatGPTState {
  /** Módulo nativo presente (build de desenvolvimento). No Expo Go, false. */
  available: boolean;
  account: ChatGPTAccountView | null;
  /** Plano pronto para uso (sessão, escopo concedido, sem recusa de elegibilidade). */
  planActive: boolean;
  signIn: (opts?: { reconsent?: boolean }) => Promise<void>;
  signOut: () => Promise<{ revoked: boolean }>;
  retryPlan: () => Promise<void>;
  reload: () => Promise<void>;
}

export interface SettingsValue {
  loaded: boolean;
  stored: StoredProviderSettings | null;
  savedApiKey: string | null;
  devProvider: DevProvider | null;
  /** Provedor pronto para uso pela IA, ou null se não houver chave. */
  provider: ProviderConfig | null;
  save: (settings: StoredProviderSettings, newApiKey?: string) => Promise<void>;
  removeApiKey: () => Promise<void>;
  chatgpt: ChatGPTState;
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
  const [account, setAccount] = useState<ChatGPTAccountView | null>(null);

  const reloadAccount = useCallback(async () => {
    setAccount(await readChatGPTAccount());
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([readStoredSettings(), readApiKey(), readChatGPTAccount().catch(() => null)]).then(([settings, key, acc]) => {
      if (!alive) return;
      setStored(settings);
      setSavedApiKey(key);
      setAccount(acc);
      setLoaded(true);
    });
    const unsubscribe = subscribeChatGPT(() => {
      void reloadAccount();
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [reloadAccount]);

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

  const chatgpt = useMemo<ChatGPTState>(
    () => ({
      available: isChatGPTNativeAvailable(),
      account,
      planActive: isPlanActive(account),
      signIn: async (opts) => {
        await signInWithChatGPT(opts);
        await reloadAccount();
      },
      signOut: async () => {
        const result = await signOutChatGPT();
        await reloadAccount();
        return result;
      },
      retryPlan: async () => {
        await retryChatGPTPlan();
        await reloadAccount();
      },
      reload: reloadAccount,
    }),
    [account, reloadAccount],
  );

  const value = useMemo<SettingsValue>(
    () => ({
      loaded,
      stored,
      savedApiKey,
      devProvider,
      provider: resolveProvider(stored, savedApiKey, devProvider, DEMO_POLICY, {
        planActive: chatgpt.planActive,
        model: account?.model ?? '',
      }),
      save,
      removeApiKey,
      chatgpt,
    }),
    [loaded, stored, savedApiKey, save, removeApiKey, chatgpt, account],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings fora de SettingsProvider');
  return value;
}

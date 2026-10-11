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
import { usePrefs } from './prefs';
import type { ChatGPTPause, ProviderMode } from './route';
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

/** Atenção da conta: a sessão precisa de novo login, ou a conta não tem o plano. Null se está tudo certo. */
export type ChatGPTAttention = 'reauth' | 'not_eligible' | null;

export interface ChatGPTState {
  /** Módulo nativo presente (build de desenvolvimento). No Expo Go, false. */
  available: boolean;
  account: ChatGPTAccountView | null;
  /** Plano pronto para uso (sessão, escopo concedido, sem recusa de elegibilidade). */
  planActive: boolean;
  /** Motivo de atenção da conta (aviso e cartão), ou null. */
  attention: ChatGPTAttention;
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
  /** Provedor pronto para uso pela IA, ou null se não houver um método disponível agora. */
  provider: ProviderConfig | null;
  /** Modo de escolha (Automático, Só ChatGPT, Só chave de API). */
  mode: ProviderMode;
  setMode: (mode: ProviderMode) => void;
  /** Pausa do ChatGPT vigente (só no modo Automático), ou null. */
  pause: ChatGPTPause | null;
  /** Encerra a pausa do limite: a próxima pergunta volta a tentar o ChatGPT. */
  resumeChatGPT: () => void;
  save: (settings: StoredProviderSettings, newApiKey?: string) => Promise<void>;
  removeApiKey: () => Promise<void>;
  chatgpt: ChatGPTState;
}

const SettingsContext = createContext<SettingsValue | null>(null);

function readDevProvider(): DevProvider | null {
  // Só em desenvolvimento: a chave do .env nunca é usada como reserva em builds de produção.
  if (!__DEV__) return null;
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
  const [now, setNow] = useState(() => Date.now());

  const mode = usePrefs((s) => s.mode);
  const storedPause = usePrefs((s) => s.pause);
  const setMode = usePrefs((s) => s.setMode);
  const clearPause = usePrefs((s) => s.clearPause);
  const prefsLoaded = usePrefs((s) => s.loaded);

  const reloadAccount = useCallback(async () => {
    setAccount(await readChatGPTAccount());
  }, []);

  useEffect(() => {
    let alive = true;
    void usePrefs.getState().load();
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

  // Quando a pausa do ChatGPT termina, a escolha volta a tentar o ChatGPT na próxima pergunta.
  useEffect(() => {
    if (!storedPause || storedPause.until <= Date.now()) return;
    const id = setTimeout(() => setNow(Date.now()), storedPause.until - Date.now() + 50);
    return () => clearTimeout(id);
  }, [storedPause]);

  const pause = storedPause && storedPause.until > now ? storedPause : null;

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

  const attention: ChatGPTAttention =
    account && !account.connected ? null : account?.needsReauth ? 'reauth' : account?.planBlocked ? 'not_eligible' : null;

  const chatgpt = useMemo<ChatGPTState>(
    () => ({
      available: isChatGPTNativeAvailable(),
      account,
      planActive: isPlanActive(account),
      attention,
      signIn: async (opts) => {
        await signInWithChatGPT(opts);
        clearPause();
        await reloadAccount();
      },
      signOut: async () => {
        const result = await signOutChatGPT();
        clearPause();
        await reloadAccount();
        return result;
      },
      retryPlan: async () => {
        await retryChatGPTPlan();
        await reloadAccount();
      },
      reload: reloadAccount,
    }),
    [account, attention, reloadAccount, clearPause],
  );

  const chatgptSession = useMemo(
    () =>
      account
        ? {
            connected: account.connected,
            ready: isPlanActive(account) && !!account.model,
            attention: account.connected && attention !== null,
            model: account.model,
          }
        : null,
    [account, attention],
  );

  const provider = useMemo(
    () =>
      resolveProvider(stored, savedApiKey, devProvider, DEMO_POLICY, chatgptSession, { mode, pause, now }),
    [stored, savedApiKey, chatgptSession, mode, pause, now],
  );

  const value = useMemo<SettingsValue>(
    () => ({
      loaded: loaded && prefsLoaded,
      stored,
      savedApiKey,
      devProvider,
      provider,
      mode,
      setMode,
      pause,
      resumeChatGPT: clearPause,
      save,
      removeApiKey,
      chatgpt,
    }),
    [loaded, prefsLoaded, stored, savedApiKey, provider, mode, setMode, pause, clearPause, save, removeApiKey, chatgpt],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings fora de SettingsProvider');
  return value;
}

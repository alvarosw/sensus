// Preferências de escolha do provedor (modo e pausa do ChatGPT), em memória e persistidas no aparelho.
// Não guarda chaves nem tokens. Falhas de leitura ou escrita viram o padrão, sem quebrar a tela.
import { create } from 'zustand';
import { DEFAULT_PROVIDER_MODE, isProviderMode, type ChatGPTPause, type ProviderMode } from './route';
import { readProviderPrefs, writeProviderPrefs, type StoredProviderPrefs } from './provider-store';

interface PrefsState {
  loaded: boolean;
  mode: ProviderMode;
  /** Pausa do ChatGPT depois de um limite (só no modo Automático). Null quando não há pausa. */
  pause: ChatGPTPause | null;
  load(): Promise<void>;
  setMode(mode: ProviderMode): void;
  pauseChatGPT(pause: ChatGPTPause): void;
  clearPause(): void;
}

function persist(mode: ProviderMode, pause: ChatGPTPause | null): void {
  try {
    const prefs: StoredProviderPrefs = { mode, pause };
    writeProviderPrefs(prefs);
  } catch {
    // sem escrita (armazenamento indisponível): a preferência vale até fechar o app
  }
}

export const usePrefs = create<PrefsState>()((set, get) => ({
  loaded: false,
  mode: DEFAULT_PROVIDER_MODE,
  pause: null,
  load: async () => {
    const stored = await readProviderPrefs().catch(() => null);
    const mode = stored && isProviderMode(stored.mode) ? stored.mode : DEFAULT_PROVIDER_MODE;
    const pause =
      stored?.pause && typeof stored.pause.until === 'number' && typeof stored.pause.known === 'boolean'
        ? { until: stored.pause.until, known: stored.pause.known }
        : null;
    set({ loaded: true, mode, pause });
  },
  setMode: (mode) => {
    set({ mode });
    persist(mode, get().pause);
  },
  pauseChatGPT: (pause) => {
    set({ pause });
    persist(get().mode, pause);
  },
  clearPause: () => {
    if (!get().pause) return;
    set({ pause: null });
    persist(get().mode, null);
  },
}));

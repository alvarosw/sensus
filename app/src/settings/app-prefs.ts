// Preferências de aparência e leitura, persistidas no aparelho (sem segredos).
//  - theme: sistema | claro | escuro (o provider de tema é atualizado pela tela de Aparência);
//  - textSource: texto corrido padrão (BLivre ou KJV). O botão do leitor também grava aqui;
//  - greekDefault: grego (TR) sob os versículos ao abrir o app. O botão Αα só muda a sessão.
// Os valores são aplicados ao estado do leitor (state/study.ts) ao carregar e a cada mudança.
import { create } from 'zustand';
import { useStudy } from '@/state/study';
import type { SchemePreference } from '@/design';
import { readAppPrefs, writeAppPrefs, type StoredAppPrefs } from './provider-store';

export const TEXT_SOURCES = ['blivre', 'kjv'] as const;
export type TextSourceId = (typeof TEXT_SOURCES)[number];

const THEMES: readonly SchemePreference[] = ['system', 'light', 'dark'];

export const DEFAULT_APP_PREFS = {
  theme: 'system' as SchemePreference,
  textSource: 'blivre' as TextSourceId,
  greekDefault: false,
};

interface AppPrefsState {
  loaded: boolean;
  theme: SchemePreference;
  textSource: TextSourceId;
  greekDefault: boolean;
  load(): Promise<void>;
  setTheme(theme: SchemePreference): void;
  /** Grava o texto padrão e aplica ao leitor agora. */
  setTextSource(source: TextSourceId): void;
  /** Grava o grego padrão e aplica ao leitor agora. */
  setGreekDefault(on: boolean): void;
}

function persist(p: { theme: SchemePreference; textSource: TextSourceId; greekDefault: boolean }): void {
  try {
    const stored: StoredAppPrefs = { ...p };
    writeAppPrefs(stored);
  } catch {
    // sem escrita (armazenamento indisponível): vale até fechar o app
  }
}

export const useAppPrefs = create<AppPrefsState>()((set, get) => {
  const current = () => {
    const { theme, textSource, greekDefault } = get();
    return { theme, textSource, greekDefault };
  };
  return {
    loaded: false,
    ...DEFAULT_APP_PREFS,
    load: async () => {
      const stored = await readAppPrefs().catch(() => null);
      const theme = stored && THEMES.includes(stored.theme as SchemePreference) ? (stored.theme as SchemePreference) : DEFAULT_APP_PREFS.theme;
      const textSource =
        stored && TEXT_SOURCES.includes(stored.textSource as TextSourceId) ? (stored.textSource as TextSourceId) : DEFAULT_APP_PREFS.textSource;
      const greekDefault = typeof stored?.greekDefault === 'boolean' ? stored.greekDefault : DEFAULT_APP_PREFS.greekDefault;
      set({ loaded: true, theme, textSource, greekDefault });
      useStudy.setState({ textSource, greek: greekDefault });
    },
    setTheme: (theme) => {
      set({ theme });
      persist({ ...current(), theme });
    },
    setTextSource: (textSource) => {
      set({ textSource });
      persist({ ...current(), textSource });
      useStudy.getState().setTextSource(textSource);
    },
    setGreekDefault: (greekDefault) => {
      set({ greekDefault });
      persist({ ...current(), greekDefault });
      useStudy.setState({ greek: greekDefault });
    },
  };
});

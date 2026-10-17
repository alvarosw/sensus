// Preferências de aparência e leitura, persistidas no aparelho (sem segredos).
//  - theme: sistema | claro | escuro (o provider de tema é atualizado pela tela de Aparência);
//  - textSource: texto corrido padrão (BLivre ou KJV). O botão do leitor também grava aqui;
//  - greekDefault: grego (TR) sob os versículos ao abrir o app. O botão Αα só muda a sessão.
//  - timelineLines / timelineEvents: favoritos da linha do tempo (cite_ids de linhas e de marcadores);
//    timelineCombos: combinações do paralelo criadas pelo usuário (favoritas, sem limite; recentes, as últimas cinco).
//    As prontas do app não são gravadas (ver combos.ts).
// Os valores de aparência são aplicados ao estado do leitor (state/study.ts) ao carregar e a cada mudança.
import { create } from 'zustand';
import { useStudy } from '@/state/study';
import type { SchemePreference } from '@/design';
import { readAppPrefs, writeAppPrefs, type StoredAppPrefs } from './provider-store';
import { favoriteCombo, newComboId, parseCombos, recordRecent, removeCombo, unfavoriteCombo, type UserCombo } from '@/features/timeline/combos';

export const TEXT_SOURCES = ['blivre', 'kjv'] as const;
export type TextSourceId = (typeof TEXT_SOURCES)[number];

const THEMES: readonly SchemePreference[] = ['system', 'light', 'dark'];

/** Limite de favoritos guardados (evita arquivo crescer sem controle). */
const MAX_FAVORITES = 500;

export const DEFAULT_APP_PREFS = {
  theme: 'system' as SchemePreference,
  textSource: 'blivre' as TextSourceId,
  greekDefault: false,
  timelineLines: [] as string[],
  timelineEvents: [] as string[],
  timelineCombos: [] as UserCombo[],
};

interface AppPrefsState {
  loaded: boolean;
  theme: SchemePreference;
  textSource: TextSourceId;
  greekDefault: boolean;
  /** Linhas do tempo favoritas (cite_id da pessoa, lugar ou período). */
  timelineLines: string[];
  /** Marcadores da linha do tempo (cite_id do evento). */
  timelineEvents: string[];
  /** Combinações do paralelo do usuário (ver combos.ts): a mais recente primeiro. */
  timelineCombos: UserCombo[];
  load(): Promise<void>;
  setTheme(theme: SchemePreference): void;
  /** Grava o texto padrão e aplica ao leitor agora. */
  setTextSource(source: TextSourceId): void;
  /** Grava o grego padrão e aplica ao leitor agora. */
  setGreekDefault(on: boolean): void;
  toggleTimelineLine(id: string): void;
  toggleTimelineEvent(citeId: string): void;
  /** Confirmar uma combinação: vira recente (no topo). */
  recordCombo(lines: string[], name: string): void;
  /** Favoritar (ou promover uma recente/pronta) com o nome dado. */
  favoriteCombo(lines: string[], name: string): void;
  unfavoriteCombo(id: string): void;
  removeCombo(id: string): void;
}

interface PersistedPrefs {
  theme: SchemePreference;
  textSource: TextSourceId;
  greekDefault: boolean;
  timelineLines: string[];
  timelineEvents: string[];
  timelineCombos: UserCombo[];
}

function persist(p: PersistedPrefs): void {
  try {
    const stored: StoredAppPrefs = { ...p };
    writeAppPrefs(stored);
  } catch {
    // sem escrita (armazenamento indisponível): vale até fechar o app
  }
}

/** Lista de ids do arquivo: só strings, sem repetição, no limite. Outro formato devolve lista vazia. */
function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === 'string' && v.length > 0))].slice(0, MAX_FAVORITES);
}

/** Liga ou desliga um id numa lista (no começo, para o mais recente aparecer primeiro). */
function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [id, ...list].slice(0, MAX_FAVORITES);
}

export const useAppPrefs = create<AppPrefsState>()((set, get) => {
  const current = (): PersistedPrefs => {
    const { theme, textSource, greekDefault, timelineLines, timelineEvents, timelineCombos } = get();
    return { theme, textSource, greekDefault, timelineLines, timelineEvents, timelineCombos };
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
      const timelineLines = idList(stored?.timelineLines);
      const timelineEvents = idList(stored?.timelineEvents);
      const timelineCombos = parseCombos(stored?.timelineCombos);
      set({ loaded: true, theme, textSource, greekDefault, timelineLines, timelineEvents, timelineCombos });
      useStudy.setState({ textSource, greek: greekDefault });
    },
    toggleTimelineLine: (id) => {
      const timelineLines = toggleId(get().timelineLines, id);
      set({ timelineLines });
      persist({ ...current(), timelineLines });
    },
    toggleTimelineEvent: (citeId) => {
      const timelineEvents = toggleId(get().timelineEvents, citeId);
      set({ timelineEvents });
      persist({ ...current(), timelineEvents });
    },
    recordCombo: (lines, name) => {
      const timelineCombos = recordRecent(get().timelineCombos, lines, name, newComboId());
      set({ timelineCombos });
      persist({ ...current(), timelineCombos });
    },
    favoriteCombo: (lines, name) => {
      const timelineCombos = favoriteCombo(get().timelineCombos, lines, name, newComboId());
      set({ timelineCombos });
      persist({ ...current(), timelineCombos });
    },
    unfavoriteCombo: (id) => {
      const timelineCombos = unfavoriteCombo(get().timelineCombos, id);
      set({ timelineCombos });
      persist({ ...current(), timelineCombos });
    },
    removeCombo: (id) => {
      const timelineCombos = removeCombo(get().timelineCombos, id);
      set({ timelineCombos });
      persist({ ...current(), timelineCombos });
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

// Preferências de aparência e leitura, persistidas no aparelho (sem segredos).
//  - appLang: idioma da interface (um dos 14 de domain/locale.ts). Ausente = pt; sem arquivo = idioma do aparelho;
//  - theme: sistema | claro | escuro (o provider de tema é atualizado pela tela de Aparência);
//  - textSource: Bíblia do texto corrido (BLivre, KJV ou uma baixada e instalada; ver data/bibles). FONTE DA VERDADE. O botão do leitor também grava aqui, e
//    o estado de estudo (`useStudy.textSource`) é só um espelho, escrito apenas por este arquivo (load e setTextSource);
//  - greekDefault: grego (TR) sob os versículos ao abrir o app. O botão Αα só muda a sessão.
//  - timelineLines / timelineEvents: favoritos da linha do tempo (cite_ids de linhas e de marcadores);
//    timelineCombos: combinações do paralelo criadas pelo usuário (favoritas, sem limite; recentes, as últimas cinco).
//    As prontas do app não são gravadas (ver combos.ts).
//  - commentaryPrefs: tradições e fontes de comentário escondidas (domain/source-prefs.ts). Vale no estudo inteiro:
//    é aplicada ao Repo do banco ativo (active-db.ts) ao carregar, a cada mudança e quando o banco troca.
//  - onboardingDone: a apresentação de primeira vez já foi concluída (regra de quem vê em onboarding-pref.ts).
// Os valores de aparência são aplicados ao estado do leitor (state/study.ts) ao carregar e a cada mudança.
import { create } from 'zustand';
import { useStudy } from '@/state/study';
import type { SchemePreference } from '@/design';
import { getLocales } from 'expo-localization';
import { useLangStore } from '@/i18n/lang-store';
import { readAppPrefs, writeAppPrefs, type StoredAppPrefs } from './provider-store';
import { readCachedCatalog } from '@/data/bibles/catalog';
import { installedIds } from '@/data/bibles/bible-db';
import { resolveTextSource } from '@/data/bibles/bible-model';
import { bibleUiLang } from '@/data/bibles/ui-lang';
import { favoriteCombo, newComboId, parseCombos, recordRecent, removeCombo, unfavoriteCombo, type UserCombo } from '@sensus/core';
import { ALL_COMMENTARIES, parseCommentaryPreference, type CommentaryPreference } from '@sensus/core';
import { setActiveCommentaryPreference } from '@/data/active-db';
import { DEFAULT_APP_LANG, appLangFromDevice, isAppLang, type AppLang } from '@sensus/core';
import { shouldShowOnboarding } from './onboarding-pref';

/** Id de uma fonte de texto corrido (ver `textSources()` no núcleo). */
export type TextSourceId = string;

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
  commentaryPrefs: ALL_COMMENTARIES,
  onboardingDone: false,
};

interface AppPrefsState {
  loaded: boolean;
  theme: SchemePreference;
  /** Grava e aplica o idioma da interface agora (a raiz remonta; ver i18n/lang-store.ts). */
  setAppLang(lang: AppLang): void;
  textSource: TextSourceId;
  greekDefault: boolean;
  /** Linhas do tempo favoritas (cite_id da pessoa, lugar ou período). */
  timelineLines: string[];
  /** Marcadores da linha do tempo (cite_id do evento). */
  timelineEvents: string[];
  /** Combinações do paralelo do usuário (ver combos.ts): a mais recente primeiro. */
  timelineCombos: UserCombo[];
  /** Tradições e fontes de comentário que o leitor vê (ver domain/source-prefs.ts). */
  commentaryPrefs: CommentaryPreference;
  load(): Promise<void>;
  setTheme(theme: SchemePreference): void;
  /** Apresentação de primeira vez concluída (ou pulada); ver settings/onboarding-pref.ts. */
  onboardingDone: boolean;
  /** Grava se a apresentação de primeira vez já foi concluída (ou pulada). */
  setOnboardingDone(done: boolean): void;
  /** Grava o texto padrão e aplica ao leitor agora. */
  setTextSource(source: TextSourceId): void;
  /** Depois de remover uma Bíblia: se a padrão saiu, volta para a recomendada instalada do idioma (ou BLivre). */
  syncTextSource(): void;
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
  /** Grava a preferência de comentários e aplica ao banco ativo agora (as consultas em cache são refeitas). */
  setCommentaryPrefs(pref: CommentaryPreference): void;
}

interface PersistedPrefs {
  appLang: AppLang;
  theme: SchemePreference;
  textSource: TextSourceId;
  greekDefault: boolean;
  timelineLines: string[];
  timelineEvents: string[];
  timelineCombos: UserCombo[];
  commentaryPrefs: CommentaryPreference;
  onboardingDone: boolean;
}

function persist(p: PersistedPrefs): void {
  try {
    const stored: StoredAppPrefs = { ...p };
    writeAppPrefs(stored);
  } catch {
    // sem escrita (armazenamento indisponível): vale até fechar o app
  }
}

/** Idiomas do aparelho (tags como "pt-BR"). Falha ao ler devolve lista vazia (então inglês). */
function deviceTags(): string[] {
  try {
    return getLocales().map((l) => l.languageTag);
  } catch {
    return [];
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
    const { theme, textSource, greekDefault, timelineLines, timelineEvents, timelineCombos, commentaryPrefs, onboardingDone } = get();
    return {
      appLang: useLangStore.getState().lang,
      theme, textSource, greekDefault, timelineLines, timelineEvents, timelineCombos, commentaryPrefs, onboardingDone,
    };
  };
  return {
    loaded: false,
    ...DEFAULT_APP_PREFS,
    setAppLang: (lang) => {
      useLangStore.getState().setLang(lang);
      persist(current());
    },
    load: async () => {
      const stored = await readAppPrefs().catch(() => null);
      // Idioma: o gravado, se válido. Preferências já gravadas sem a chave ficam em português (quem já usava o app);
      // primeira execução, o primeiro idioma do aparelho que está na lista (senão inglês).
      const storedLang = stored?.appLang;
      const appLang: AppLang = isAppLang(storedLang) ? storedLang : stored ? DEFAULT_APP_LANG : appLangFromDevice(deviceTags());
      const theme = stored && THEMES.includes(stored.theme as SchemePreference) ? (stored.theme as SchemePreference) : DEFAULT_APP_PREFS.theme;
      const catalog = readCachedCatalog();
      const textSource = resolveTextSource({
        stored: typeof stored?.textSource === 'string' ? stored.textSource : null,
        installed: installedIds(catalog),
        catalog,
        lang: bibleUiLang(),
      });
      const greekDefault = typeof stored?.greekDefault === 'boolean' ? stored.greekDefault : DEFAULT_APP_PREFS.greekDefault;
      const timelineLines = idList(stored?.timelineLines);
      const timelineEvents = idList(stored?.timelineEvents);
      const timelineCombos = parseCombos(stored?.timelineCombos);
      const commentaryPrefs = parseCommentaryPreference(stored?.commentaryPrefs);
      // Apresentação: instalação nova a mostra; quem já usava o app (chave ausente) não vê, e a chave é gravada.
      const storedOnboarding = typeof stored?.onboardingDone === 'boolean' ? stored.onboardingDone : undefined;
      const onboardingDone = !shouldShowOnboarding({ hasStoredPrefs: stored !== null, onboardingDone: storedOnboarding });
      useLangStore.getState().setLang(appLang);
      set({ loaded: true, theme, textSource, greekDefault, timelineLines, timelineEvents, timelineCombos, commentaryPrefs, onboardingDone });
      useStudy.setState({ textSource, greek: greekDefault });
      setActiveCommentaryPreference(commentaryPrefs);
      // Primeira execução ou arquivo antigo: grava já o idioma e a apresentação decididos, para não mudarem sozinhos depois.
      if (!isAppLang(storedLang) || storedOnboarding === undefined) persist(current());
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
    setOnboardingDone: (onboardingDone) => {
      set({ onboardingDone });
      persist({ ...current(), onboardingDone });
    },
    setTheme: (theme) => {
      set({ theme });
      persist({ ...current(), theme });
    },
    setTextSource: (textSource) => {
      // Ordem fixa: grava a preferência (fonte da verdade) e só então espelha no estudo.
      set({ textSource });
      persist({ ...current(), textSource });
      useStudy.getState().setTextSource(textSource);
    },
    syncTextSource: () => {
      const { textSource } = get();
      const catalog = readCachedCatalog();
      const next = resolveTextSource({ stored: textSource, installed: installedIds(catalog), catalog, lang: bibleUiLang() });
      if (next !== textSource) get().setTextSource(next);
    },
    setGreekDefault: (greekDefault) => {
      set({ greekDefault });
      persist({ ...current(), greekDefault });
      useStudy.setState({ greek: greekDefault });
    },
    setCommentaryPrefs: (raw) => {
      const commentaryPrefs = parseCommentaryPreference(raw);
      set({ commentaryPrefs });
      persist({ ...current(), commentaryPrefs });
      setActiveCommentaryPreference(commentaryPrefs);
    },
  };
});

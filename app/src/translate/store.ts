// Estado da tradução automática: ligada/desligada, oferta respondida e situação do modelo no aparelho.
import { create } from 'zustand';
import { clearTranslationCache } from './engine';
import { downloadModel, modelReady, removeModel, translationSupported } from './native';
import { readTranslatePrefs, writeTranslatePrefs } from './storage';
import { claimOfferOwner } from './offer-session';

/** unknown: ainda não verificado; missing: não baixado; downloading; ready: pronto; error: última tentativa falhou. */
export type ModelStatus = 'unknown' | 'missing' | 'downloading' | 'ready' | 'error';

interface TranslateState {
  loaded: boolean;
  /** Aparelho com o módulo nativo (Android ou iOS). Em outros lugares a tradução não aparece. */
  supported: boolean;
  enabled: boolean;
  /** "Ativar" ou "Agora não" já foram escolhidos: a oferta não volta a aparecer. */
  offerAnswered: boolean;
  /**
   * Quem mostra a oferta nesta sessão do app (id do painel que a exibiu primeiro). Depois que ela apareceu uma
   * vez, os outros painéis não a repetem até o app ser fechado (além do "Agora não" persistido).
   */
  offerOwner: number | null;
  claimOffer(id: number): void;
  model: ModelStatus;
  load(): Promise<void>;
  /** Liga (baixa o modelo se faltar) ou desliga (mantém o modelo). */
  setEnabled(on: boolean): Promise<void>;
  /** Resposta à oferta da primeira vez: "Ativar" liga; "Agora não" só registra a escolha. */
  answerOffer(accept: boolean): Promise<void>;
  refreshModel(): Promise<void>;
  /** Apaga o modelo e desliga a tradução (para não baixar de novo sem aviso). */
  removeModel(): Promise<void>;
}

let downloading: Promise<void> | null = null;

export const useTranslate = create<TranslateState>()((set, get) => {
  const persist = () => {
    const { enabled, offerAnswered } = get();
    writeTranslatePrefs({ enabled, offerAnswered });
  };

  const download = (): Promise<void> => {
    if (!downloading) {
      set({ model: 'downloading' });
      downloading = downloadModel()
        .then(() => set({ model: 'ready' }))
        .catch(() => {
          set({ model: 'error' });
          throw new Error('download-failed');
        })
        .finally(() => {
          downloading = null;
        });
    }
    return downloading;
  };

  return {
    loaded: false,
    supported: translationSupported,
    enabled: false,
    offerAnswered: false,
    offerOwner: null,
    claimOffer: (id) => set((s) => ({ offerOwner: claimOfferOwner(s.offerOwner, id) })),
    model: 'unknown',

    load: async () => {
      if (get().loaded) return;
      const stored = await readTranslatePrefs();
      set({
        loaded: true,
        enabled: stored?.enabled === true && translationSupported,
        offerAnswered: stored?.offerAnswered === true,
      });
      if (translationSupported) void get().refreshModel();
    },

    refreshModel: async () => {
      if (!translationSupported || downloading) return;
      try {
        const ready = await modelReady();
        set({ model: ready ? 'ready' : 'missing' });
      } catch {
        set({ model: 'missing' });
      }
    },

    setEnabled: async (on) => {
      set({ offerAnswered: true });
      if (!on) {
        set({ enabled: false });
        persist();
        return;
      }
      if (!translationSupported) return;
      try {
        if (get().model !== 'ready') await download();
        set({ enabled: true });
      } catch {
        // sem modelo não há como traduzir: a opção volta a desligada e a Configuração mostra o erro
        set({ enabled: false });
      }
      persist();
    },

    answerOffer: async (accept) => {
      if (!accept) {
        set({ offerAnswered: true });
        persist();
        return;
      }
      await get().setEnabled(true);
    },

    removeModel: async () => {
      await removeModel();
      clearTranslationCache();
      set({ enabled: false, offerAnswered: true, model: 'missing' });
      persist();
    },
  };
});

/** Carrega preferências uma vez (chamado pelos componentes que mostram texto em inglês). */
export function ensureTranslateLoaded(): void {
  void useTranslate.getState().load();
}

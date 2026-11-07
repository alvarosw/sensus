// Estado da tradução automática: ligada/desligada, oferta respondida e situação do modelo no aparelho. O modelo que a
// Configuração gerencia é o par inglês -> idioma do app (modelPairOf); os pares de outras línguas (Bíblia em espanhol)
// baixam o modelo na primeira tradução, pelo próprio motor.
import { create } from 'zustand';
import { modelPairOf, type TranslationPair } from '@sensus/core';
import { currentLang, useLangStore } from '@/i18n/lang-store';
import { clearTranslationCache } from './engine';
import { downloadModel, modelReady, removeModels, translationSupported } from './native';
import { readTranslatePrefs, writeTranslatePrefs } from './storage';
import { claimOfferOwner } from './offer-session';

/**
 * unknown: ainda não verificado; missing: não baixado; downloading; ready: pronto; error: última tentativa falhou;
 * on-demand: o app está em inglês, não há modelo próprio para baixar (cada outro idioma baixa o seu na primeira vez).
 */
export type ModelStatus = 'unknown' | 'missing' | 'downloading' | 'ready' | 'error' | 'on-demand';

/** Par do modelo que a Configuração mostra: inglês -> idioma do app (null com o app em inglês). */
export function currentModelPair(): TranslationPair | null {
  return modelPairOf(currentLang());
}

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
  /** Liga (baixa o modelo do idioma do app se faltar) ou desliga (mantém o modelo). */
  setEnabled(on: boolean): Promise<void>;
  /** Resposta à oferta da primeira vez: "Ativar" liga; "Agora não" só registra a escolha. */
  answerOffer(accept: boolean): Promise<void>;
  /** Baixa o modelo do idioma do app (botão da Configuração). */
  downloadModel(): Promise<void>;
  refreshModel(): Promise<void>;
  /** Apaga os modelos baixados (exceto o inglês) e desliga a tradução (para não baixar de novo sem aviso). */
  removeModel(): Promise<void>;
}

let downloading: Promise<void> | null = null;

export const useTranslate = create<TranslateState>()((set, get) => {
  const persist = () => {
    const { enabled, offerAnswered } = get();
    writeTranslatePrefs({ enabled, offerAnswered });
  };

  const download = (): Promise<void> => {
    const pair = currentModelPair();
    if (!pair) return Promise.resolve();
    if (!downloading) {
      set({ model: 'downloading' });
      const target = pair.to;
      downloading = downloadModel(pair)
        .then(() => {
          // o idioma pode ter trocado durante o download: só marca pronto se ainda é o mesmo
          if (currentModelPair()?.to === target) set({ model: 'ready' });
        })
        .catch(() => {
          set({ model: 'error' });
          throw new Error('download-failed');
        })
        .finally(() => {
          downloading = null;
          // o idioma trocou durante o download: confere de novo o modelo do idioma atual (senão a situação fica presa)
          if (currentModelPair()?.to !== target) void get().refreshModel();
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
      const pair = currentModelPair();
      if (!pair) {
        set({ model: 'on-demand' });
        return;
      }
      if (!translationSupported || downloading) return;
      try {
        const ready = await modelReady(pair);
        // o idioma pode ter trocado enquanto o aparelho respondia: só vale a resposta do idioma atual
        if (currentModelPair()?.to === pair.to) set({ model: ready ? 'ready' : 'missing' });
      } catch {
        if (currentModelPair()?.to === pair.to) set({ model: 'missing' });
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
        const status = get().model;
        if (status !== 'ready' && status !== 'on-demand') await download();
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

    downloadModel: async () => {
      try {
        await download();
      } catch {
        // o estado de erro já está em `model`; a Configuração mostra a mensagem
      }
    },

    removeModel: async () => {
      await removeModels();
      clearTranslationCache();
      set({ enabled: false, offerAnswered: true });
      persist();
      await get().refreshModel();
    },
  };
});

// Trocar o idioma do app muda o par do modelo: a situação e o download valem para o idioma atual.
useLangStore.subscribe((state, prev) => {
  if (state.lang !== prev.lang && useTranslate.getState().loaded) void useTranslate.getState().refreshModel();
});

/** Carrega preferências uma vez (chamado pelos componentes que mostram texto em outro idioma). */
export function ensureTranslateLoaded(): void {
  void useTranslate.getState().load();
}

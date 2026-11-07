// Idioma da interface. Fonte da verdade em tempo de execução; a gravação (app-prefs.json, chave appLang) e a escolha
// inicial pelo aparelho ficam em settings/app-prefs.ts, que é quem sabe ler e gravar preferências.
// Os textos leem `currentLang()` na hora do acesso (ver localized.ts); a raiz remonta a árvore ao trocar (key={lang}).
import { create } from 'zustand';
import { DEFAULT_APP_LANG, appLangInfo, type AppLang } from '@sensus/core';

interface LangState {
  lang: AppLang;
  setLang(lang: AppLang): void;
}

export const useLangStore = create<LangState>()((set) => ({
  lang: DEFAULT_APP_LANG,
  setLang: (lang) => set({ lang }),
}));

/** Idioma atual, lido na hora (para textos e funções fora de componentes). */
export function currentLang(): AppLang {
  return useLangStore.getState().lang;
}

/** BCP-47 do idioma atual: datas (Intl), idioma pedido à IA. */
export function currentBcp47(): string {
  return appLangInfo(currentLang()).bcp47;
}

/** Idioma atual com re-render quando muda (componentes). */
export function useLang(): AppLang {
  return useLangStore((s) => s.lang);
}

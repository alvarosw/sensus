// Tradução automática de um texto em inglês para a tela (política 'item' de useTranslatable). Mostra o original
// enquanto traduz. Mantida como fina camada sobre useTranslatable: o formato do retorno é o que as telas já usam.

import { useTranslatable } from './useTranslatable';

export interface AutoTranslation {
  /** Texto a mostrar agora: a tradução, ou o original (oferta, desligada, em andamento, falha ou "Ver original"). */
  display: string;
  /** O texto em inglês, sempre disponível. */
  original: string;
  /** A tela mostra a tradução. */
  translated: boolean;
  /** Existe tradução pronta para este texto (mesmo se o original estiver visível). */
  available: boolean;
  /** Traduzindo (ou baixando o modelo). */
  loading: boolean;
  /** A última tentativa falhou: o original segue visível. */
  failed: boolean;
  /** Texto elegível (inglês e aparelho compatível). */
  eligible: boolean;
  /** Mostra a oferta da primeira vez (ainda não respondida e a opção está desligada). */
  offer: boolean;
  /** Usuário escolheu "Ver original". */
  showOriginal: boolean;
  toggleOriginal(): void;
  answerOffer(accept: boolean): void;
  retry(): void;
}

/** Estado que a linha de nota (AutoTranslateNote) usa: o mesmo para um texto só e para um bloco com vários. */
export type TranslationNoteState = Pick<
  AutoTranslation,
  'offer' | 'loading' | 'failed' | 'available' | 'translated' | 'showOriginal' | 'toggleOriginal' | 'answerOffer' | 'retry'
>;

export function useAutoTranslate(text: string | null | undefined, lang: string | null | undefined): AutoTranslation {
  const body = text ?? '';
  const tr = useTranslatable(body, { lang, policy: 'item' });
  return {
    display: tr.show(body),
    original: body,
    translated: tr.translated,
    available: tr.available,
    loading: tr.loading,
    failed: tr.failed,
    eligible: tr.eligible,
    offer: tr.offer,
    showOriginal: tr.showOriginal,
    toggleOriginal: tr.toggleOriginal,
    answerOffer: tr.answerOffer,
    retry: tr.retry,
  };
}

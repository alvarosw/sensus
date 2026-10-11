// Tradução automática de um texto em inglês para a tela. Mostra o original enquanto traduz.
// Só traduz textos cuja fonte é inglês (source.lang), e só quando a opção está ligada.
import { useEffect, useMemo, useState } from 'react';
import { useTranslate, ensureTranslateLoaded } from './store';
import { cachedTranslation, translateText } from './engine';

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

export function useAutoTranslate(text: string | null | undefined, lang: string | null | undefined): AutoTranslation {
  const loaded = useTranslate((s) => s.loaded);
  const supported = useTranslate((s) => s.supported);
  const enabled = useTranslate((s) => s.enabled);
  const offerAnswered = useTranslate((s) => s.offerAnswered);
  const answerOffer = useTranslate((s) => s.answerOffer);

  const [showOriginal, setShowOriginal] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [done, setDone] = useState<{ text: string; out?: string; error?: boolean } | null>(null);

  useEffect(() => {
    ensureTranslateLoaded();
  }, []);

  const body = text ?? '';
  const eligible = supported && lang === 'en' && body.trim().length > 0;
  const active = eligible && loaded && enabled;

  // Cache em memória: se o texto já foi traduzido nesta sessão, aparece na hora (sem "Traduzindo…").
  const cached = useMemo(() => (active ? cachedTranslation(body) : null), [active, body]);

  useEffect(() => {
    if (!active || cached !== null) return;
    let alive = true;
    translateText(body).then(
      (out) => {
        if (alive) setDone({ text: body, out });
      },
      () => {
        if (alive) setDone({ text: body, error: true });
      },
    );
    return () => {
      alive = false;
    };
  }, [active, body, cached, attempt]);

  const current = done && done.text === body ? done : null;
  const translation = active ? (cached ?? current?.out ?? null) : null;
  const failed = active && translation === null && current?.error === true;
  const loading = active && translation === null && !failed;
  const translated = translation !== null && !showOriginal;

  return {
    display: translated ? (translation as string) : body,
    original: body,
    translated,
    available: translation !== null,
    loading,
    failed,
    eligible,
    offer: eligible && loaded && !enabled && !offerAnswered,
    showOriginal,
    toggleOriginal: () => setShowOriginal((v) => !v),
    answerOffer: (accept) => {
      void answerOffer(accept);
    },
    retry: () => {
      setDone(null);
      setAttempt((n) => n + 1);
    },
  };
}

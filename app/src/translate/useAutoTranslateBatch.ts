// Tradução automática de vários textos em inglês de uma mesma tela (ex.: glosa e classe no cabeçalho de uma
// palavra). Um pedido ao aparelho para o conjunto, um só "Ver original" e uma só nota. Mesmas regras de
// useAutoTranslate: cache só em memória, o original segue na tela enquanto traduz, e a oferta aparece uma vez.
import { useEffect, useState } from 'react';
import { cachedTranslation, translateMany } from './engine';
import { ensureTranslateLoaded, useTranslate } from './store';
import type { TranslationNoteState } from './useAutoTranslate';

export interface BatchTranslation extends TranslationNoteState {
  /** Texto a mostrar para um dos originais: a tradução pronta, ou o próprio original. */
  show(text: string): string;
  /** Há textos elegíveis (inglês e aparelho compatível). */
  eligible: boolean;
}

let panelSeq = 0;

export function useAutoTranslateBatch(texts: readonly string[], lang: string | null | undefined): BatchTranslation {
  const loaded = useTranslate((s) => s.loaded);
  const supported = useTranslate((s) => s.supported);
  const enabled = useTranslate((s) => s.enabled);
  const offerAnswered = useTranslate((s) => s.offerAnswered);
  const answerOffer = useTranslate((s) => s.answerOffer);
  const offerOwner = useTranslate((s) => s.offerOwner);
  const claimOffer = useTranslate((s) => s.claimOffer);
  const [panelId] = useState(() => ++panelSeq);

  const [showOriginal, setShowOriginal] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // resultado do último lote, com a chave dos textos que ele traduziu
  const [done, setDone] = useState<{ key: string; error: boolean } | null>(null);

  useEffect(() => {
    ensureTranslateLoaded();
  }, []);

  const todo = texts.filter((t) => t.trim().length > 0);
  const key = todo.join('\u0001');
  const eligible = supported && lang === 'en' && todo.length > 0;
  const active = eligible && loaded && enabled;
  const cachedCount = active ? todo.filter((t) => cachedTranslation(t) !== null).length : 0;
  const allCached = active && cachedCount === todo.length;
  const current = done && done.key === key ? done : null;

  useEffect(() => {
    if (!active || allCached) return;
    let alive = true;
    translateMany(todo).then(
      () => {
        if (alive) setDone({ key, error: false });
      },
      () => {
        if (alive) setDone({ key, error: true });
      },
    );
    return () => {
      alive = false;
    };
    // o lote depende só do conteúdo dos textos (key), não da identidade do array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key, allCached, attempt]);

  // A oferta aparece em um só painel por sessão (mesma regra de useAutoTranslate).
  const baseOffer = eligible && loaded && !enabled && !offerAnswered;
  const offer = baseOffer && (offerOwner === null || offerOwner === panelId);
  useEffect(() => {
    if (offer && offerOwner === null) claimOffer(panelId);
  }, [offer, offerOwner, claimOffer, panelId]);

  const failed = active && !allCached && current?.error === true;
  const loading = active && !allCached && current === null;
  const available = cachedCount > 0;
  const translated = available && !showOriginal;

  return {
    show: (text) => (!active || showOriginal || !text.trim() ? text : (cachedTranslation(text) ?? text)),
    translated,
    available,
    loading,
    failed,
    eligible,
    offer,
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

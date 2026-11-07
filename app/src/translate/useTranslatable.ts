// Tradução automática de um ou mais textos de uma tela. Uma API só, com política explícita:
//  - 'item': o bloco (texto, painel, cabeçalho) traduz os próprios textos, oferece a tradução uma vez por sessão e
//    tem "Ver original" próprio;
//  - 'global': a tela inteira (linha do tempo) entra no lote compartilhado por quadro, sem oferta, com um "Ver original".
// O idioma de origem vem do registro de fontes (sourceId) ou do banco (lang, para fonte fora do registro); o destino é
// o idioma do app. Sem par (mesma língua, origem grega ou hebraica), nada é traduzido: sem oferta e sem nota. Cache só
// em memória, por par: nada traduzido é gravado no aparelho. As decisões ficam em policy.ts (puras, testadas).
import { useEffect, useState } from 'react';
import { appLangInfo, isAppLang, langBase, sourceLangOf, translationPair, type TranslationPair } from '@sensus/core';
import { useLang } from '@/i18n/lang-store';
import { cachedTranslation, pairKey, translateMany } from './engine';
import { askGlobal, isGlobalFailed, retryGlobal, useGlobalView } from './global-batch';
import {
  batchFromKey,
  batchKey,
  batchPhase,
  batchTexts,
  isActive,
  isEligible,
  isOfferShown,
  type BatchResult,
  type TranslatePolicy,
} from './policy';
import { ensureTranslateLoaded, useTranslate } from './store';

/** Nome de um idioma para as frases (endônimo; o código, se não for um dos 14 idiomas do app). */
function endonymOf(code: string): string {
  const base = langBase(code) ?? code;
  return isAppLang(base) ? appLangInfo(base).endonym : base;
}

export interface TranslatableOptions {
  /** Fonte dos textos: o idioma é o do registro de fontes (`SOURCES`). */
  sourceId?: string | null;
  /** Idioma conhecido (fonte fora do registro, lido do banco). Com `sourceId` registrado, o registro vence. */
  lang?: string | null;
  policy: TranslatePolicy;
}

export interface Translatable {
  /** Texto a mostrar para um dos originais: a tradução pronta, ou o próprio original. */
  show(text: string): string;
  /** Há textos traduzíveis (fonte em inglês e aparelho compatível). */
  eligible: boolean;
  /** Tradução configurada e pronta: ligada e carregada (no global, também com o modelo pronto). */
  active: boolean;
  /** Existe tradução pronta para algum dos textos (mesmo com o original visível). */
  available: boolean;
  /** A tela mostra a tradução. */
  translated: boolean;
  /** Traduzindo (ou baixando o modelo). */
  loading: boolean;
  /** A última tentativa falhou: os originais seguem visíveis. */
  failed: boolean;
  /** Mostra a oferta da primeira vez (só policy 'item'). */
  offer: boolean;
  /** Usuário escolheu "Ver original" (deste bloco no 'item'; da tela inteira no 'global'). */
  showOriginal: boolean;
  toggleOriginal(): void;
  answerOffer(accept: boolean): void;
  retry(): void;
  /** Par de idiomas da tradução (origem -> idioma do app); null quando não há o que traduzir. */
  pair: TranslationPair | null;
  /** Nomes dos dois idiomas do par (endônimos), para as frases da oferta e das notas; null sem par. */
  names: { from: string; to: string } | null;
}

let panelSeq = 0;

export function useTranslatable(
  texts: string | null | undefined | readonly (string | null | undefined)[],
  opts: TranslatableOptions,
): Translatable {
  const { policy } = opts;
  const appLang = useLang();
  const sourceLang = opts.sourceId ? sourceLangOf(opts.sourceId, opts.lang) : opts.lang;
  const pair = translationPair(sourceLang, appLang);
  const translatable = pair !== null;
  const pk = pair ? pairKey(pair) : '';

  const todo = batchTexts(typeof texts === 'string' || texts == null ? [texts] : texts);
  const key = batchKey(todo);
  const list = batchFromKey(key);

  const loaded = useTranslate((s) => s.loaded);
  const supported = useTranslate((s) => s.supported);
  const enabled = useTranslate((s) => s.enabled);
  const model = useTranslate((s) => s.model);
  const offerAnswered = useTranslate((s) => s.offerAnswered);
  const answerOffer = useTranslate((s) => s.answerOffer);
  const offerOwner = useTranslate((s) => s.offerOwner);
  const claimOffer = useTranslate((s) => s.claimOffer);
  // Só o policy 'global' lê o estado compartilhado: um bloco 'item' não repinta a cada lote da linha do tempo.
  // A versão sobe a cada lote global; a assinatura faz a tela repintar quando um lote chega.
  const globalShowOriginal = useGlobalView((s) => (policy === 'global' ? s.showOriginal : false));
  const globalToggle = useGlobalView((s) => s.toggleOriginal);
  useGlobalView((s) => (policy === 'global' ? s.version : 0));
  const [panelId] = useState(() => ++panelSeq);

  const [localShowOriginal, setLocalShowOriginal] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // resultado do último lote deste bloco, com a chave dos textos que ele traduziu (policy 'item')
  const [done, setDone] = useState<{ key: string; error: boolean } | null>(null);

  useEffect(() => {
    ensureTranslateLoaded();
  }, []);

  const eligible = isEligible({ supported, translatable, texts: list.length });
  const active = isActive(policy, { supported, loaded, enabled, model, translatable }) && (policy === 'global' || list.length > 0);
  const showOriginal = policy === 'global' ? globalShowOriginal : localShowOriginal;

  // quantos textos já têm tradução no cache (recontado a cada render: o cache muda fora do React)
  const cachedCount = active && pair ? list.filter((t) => cachedTranslation(t, pair) !== null).length : 0;
  const allCached = active && cachedCount === list.length;

  useEffect(() => {
    if (policy !== 'item' || !active || allCached || !pair) return;
    let alive = true;
    translateMany(list, pair).then(
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
    // o lote depende do conteúdo (key), não da identidade do array; attempt reabre depois de uma falha
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policy, active, key, pk, allCached, attempt]);

  useEffect(() => {
    if (policy === 'global' && active && pair) askGlobal(list, pair);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policy, active, key, pk]);

  // A oferta aparece em um só bloco por sessão: o primeiro que a mostra a reivindica.
  const offer = isOfferShown(policy, {
    eligible,
    loaded,
    enabled,
    offerAnswered,
    owner: offerOwner,
    panelId,
  });
  useEffect(() => {
    if (offer && offerOwner === null) claimOffer(panelId);
  }, [offer, offerOwner, claimOffer, panelId]);

  let result: BatchResult = 'ok';
  if (policy === 'item') result = done && done.key === key ? (done.error ? 'error' : 'ok') : 'pending';
  const item = batchPhase({ active, allCached, result });

  // global: pendências e falhas dos textos desta tela
  const globalMissing = policy === 'global' && active && pair ? list.filter((t) => cachedTranslation(t, pair) === null) : [];
  const global = {
    loading: globalMissing.some((t) => pair !== null && !isGlobalFailed(t, pair)),
    failed: globalMissing.some((t) => pair !== null && isGlobalFailed(t, pair)),
  };

  const available = cachedCount > 0;
  const translated = available && !showOriginal;

  return {
    show: (text) => (!active || !pair || showOriginal || !text.trim() ? text : (cachedTranslation(text, pair) ?? text)),
    eligible,
    active,
    available,
    translated,
    loading: policy === 'item' ? item.loading : global.loading,
    failed: policy === 'item' ? item.failed : global.failed,
    offer,
    showOriginal,
    toggleOriginal: () => {
      if (policy === 'global') globalToggle();
      else setLocalShowOriginal((v) => !v);
    },
    answerOffer: (accept) => {
      void answerOffer(accept);
    },
    pair,
    names: pair ? { from: endonymOf(pair.from), to: endonymOf(pair.to) } : null,
    retry: () => {
      if (policy === 'global') {
        if (pair) retryGlobal(list, pair);
      } else {
        setDone(null);
        setAttempt((n) => n + 1);
      }
    },
  };
}

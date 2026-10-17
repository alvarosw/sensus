// Tradução automática de um ou mais textos de uma tela. Uma API só, com política explícita:
//  - 'item': o bloco (texto, painel, cabeçalho) traduz os próprios textos, oferece a tradução uma vez por sessão e
//    tem "Ver original" próprio;
//  - 'global': a tela inteira (linha do tempo) entra no lote compartilhado por quadro, sem oferta, com um "Ver original".
// O idioma vem do registro de fontes (sourceId) ou do banco (lang, para fonte fora do registro). Cache só em memória:
// nada traduzido é gravado no aparelho. As decisões ficam em policy.ts (puras, testadas).
import { useEffect, useState } from 'react';
import { isTranslatableLang, isTranslatableSource } from '@sensus/core';
import { cachedTranslation, translateMany } from './engine';
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
}

let panelSeq = 0;

export function useTranslatable(
  texts: string | null | undefined | readonly (string | null | undefined)[],
  opts: TranslatableOptions,
): Translatable {
  const { policy } = opts;
  const translatable = opts.sourceId ? isTranslatableSource(opts.sourceId, opts.lang) : isTranslatableLang(opts.lang);

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
  const cachedCount = active ? list.filter((t) => cachedTranslation(t) !== null).length : 0;
  const allCached = active && cachedCount === list.length;

  useEffect(() => {
    if (policy !== 'item' || !active || allCached) return;
    let alive = true;
    translateMany(list).then(
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
  }, [policy, active, key, allCached, attempt]);

  useEffect(() => {
    if (policy === 'global' && active) askGlobal(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policy, active, key]);

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
  const globalMissing = policy === 'global' && active ? list.filter((t) => cachedTranslation(t) === null) : [];
  const global = {
    loading: globalMissing.some((t) => !isGlobalFailed(t)),
    failed: globalMissing.some((t) => isGlobalFailed(t)),
  };

  const available = cachedCount > 0;
  const translated = available && !showOriginal;

  return {
    show: (text) => (!active || showOriginal || !text.trim() ? text : (cachedTranslation(text) ?? text)),
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
    retry: () => {
      if (policy === 'global') {
        retryGlobal(list);
      } else {
        setDone(null);
        setAttempt((n) => n + 1);
      }
    },
  };
}

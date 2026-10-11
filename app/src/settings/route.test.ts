// Máquina de seleção e reserva do provedor (modo, conta, pausa e falhas). Puro: sem rede nem React Native.
import { describe, expect, it } from 'vitest';
import { LLMError } from '@sensus/core';
import {
  CHATGPT_LIMIT_RETRY_MS,
  chooseRoute,
  decideChatGPTFailure,
  decideError,
  isPaused,
  isProviderMode,
  pauseFor,
  type ChatGPTRouteState,
} from './route';

const NOW = 1_800_000_000_000;
const READY: ChatGPTRouteState = { connected: true, ready: true, attention: false };
const ATTENTION: ChatGPTRouteState = { connected: true, ready: false, attention: true };
const NONE: ChatGPTRouteState = { connected: false, ready: false, attention: false };
const PAUSED = { until: NOW + 60_000, known: false };

describe('CHATGPT_LIMIT_RETRY_MS', () => {
  it('é 10 minutos (decisão do dono do produto)', () => {
    expect(CHATGPT_LIMIT_RETRY_MS).toBe(10 * 60 * 1000);
  });
});

describe('pauseFor', () => {
  it('sem horário informado: agora + 10 minutos, known=false', () => {
    expect(pauseFor(NOW)).toEqual({ until: NOW + CHATGPT_LIMIT_RETRY_MS, known: false });
  });

  it('com horário informado no futuro: usa o horário, known=true', () => {
    const at = NOW + 3_600_000;
    expect(pauseFor(NOW, at)).toEqual({ until: at, known: true });
  });

  it('horário informado já passado não serve: volta ao padrão', () => {
    expect(pauseFor(NOW, NOW - 1)).toEqual({ until: NOW + CHATGPT_LIMIT_RETRY_MS, known: false });
  });
});

describe('isPaused', () => {
  it('pausa vale até o horário (exclusive) e depois termina', () => {
    expect(isPaused(PAUSED, NOW)).toBe(true);
    expect(isPaused(PAUSED, PAUSED.until - 1)).toBe(true);
    expect(isPaused(PAUSED, PAUSED.until)).toBe(false);
    expect(isPaused(null, NOW)).toBe(false);
  });
});

describe('decideChatGPTFailure', () => {
  const auto = { mode: 'auto' as const, now: NOW };
  const chatgptOnly = { mode: 'chatgpt' as const, now: NOW };

  it('limite (plan_limit e rate_limit) com reserva no Automático: repete com a chave e pausa', () => {
    expect(decideChatGPTFailure('plan_limit', { ...auto, hasFallback: true })).toEqual({
      kind: 'fallback',
      pause: { until: NOW + CHATGPT_LIMIT_RETRY_MS, known: false },
    });
    const resetAt = NOW + 900_000;
    expect(decideChatGPTFailure('rate_limit', { ...auto, hasFallback: true, resetAt })).toEqual({
      kind: 'fallback',
      pause: { until: resetAt, known: true },
    });
  });

  it('limite no Automático sem chave: erro, mas pausa (não insiste no limite)', () => {
    expect(decideChatGPTFailure('plan_limit', { ...auto, hasFallback: false })).toEqual({
      kind: 'error',
      pause: { until: NOW + CHATGPT_LIMIT_RETRY_MS, known: false },
    });
  });

  it('limite no Só ChatGPT: erro, sem pausa e sem chave', () => {
    expect(decideChatGPTFailure('plan_limit', { ...chatgptOnly, hasFallback: false })).toEqual({ kind: 'error' });
    expect(decideChatGPTFailure('plan_limit', { ...chatgptOnly, hasFallback: true })).toEqual({ kind: 'fallback' });
  });

  it('transitório: com reserva repete com a chave, sem pausa; sem reserva, erro', () => {
    expect(decideChatGPTFailure('transient', { ...auto, hasFallback: true })).toEqual({ kind: 'fallback' });
    expect(decideChatGPTFailure('transient', { ...auto, hasFallback: false })).toEqual({ kind: 'error' });
  });

  it('atenção (reauth e not_eligible) nunca usa a chave, em nenhum modo', () => {
    for (const mode of ['auto', 'chatgpt'] as const) {
      for (const hasFallback of [true, false]) {
        expect(decideChatGPTFailure('reauth', { mode, hasFallback, now: NOW })).toEqual({ kind: 'attention', reason: 'reauth' });
        expect(decideChatGPTFailure('not_eligible', { mode, hasFallback, now: NOW })).toEqual({ kind: 'attention', reason: 'not_eligible' });
      }
    }
  });
});

describe('decideError', () => {
  it('usa o resetAt do LLMError', () => {
    const at = NOW + 120_000;
    const err = new LLMError('limite', 'plan_limit', 429, at);
    expect(decideError(err, { mode: 'auto', hasFallback: true, now: NOW })).toEqual({
      kind: 'fallback',
      pause: { until: at, known: true },
    });
  });

  it('erro sem código de plano (ex.: rede) é transitório', () => {
    const err = new LLMError('rede', 'network');
    expect(decideError(err, { mode: 'auto', hasFallback: true, now: NOW })).toEqual({ kind: 'fallback' });
    expect(decideError(new Error('x'), { mode: 'auto', hasFallback: true, now: NOW })).toEqual({ kind: 'fallback' });
  });

  it('403 de elegibilidade é atenção', () => {
    const err = new LLMError('sem plano', 'plan_not_eligible', 403);
    expect(decideError(err, { mode: 'auto', hasFallback: true, now: NOW })).toEqual({ kind: 'attention', reason: 'not_eligible' });
  });
});

describe('chooseRoute', () => {
  it('Só chave: ignora o ChatGPT mesmo pronto', () => {
    expect(chooseRoute('key', READY, null, NOW)).toBe('key');
    expect(chooseRoute('key', ATTENTION, null, NOW)).toBe('key');
    expect(chooseRoute('key', null, null, NOW)).toBe('key');
  });

  it('Só ChatGPT: nunca a chave; pronto ou com atenção vai ao ChatGPT; sem plano, nenhum', () => {
    expect(chooseRoute('chatgpt', READY, null, NOW)).toBe('chatgpt');
    expect(chooseRoute('chatgpt', READY, PAUSED, NOW)).toBe('chatgpt');
    expect(chooseRoute('chatgpt', ATTENTION, null, NOW)).toBe('chatgpt');
    expect(chooseRoute('chatgpt', NONE, null, NOW)).toBe('none');
    expect(chooseRoute('chatgpt', null, null, NOW)).toBe('none');
  });

  it('Automático: ChatGPT com reserva quando pronto e sem pausa (padrão)', () => {
    expect(chooseRoute('auto', READY, null, NOW)).toBe('chatgpt-with-key');
    expect(chooseRoute('auto', READY, { until: NOW - 1, known: false }, NOW)).toBe('chatgpt-with-key');
  });

  it('Automático com pausa ativa: usa a chave até a pausa acabar', () => {
    expect(chooseRoute('auto', READY, PAUSED, NOW)).toBe('key');
    expect(chooseRoute('auto', READY, PAUSED, PAUSED.until)).toBe('chatgpt-with-key');
  });

  it('Automático com atenção: nunca a chave (mesmo pausado ou sem plano)', () => {
    expect(chooseRoute('auto', ATTENTION, null, NOW)).toBe('chatgpt');
    expect(chooseRoute('auto', ATTENTION, PAUSED, NOW)).toBe('chatgpt');
  });

  it('Automático sem conta: só a chave', () => {
    expect(chooseRoute('auto', NONE, null, NOW)).toBe('key');
    expect(chooseRoute('auto', null, null, NOW)).toBe('key');
  });
});

describe('isProviderMode', () => {
  it('aceita só os três modos', () => {
    expect(isProviderMode('auto')).toBe(true);
    expect(isProviderMode('chatgpt')).toBe(true);
    expect(isProviderMode('key')).toBe(true);
    expect(isProviderMode('nvidia')).toBe(false);
    expect(isProviderMode(undefined)).toBe(false);
  });
});

// Transição da curiosidade do trecho (pura) e o slice do store: uma vez por unidade, sem voltar de 'shown'/'hidden'.
import { beforeEach, describe, expect, it } from 'vitest';
import { curiosityCacheKey, type CuriosityCandidate } from '@sensus/core';
import { canStartCuriosity, curiosityTransition, EMPTY_CURIOSITY, useStudy } from './index';

const CAND: CuriosityCandidate = {
  kind: 'eco',
  hook: 'Pedras: a frase remete ao nome de Deus',
  listener: 'Os ouvintes conheciam Êx 3:14 [[xr:x1]]',
  today: 'Hoje lê-se como afirmação de idade',
  change: 'Muda o sentido da discussão [[txt:bl:43008058]]',
  evidence: ['xr:x1', 'txt:bl:43008058'],
  confidence: 'alta',
  raw: '@curiosidade eco',
};

const INITIAL = useStudy.getState();
beforeEach(() => useStudy.setState(INITIAL, true));

describe('curiosityTransition', () => {
  it('start só sai de idle: começa em running', () => {
    expect(curiosityTransition(undefined, { type: 'start' })).toEqual({ status: 'running', candidate: null, reason: '' });
    expect(curiosityTransition(EMPTY_CURIOSITY, { type: 'start' }).status).toBe('running');
  });

  it('show precisa de candidata e de estar rodando', () => {
    expect(curiosityTransition(undefined, { type: 'show', reason: 'ok' }).status).toBe('idle');
    const running = curiosityTransition(undefined, { type: 'start' });
    expect(curiosityTransition(running, { type: 'show', reason: 'ok' }).status).toBe('running');
    const withCand = curiosityTransition(running, { type: 'candidate', candidate: CAND });
    const shown = curiosityTransition(withCand, { type: 'show', reason: 'aprovada' });
    expect(shown).toEqual({ status: 'shown', candidate: CAND, reason: 'aprovada' });
  });

  it('hide sem candidata (gerador respondeu @nenhuma) fecha a unidade sem candidata', () => {
    const running = curiosityTransition(undefined, { type: 'start' });
    expect(curiosityTransition(running, { type: 'hide', reason: '@nenhuma' })).toEqual({ status: 'hidden', candidate: null, reason: '@nenhuma' });
  });

  it('hide depois da candidata (revisor reprovou) também zera a candidata', () => {
    let e = curiosityTransition(undefined, { type: 'start' });
    e = curiosityTransition(e, { type: 'candidate', candidate: CAND });
    e = curiosityTransition(e, { type: 'hide', reason: 'uma das revisões reprovou' });
    expect(e.status).toBe('hidden');
    expect(e.candidate).toBeNull();
  });

  it('fail vira error, silencioso e final', () => {
    const e = curiosityTransition(curiosityTransition(undefined, { type: 'start' }), { type: 'fail', reason: 'rede' });
    expect(e.status).toBe('error');
    expect(curiosityTransition(e, { type: 'start' })).toBe(e);
  });

  it('cancel volta a idle só quando estava rodando (para recomeçar ao reabrir)', () => {
    const running = curiosityTransition(undefined, { type: 'start' });
    expect(curiosityTransition(running, { type: 'cancel' }).status).toBe('idle');
    const shown = { status: 'shown' as const, candidate: CAND, reason: '' };
    expect(curiosityTransition(shown, { type: 'cancel' })).toBe(shown);
  });

  it('shown e hidden são finais: start e cancel não mexem', () => {
    const hidden = { status: 'hidden' as const, candidate: null, reason: 'x' };
    expect(curiosityTransition(hidden, { type: 'start' })).toBe(hidden);
    expect(curiosityTransition(hidden, { type: 'cancel' })).toBe(hidden);
  });
});

describe('canStartCuriosity', () => {
  const ok = { open: true, hasProvider: true, ready: true };
  it('só com folha aberta, provedor, contexto pronto e estado ocioso', () => {
    expect(canStartCuriosity(undefined, ok)).toBe(true);
    expect(canStartCuriosity('idle', ok)).toBe(true);
    expect(canStartCuriosity(undefined, { ...ok, open: false })).toBe(false);
    expect(canStartCuriosity(undefined, { ...ok, hasProvider: false })).toBe(false);
    expect(canStartCuriosity(undefined, { ...ok, ready: false })).toBe(false);
  });
  it('nunca recomeça depois de decidida ou com erro', () => {
    for (const s of ['running', 'shown', 'hidden', 'error'] as const) expect(canStartCuriosity(s, ok)).toBe(false);
  });
});

describe('slice curiosities', () => {
  it('chave por unidade: cada unidade tem o seu estado', () => {
    const a = curiosityCacheKey({ start: 43002001, end: 43002011 });
    const b = curiosityCacheKey({ start: 43005001, end: 43005010 });
    useStudy.getState().dispatchCuriosity(a, { type: 'start' });
    useStudy.getState().dispatchCuriosity(a, { type: 'candidate', candidate: CAND });
    useStudy.getState().dispatchCuriosity(a, { type: 'show', reason: 'ok' });
    expect(useStudy.getState().curiosities[a]?.status).toBe('shown');
    expect(useStudy.getState().curiosities[b]).toBeUndefined();
  });

  it('dispatch sem mudança não cria nova referência', () => {
    const before = useStudy.getState().curiosities;
    useStudy.getState().dispatchCuriosity('k', { type: 'cancel' });
    expect(useStudy.getState().curiosities).toBe(before);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranslationPair } from '@sensus/core';

// Lote e cache da tradução (sem o módulo nativo): a ponte nativa é trocada por uma função que devolve "<destino>:<trecho>".
const translateRuns = vi.hoisted(() =>
  vi.fn(async (texts: string[], pair: { to: string }) => texts.map((t) => `${pair.to}:${t}`)),
);
vi.mock('./native', () => ({ translateRuns }));

import { cachedTranslation, cacheKey, clearTranslationCache, translateMany } from './engine';

const PT: TranslationPair = { from: 'en', to: 'pt' };
const ES: TranslationPair = { from: 'en', to: 'es' };
const ES_BIBLE: TranslationPair = { from: 'es', to: 'en' };

describe('translateMany (lote em memória, por par)', () => {
  beforeEach(() => {
    clearTranslationCache();
    translateRuns.mockClear();
  });

  it('traduz os trechos que faltam numa só chamada e depois responde pelo cache', async () => {
    await translateMany(['Paul', 'Death of Saul', 'Paul'], PT);
    expect(translateRuns).toHaveBeenCalledTimes(1);
    expect(translateRuns.mock.calls[0]![0]).toEqual(['Paul', 'Death of Saul']);
    expect(cachedTranslation('Paul', PT)).toBe('pt:Paul');
    expect(cachedTranslation('Death of Saul', PT)).toBe('pt:Death of Saul');
  });

  it('o cache separa os pares: o mesmo texto em espanhol não reaproveita o português', async () => {
    await translateMany(['Paul'], PT);
    expect(cachedTranslation('Paul', ES)).toBeNull();
    await translateMany(['Paul'], ES);
    expect(cachedTranslation('Paul', ES)).toBe('es:Paul');
    expect(cachedTranslation('Paul', PT)).toBe('pt:Paul');
    expect(translateRuns).toHaveBeenCalledTimes(2);
    expect(translateRuns.mock.calls[1]![1]).toEqual(ES);
  });

  it('a chave inclui origem e destino', () => {
    expect(cacheKey(PT, 'Paul')).not.toBe(cacheKey(ES, 'Paul'));
    expect(cacheKey(ES_BIBLE, 'Paul')).not.toBe(cacheKey({ from: 'en', to: 'es' }, 'Paul'));
  });

  it('não pede de novo o que já está no cache do mesmo par', async () => {
    await translateMany(['Paul'], PT);
    await translateMany(['Paul', 'Paul'], PT);
    expect(translateRuns).toHaveBeenCalledTimes(1);
  });

  it('divide em lotes de até 100 trechos', async () => {
    const texts = Array.from({ length: 250 }, (_, i) => `Event ${i}`);
    await translateMany(texts, PT);
    expect(translateRuns.mock.calls.map((c) => c[0].length)).toEqual([100, 100, 50]);
    expect(cachedTranslation('Event 249', PT)).toBe('pt:Event 249');
  });

  it('texto sem trecho em cache devolve null (o original segue na tela)', () => {
    expect(cachedTranslation('Never seen', PT)).toBeNull();
  });
});

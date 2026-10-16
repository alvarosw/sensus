import { beforeEach, describe, expect, it, vi } from 'vitest';

// Lote e cache da tradução (sem o módulo nativo): a ponte nativa é trocada por uma função que devolve "PT:<trecho>".
const translateRuns = vi.hoisted(() => vi.fn(async (texts: string[]) => texts.map((t) => `PT:${t}`)));
vi.mock('./native', () => ({ translateRuns }));

import { cachedTranslation, clearTranslationCache, translateMany } from './engine';

describe('translateMany (lote em memória)', () => {
  beforeEach(() => {
    clearTranslationCache();
    translateRuns.mockClear();
  });

  it('traduz os trechos que faltam numa só chamada e depois responde pelo cache', async () => {
    await translateMany(['Paul', 'Death of Saul', 'Paul']);
    expect(translateRuns).toHaveBeenCalledTimes(1);
    expect(translateRuns.mock.calls[0]![0]).toEqual(['Paul', 'Death of Saul']);
    expect(cachedTranslation('Paul')).toBe('PT:Paul');
    expect(cachedTranslation('Death of Saul')).toBe('PT:Death of Saul');
  });

  it('não pede de novo o que já está no cache', async () => {
    await translateMany(['Paul']);
    await translateMany(['Paul', 'Paul']);
    expect(translateRuns).toHaveBeenCalledTimes(1);
  });

  it('divide em lotes de até 100 trechos', async () => {
    const texts = Array.from({ length: 250 }, (_, i) => `Event ${i}`);
    await translateMany(texts);
    expect(translateRuns.mock.calls.map((c) => c[0].length)).toEqual([100, 100, 50]);
    expect(cachedTranslation('Event 249')).toBe('PT:Event 249');
  });

  it('texto sem trecho em cache devolve null (o original segue na tela)', () => {
    expect(cachedTranslation('Never seen')).toBeNull();
  });
});

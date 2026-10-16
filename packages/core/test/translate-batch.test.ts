import { describe, expect, it } from 'vitest';
import { chunked, matchesTranslatedText, runsToTranslate } from '../src/index';

// Lote da linha do tempo: trechos que faltam no cache, divisão em pedaços e busca que casa original e tradução.

describe('runsToTranslate', () => {
  it('junta os trechos de vários textos, sem repetir, e tira os que já estão no cache', () => {
    const cached = new Set(['Paul']);
    const runs = runsToTranslate(['Paul', 'Northern Kingdom (Israel)', 'Paul', 'Death of Saul'], (r) => cached.has(r));
    // Trechos (não palavras): "Paul" já está no cache e não volta; "Death of Saul" aparece uma vez.
    expect(runs).not.toContain('Paul');
    expect(runs.filter((r) => r === 'Death of Saul')).toHaveLength(1);
    expect(runs.some((r) => r.startsWith('Northern Kingdom'))).toBe(true);
  });

  it('textos sem nada a traduzir não geram trechos', () => {
    expect(runsToTranslate(['', '   '], () => false)).toEqual([]);
  });
});

describe('chunked', () => {
  it('divide em pedaços de no máximo N itens, mantendo a ordem', () => {
    expect(chunked([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunked([], 3)).toEqual([]);
    expect(chunked([1, 2], 0)).toEqual([[1], [2]]);
  });
});

describe('matchesTranslatedText', () => {
  it('casa o original, sem acento e sem caixa', () => {
    expect(matchesTranslatedText('PAUL', 'Paul', null)).toBe(true);
    expect(matchesTranslatedText('jerusalem', 'Jerusalém', null)).toBe(true);
  });

  it('casa a tradução quando ela está no cache', () => {
    expect(matchesTranslatedText('reino do norte', 'Northern Kingdom (Israel)', 'Reino do Norte (Israel)')).toBe(true);
    expect(matchesTranslatedText('reino do norte', 'Northern Kingdom (Israel)', undefined)).toBe(false);
  });

  it('busca vazia casa tudo; sem casamento, não casa', () => {
    expect(matchesTranslatedText('  ', 'Paul', null)).toBe(true);
    expect(matchesTranslatedText('zzz', 'Paul', 'Paulo')).toBe(false);
  });
});

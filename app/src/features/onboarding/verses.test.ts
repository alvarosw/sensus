import { describe, expect, it } from 'vitest';
import { APP_LANGS } from '@sensus/core';
import { verseOf } from './verses';

describe('versículo da candeia', () => {
  it.each(APP_LANGS.map((l) => [l.code]))('%s tem verso e referência', (code) => {
    const { verse, reference } = verseOf(code);
    expect(verse.trim().length).toBeGreaterThan(0);
    expect(reference.trim().length).toBeGreaterThan(0);
  });

  it('pt traz o Salmo 119:105 da BLivre', () => {
    expect(verseOf('pt')).toEqual({ verse: 'Tua palavra é lâmpada para meus pés e luz para meu caminho.', reference: 'Salmos 119:105 · BLivre' });
  });
});

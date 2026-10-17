import { describe, expect, it } from 'vitest';
import { SRC } from './strings';

describe('SRC.concordance (testamento vem do domínio)', () => {
  it('AT: "no AT", com a contagem de hebraico (2308 versículos de H0935)', () => {
    expect(SRC.concordance(2308, 'OT')).toBe('Concordância · 2308 versículos no AT');
  });

  it('NT no singular', () => {
    expect(SRC.concordance(1, 'NT')).toBe('Concordância · 1 versículo no NT');
  });

  it('sem testamento reconhecido: não inventa "no NT"', () => {
    expect(SRC.concordance(3, null)).toBe('Concordância · 3 versículos');
  });
});

describe('SRC.noLexiconEntry', () => {
  it('nomeia o léxico da língua da forma', () => {
    expect(SRC.noLexiconEntry('TBESH')).toBe('Sem verbete no TBESH para esta forma.');
  });

  it('sem rótulo, mensagem genérica', () => {
    expect(SRC.noLexiconEntry('')).toBe('Sem verbete no léxico para esta forma.');
  });
});

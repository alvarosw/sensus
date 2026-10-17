// Morfologia do AT (OSHB/ETCBC, como no TAHOT) e do grego, pela regra única do domínio (domain/morph.ts).
// Casos de 1Rs 15:15 (hebraico) e Dn 2:4 (aramaico). Os it.todo do app (palavra-chave) ficam para o passo 4.
import { describe, expect, it } from 'vitest';
import { isContentToken, langOfToken } from '../src/index';

const hot = (morph: string | null) => ({ corpus: 'hot' as const, morph });

describe('isContentToken no AT: palavras de conteúdo', () => {
  it('substantivo, verbo e nome hebraico são de conteúdo', () => {
    expect(isContentToken(hot('HNcmsc'))).toBe(true);
    expect(isContentToken(hot('Hc/Vhw3ms'))).toBe(true);
    expect(isContentToken(hot('HNpt'))).toBe(true);
  });

  it('substantivo aramaico é de conteúdo', () => {
    expect(isContentToken(hot('ANcbsd/Ta'))).toBe(true);
    expect(isContentToken(hot('AVqv2ms'))).toBe(true);
  });

  it('sem morfologia continua de conteúdo', () => {
    expect(isContentToken(hot(null))).toBe(true);
  });

  it('partícula de objeto hebraica (HTo, 1Rs 15:15, palavra 2) não é palavra de conteúdo', () => {
    expect(isContentToken(hot('HTo'))).toBe(false);
  });

  it('preposição aramaica pura (AR) não é palavra de conteúdo', () => {
    expect(isContentToken(hot('AR'))).toBe(false);
  });

  it('o grego não muda: preposição e conjunção ficam de fora, verbo fica', () => {
    expect(isContentToken({ corpus: 'gnt', morph: 'PREP' })).toBe(false);
    expect(isContentToken({ corpus: 'gnt', morph: 'CONJ' })).toBe(false);
    expect(isContentToken({ corpus: 'gnt', morph: 'V-PAM-2P' })).toBe(true);
  });
});

describe('língua do token no AT (aramaico pela morfologia)', () => {
  it('token com morfologia aramaica (prefixo A) é arc, não hbo (Dn 2:4)', () => {
    expect(langOfToken({ corpus: 'hot', morph: 'ANcbsd/Ta' })).toBe('arc');
    expect(langOfToken({ corpus: 'hot', morph: 'AVqv2ms' })).toBe('arc');
  });

  it('token hebraico (H) continua hbo, e o grego é grc', () => {
    expect(langOfToken({ corpus: 'hot', morph: 'Hc/Vhw3ms' })).toBe('hbo');
    expect(langOfToken({ corpus: 'gnt', morph: 'V-AAI-3S' })).toBe('grc');
  });
});

describe('palavra de conteúdo no AT: pendente no app', () => {
  it.todo('palavra-chave: verbo hebraico vem do domínio, não de /^(?:H?V)/ em app/src/features/study/keyword.ts:75 (passo 4)');
  it.todo('palavra-chave: nome próprio no AT (não há TAGNT Name type; passo 4)');
});

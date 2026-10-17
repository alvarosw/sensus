// Morfologia do AT (OSHB/ETCBC, como no TAHOT). Hoje isContentToken só entende o código Robinson do grego:
// todo token hebraico ou aramaico vira "de conteúdo". Os casos corretos do AT estão em it.fails (passam
// enquanto o bug existe e falham, sinalizando, quando for corrigido) e em it.todo (ainda sem implementação).
import { describe, expect, it } from 'vitest';
import { isContentToken } from '../src/index';

describe('isContentToken no AT: casos que já estão certos', () => {
  it('substantivo, verbo e nome hebraico são de conteúdo', () => {
    expect(isContentToken({ morph: 'HNcmsc' })).toBe(true);
    expect(isContentToken({ morph: 'Hc/Vhw3ms' })).toBe(true);
    expect(isContentToken({ morph: 'HNpt' })).toBe(true);
  });

  it('substantivo aramaico é de conteúdo', () => {
    expect(isContentToken({ morph: 'ANcbsd/Ta' })).toBe(true);
    expect(isContentToken({ morph: 'AVqv2ms' })).toBe(true);
  });

  it('sem morfologia continua de conteúdo', () => {
    expect(isContentToken({ morph: null })).toBe(true);
  });
});

describe('isContentToken no AT: comportamento correto ainda não implementado (passo 4 da revisão, §1.3)', () => {
  // Partícula de objeto direto (1Rs 15:15, palavra 2, morph 'HTo'): função, não conteúdo.
  it.fails('partícula de objeto hebraica (HTo) não é palavra de conteúdo', () => {
    expect(isContentToken({ morph: 'HTo' })).toBe(false);
  });

  // Preposição aramaica pura (código sintético: a fixture de Dn 2:4 só tem prefixo + nome).
  it.fails('preposição aramaica (AR) não é palavra de conteúdo', () => {
    expect(isContentToken({ morph: 'AR' })).toBe(false);
  });
});

describe('palavra de conteúdo no AT: pendente', () => {
  it.todo('langOfToken: token com morph aramaico (prefixo A) é arc, não hbo (passo 1, domínio)');
  it.todo('palavra-chave: verbo hebraico vem do domínio, não de /^(?:H?V)/ em app/src/features/study/keyword.ts:75 (passo 4)');
  it.todo('palavra-chave: nome próprio no AT (não há TAGNT Name type; passo 4)');
});

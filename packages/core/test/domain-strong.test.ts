import { describe, expect, it } from 'vitest';
import { langOfStrong, parseStrong, strongBaseOf, testamentOfStrong } from '../src/domain';

describe('Strong (base, prefixo, sufixo)', () => {
  it('lê o sufixo estendido de 1Rs 15:15 (H0935P)', () => {
    expect(parseStrong('H0935P')).toEqual({
      raw: 'H0935P',
      base: 'H0935',
      prefix: 'H',
      number: 935,
      suffix: 'P',
    });
  });

  it('lê Strong do NT sem sufixo (Fp 2:7, G2758)', () => {
    expect(parseStrong('G2758')).toEqual({ raw: 'G2758', base: 'G2758', prefix: 'G', number: 2758, suffix: '' });
  });

  it('aceita sem zeros à esquerda e normaliza para 4 dígitos', () => {
    expect(parseStrong('h935p')?.raw).toBe('H0935P');
    expect(parseStrong('G235')?.base).toBe('G0235');
    expect(parseStrong(' G0235 ')?.raw).toBe('G0235');
  });

  it('rejeita o que não é Strong', () => {
    expect(parseStrong('')).toBeNull();
    expect(parseStrong('X1')).toBeNull();
    expect(parseStrong('G0')).toBeNull();
    expect(parseStrong('H12345')).toBeNull();
    expect(parseStrong('TR')).toBeNull();
  });

  it('base, testamento e língua pelo prefixo', () => {
    expect(strongBaseOf('H0935P')).toBe('H0935');
    expect(strongBaseOf('nada')).toBeNull();
    expect(testamentOfStrong('G2758')).toBe('NT');
    expect(testamentOfStrong('H0935P')).toBe('OT');
    expect(testamentOfStrong('zz')).toBeNull();
    expect(langOfStrong('G2758')).toBe('grc');
    // Aramaico também tem Strong com H: a língua vem da morfologia (langOfToken), não daqui.
    expect(langOfStrong('H4430')).toBe('hbo');
    expect(langOfStrong(parseStrong('G0235')!)).toBe('grc');
  });
});

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

  it('mesmos casos de pipeline/tests/test_strong.py', () => {
    // sufixo some da base, mesmo minúsculo como na fonte
    expect(strongBaseOf('H0935P')).toBe('H0935');
    expect(strongBaseOf('G2424G')).toBe('G2424');
    expect(strongBaseOf('H2148v')).toBe('H2148');
    // sem sufixo, fica igual
    expect(strongBaseOf('G5124')).toBe('G5124');
    expect(strongBaseOf('H0907')).toBe('H0907');
    // zeros à esquerda até 4 dígitos
    expect(strongBaseOf('G430')).toBe('G0430');
    expect(strongBaseOf('H7A')).toBe('H0007');
    // 5 dígitos ficam inteiros (TBESG tem G20001)
    expect(strongBaseOf('G20001')).toBe('G20001');
    expect(strongBaseOf('G20001A')).toBe('G20001');
    // partes
    expect(parseStrong('H0935P')).toMatchObject({ prefix: 'H', number: 935, suffix: 'P', raw: 'H0935P' });
    expect(parseStrong('G5124')).toMatchObject({ prefix: 'G', number: 5124, suffix: '', raw: 'G5124' });
    expect(parseStrong('H7A')?.raw).toBe('H0007A');
  });

  it('inválidos como no pipeline: null', () => {
    for (const bad of ['', 'G', 'X1234', 'g2424', 'G2424 ', ' G2424', 'G123456', '2424G', 'G-1', 'G2424\n', 'nope']) {
      expect(parseStrong(bad), bad).toBeNull();
    }
    expect(strongBaseOf('G123456')).toBeNull();
  });

  it('base, testamento e língua pelo prefixo', () => {
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

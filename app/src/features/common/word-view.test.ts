import { describe, expect, it } from 'vitest';
import type { LexiconEntry, Token } from '@sensus/core';
import { wordView } from './word-view';

const token = (over: Partial<Token>): Token => ({
  cite_id: 'tok:x',
  source_id: 'tagnt',
  corpus: 'gnt',
  vid: 50002005,
  pos: 1,
  surface: 'Ἰησοῦ',
  translit: null,
  lemma: null,
  strong: null,
  strong_base: null,
  morph: null,
  morph_desc: null,
  gloss_en: null,
  editions: 'TR',
  variant_note: null,
  alt_ref: null,
  ...over,
});

const entry = (source_id: string, key: string, strong_base: string): LexiconEntry => ({
  cite_id: `lex:${source_id}:${key}`,
  source_id,
  key,
  strong_base,
  lemma: null,
  translit: null,
  gloss: null,
  definition: `verbete ${key}`,
  lang: 'en',
});

// 1Rs 15:15 tem H0935P; o TBESH traz H0935G…P para a mesma base.
const hebrew = [entry('stepbible-tbesh', 'H0935G', 'H0935'), entry('stepbible-tbesh', 'H0935P', 'H0935')];
// Fp 2:5 (grego): TBESG e LSJ com a mesma base.
const greek = [
  entry('stepbible-tbesg', 'G2424G', 'G2424'),
  entry('stepbible-tbesg', 'G2424H', 'G2424'),
  entry('stepbible-tflsj', 'G2424G', 'G2424'),
];

describe('wordView (língua e testamento pelo domínio)', () => {
  it('AT hebraico (1Rs 15:15): TBESH, testamento AT e o verbete H0935P, sem LSJ', () => {
    const v = wordView(
      token({ corpus: 'hot', vid: 11015015, surface: 'וַיָּבֵא', morph: 'HVqw3ms', strong: 'H0935P', strong_base: 'H0935', source_id: 'tahot' }),
      'H0935',
      hebrew,
    );
    expect(v.lang).toBe('hbo');
    expect(v.testament).toBe('OT');
    expect(v.lexiconLabel).toBe('TBESH');
    expect(v.lex.primary?.key).toBe('H0935P');
    expect(v.lex.primary?.source_id).toBe('stepbible-tbesh');
    expect(v.lex.secondary).toBeNull();
  });

  it('AT aramaico (Dn 2:4, morfologia A…): língua arc, mesmo léxico TBESH, testamento AT', () => {
    const v = wordView(token({ corpus: 'hot', vid: 27002004, morph: 'ANcmpa', strong: 'H0935P', strong_base: 'H0935', source_id: 'tahot' }), 'H0935', hebrew);
    expect(v.lang).toBe('arc');
    expect(v.testament).toBe('OT');
    expect(v.lexiconLabel).toBe('TBESH');
    expect(v.lex.primary?.key).toBe('H0935P');
  });

  it('NT grego (Fp 2:5): TBESG com o verbete da forma, LSJ como complemento, testamento NT', () => {
    const v = wordView(token({ strong: 'G2424H', strong_base: 'G2424', morph: 'N-GSM-P' }), 'G2424', greek);
    expect(v.lang).toBe('grc');
    expect(v.testament).toBe('NT');
    expect(v.lexiconLabel).toBe('TBESG');
    expect(v.lex.primary?.key).toBe('G2424H');
    expect(v.lex.primary?.source_id).toBe('stepbible-tbesg');
    expect(v.lex.secondary?.source_id).toBe('stepbible-tflsj');
  });

  it('lema sem token (só o strong_base do AT): testamento e rótulo do AT, primeiro verbete da base', () => {
    const v = wordView(null, 'H0935', hebrew);
    expect(v.lang).toBe('hbo');
    expect(v.testament).toBe('OT');
    expect(v.lexiconLabel).toBe('TBESH');
    expect(v.lex.primary?.key).toBe('H0935G');
  });

  it('Strong que não é grego nem hebraico: sem língua, sem testamento, sem verbete', () => {
    const v = wordView(null, 'X1234', greek);
    expect(v).toEqual({ lang: null, testament: null, lexiconLabel: '', lex: { primary: null, secondary: null } });
  });

  it('verbete de outra língua nunca aparece (grego sem entrada grega não pega TBESH)', () => {
    const v = wordView(token({ strong: 'G2424H', strong_base: 'G2424' }), 'G2424', [entry('stepbible-tbesh', 'H0935P', 'H0935')]);
    expect(v.lex.primary).toBeNull();
  });
});

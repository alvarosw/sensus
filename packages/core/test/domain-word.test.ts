import { describe, expect, it } from 'vitest';
import type { Token } from '../src/types';
import { wordFacts } from '../src/domain';

function tok(p: Partial<Token> & Pick<Token, 'corpus' | 'surface' | 'morph'>): Token {
  return {
    cite_id: 'tok:x',
    source_id: 'x',
    vid: 0,
    pos: 1,
    translit: null,
    lemma: null,
    strong: null,
    strong_base: null,
    morph_desc: null,
    gloss_en: null,
    editions: '',
    variant_note: null,
    alt_ref: null,
    ...p,
  };
}

describe('fatos da palavra (wordFacts)', () => {
  it('NT grego: ἐκένωσεν (Fp 2:7, G2758)', () => {
    const f = wordFacts(
      tok({
        corpus: 'gnt',
        surface: 'ἐκένωσεν',
        morph: 'V-AAI-3S',
        morph_desc: 'Verb; Tense=Aorist',
        strong: 'G2758',
        strong_base: 'G2758',
      }),
    );
    expect(f).toEqual({
      lang: 'grc',
      testament: 'NT',
      strong: { raw: 'G2758', base: 'G2758', prefix: 'G', number: 2758, suffix: '' },
      lexiconLabel: 'TBESG',
      script: 'greek',
      dir: 'ltr',
      isContent: true,
      isVerb: true,
      isProperName: false,
    });
  });

  it('AT hebraico: וַיָּבֵא (1Rs 15:15, H0935P)', () => {
    const f = wordFacts(
      tok({ corpus: 'hot', surface: 'וַיָּבֵא', morph: 'Hc/Vhw3ms', strong: 'H0935P', strong_base: 'H0935' }),
    );
    expect(f.lang).toBe('hbo');
    expect(f.testament).toBe('OT');
    expect(f.strong?.raw).toBe('H0935P');
    expect(f.lexiconLabel).toBe('TBESH');
    expect(f.script).toBe('hebrew');
    expect(f.dir).toBe('rtl');
    expect(f.isContent).toBe(true);
    expect(f.isVerb).toBe(true);
  });

  it('AT hebraico: partícula de objeto אֶת־ (HTo) não é conteúdo', () => {
    const f = wordFacts(tok({ corpus: 'hot', surface: 'אֶת־', morph: 'HTo', strong: 'H0853', strong_base: 'H0853' }));
    expect(f.isContent).toBe(false);
    expect(f.lexiconLabel).toBe('TBESH');
  });

  it('aramaico (Dn 2:4): מַלְכָּא é arc, sem ser lido como grego', () => {
    const f = wordFacts(
      tok({ corpus: 'hot', surface: 'מַלְכָּא', morph: 'ANcbsd/Ta', strong: 'H4430', strong_base: 'H4430' }),
    );
    expect(f.lang).toBe('arc');
    expect(f.testament).toBe('OT');
    expect(f.lexiconLabel).toBe('TBESH');
    expect(f.dir).toBe('rtl');
    expect(f.isContent).toBe(true);
    expect(f.isVerb).toBe(false);
  });

  it('sem Strong, o campo vem nulo', () => {
    expect(wordFacts(tok({ corpus: 'gnt', surface: 'ἀλλ᾽', morph: 'CONJ' })).strong).toBeNull();
  });
});

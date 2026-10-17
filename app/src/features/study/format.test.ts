// Formatação da folha de estudo: palavras-chave nos dois testamentos (grego do NT e hebraico do AT), verbete pelo
// sufixo do Strong, e textos que recebem o Testament (nunca um booleano).
import { describe, expect, it } from 'vitest';
import type { PanelData, Token } from '@sensus/core';
import { isKeyToken, keyWordsOf, lexiconOfToken } from './format';
import { STUDY } from './strings';

const BASE = { translit: null, lemma: null, strong: null, strong_base: null, morph_desc: null, gloss_en: null, variant_note: null, alt_ref: null, source_id: 'x' };

function tok(over: Partial<Token> & Pick<Token, 'cite_id' | 'pos' | 'surface' | 'editions' | 'corpus' | 'vid'>): Token {
  return { ...BASE, morph: 'N-NSM', ...over } as Token;
}

function panelOf(tokens: Token[], lexicon: unknown[] = [], concordance: Record<string, { count: number; samples: [] }> = {}): PanelData {
  return {
    range: { start: tokens[0]?.vid ?? 0, end: tokens[0]?.vid ?? 0 },
    reference: '',
    layers: {
      text: { translations: [], original: tokens, variants: [] },
      language: { lexicon: lexicon as never[], concordance },
    },
    sources: {},
  } as unknown as PanelData;
}

// ---- NT grego (Fp 2:5-8, TAGNT) -----------------------------------------------------------------------------

const KENOSIS = tok({
  cite_id: 'tok:gnt:50002007:1',
  corpus: 'gnt',
  vid: 50002007,
  pos: 1,
  surface: 'ἐκένωσεν',
  editions: 'TR,BYZ,NA',
  strong: 'G2758',
  strong_base: 'G2758',
  lemma: 'κενόω',
  morph: 'V-AAI-3S',
  morph_desc: 'Verb; Tense=Aorist; Voice=Active; Mood=Indicative',
});
const GREEK_VARIANT_ONLY_WH = { ...KENOSIS, cite_id: 'tok:gnt:50002007:9', pos: 9, editions: 'WH' };
const GREEK_NA = { ...KENOSIS, cite_id: 'tok:gnt:50002007:8', pos: 8, editions: 'NA', strong: 'G2758', strong_base: 'G2758' };

// ---- AT hebraico (1Rs 15:15, TAHOT) ---------------------------------------------------------------------------

const VAYA = tok({
  cite_id: 'tok:hot:11015015:1',
  corpus: 'hot',
  vid: 11015015,
  pos: 1,
  surface: 'וַיָּבֵא֙',
  editions: 'L',
  strong: 'H0935P',
  strong_base: 'H0935',
  lemma: 'בּוֹא',
  morph: 'Hc/Vhw3ms',
  morph_desc: 'Consecutive Conjunction + Verb',
});
const ET = tok({ cite_id: 'tok:hot:11015015:2', corpus: 'hot', vid: 11015015, pos: 2, surface: 'אֶת־', editions: 'L', strong: 'H0853', strong_base: 'H0853', morph: 'HTo', morph_desc: 'Object indicator' });
const YHWH = tok({ cite_id: 'tok:hot:11015015:7', corpus: 'hot', vid: 11015015, pos: 7, surface: 'יְהוָ֑ה', editions: 'L', strong: 'H3068G', strong_base: 'H3068', morph: 'HNpt', morph_desc: 'Proper Noun (Title)' });
const QERE = tok({ cite_id: 'tok:hot:11015015:5', corpus: 'hot', vid: 11015015, pos: 5, surface: 'קָדְשֵׁ֖י', editions: 'Q', strong: 'H6944G', strong_base: 'H6944', morph: 'HC/Ncmpc' });

const LEX_H0935G = { cite_id: 'lex:H0935G', source_id: 'stepbible-tbesh', key: 'H0935G', strong_base: 'H0935', lemma: 'בּוֹא', translit: 'bo', gloss: 'to come', definition: '', lang: 'en' };
const LEX_H0935P = { cite_id: 'lex:H0935P', source_id: 'stepbible-tbesh', key: 'H0935P', strong_base: 'H0935', lemma: 'לְהָבִיא', translit: 'lehavi', gloss: 'to bring', definition: '', lang: 'en' };
const LEX_G2758 = { cite_id: 'lex:G2758', source_id: 'stepbible-tbesg', key: 'G2758', strong_base: 'G2758', lemma: 'κενόω', translit: 'kenoō', gloss: 'to empty', definition: '', lang: 'en' };

describe('isKeyToken: palavra-chave pelo domínio (edições-base e conteúdo)', () => {
  it('NT: presente em TR, BYZ ou NA conta; só WH (variante) não', () => {
    expect(isKeyToken(KENOSIS)).toBe(true);
    expect(isKeyToken(GREEK_NA)).toBe(true);
    expect(isKeyToken(GREEK_VARIANT_ONLY_WH)).toBe(false);
  });

  it('AT: a edição-base é L; o Qere (só Q) não conta, a forma com L conta', () => {
    expect(isKeyToken(VAYA)).toBe(true);
    expect(isKeyToken(QERE)).toBe(false);
  });

  it('AT: partícula (HTo) é função e não conta; nome próprio conta aqui (quem exclui é o fallback)', () => {
    expect(isKeyToken(ET)).toBe(false);
    expect(isKeyToken(YHWH)).toBe(true);
  });
});

describe('keyWordsOf: testamento e verbete por token', () => {
  it('AT: o verbete é o do próprio Strong (H0935P recebe H0935P, não H0935G) e o testamento é OT', () => {
    const panel = panelOf([VAYA], [LEX_H0935G, LEX_H0935P], { H0935: { count: 2308, samples: [] } });
    const [word] = keyWordsOf(panel);
    expect(word).toMatchObject({ strongBase: 'H0935', count: 2308, testament: 'OT' });
    expect(word?.lexicon?.key).toBe('H0935P');
  });

  it('NT: testamento NT, verbete do TBESG pela base quando não há sufixo', () => {
    const panel = panelOf([KENOSIS], [LEX_G2758], { G2758: { count: 5, samples: [] } });
    const [word] = keyWordsOf(panel);
    expect(word).toMatchObject({ strongBase: 'G2758', count: 5, testament: 'NT' });
    expect(word?.lexicon?.key).toBe('G2758');
  });

  it('a palavra de um verbete de outra língua não aparece (G não pega H)', () => {
    expect(lexiconOfToken(panelOf([VAYA], [LEX_G2758]), VAYA)).toBeNull();
  });

  it('um Qere não entra na lista: a palavra só existe na forma-base', () => {
    const panel = panelOf([QERE, VAYA]);
    expect(keyWordsOf(panel).map((w) => w.strongBase)).toEqual(['H0935']);
  });
});

describe('textos com Testament (STUDY)', () => {
  it('contagem no testamento: singular e plural, NT e AT', () => {
    expect(STUDY.factVv(1, 'NT')).toBe('1 versículo no NT');
    expect(STUDY.factVv(5, 'NT')).toBe('5 vv. no NT');
    expect(STUDY.factVv(2308, 'OT')).toBe('2308 vv. no AT');
  });

  it('hápax no testamento da palavra', () => {
    expect(STUDY.factHapax('NT')).toBe('hápax no NT');
    expect(STUDY.factHapax('OT')).toBe('hápax no AT');
  });
});

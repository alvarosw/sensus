// Modelo da prévia da folha: fatos (comentaristas sem introduções, variantes, referências, palavra rara e hápax)
// e escopo da perícope. NT grego (Fp 2:5-8) e AT hebraico (1Rs 15:15).
import { describe, expect, it } from 'vitest';
import type { Commentary, PanelData, Source, Token, XRef } from '@sensus/core';
import { peekFacts, peekScope, unitStartOf } from './peek-model';

const BASE = { translit: null, lemma: null, strong: null, strong_base: null, morph_desc: null, gloss_en: null, variant_note: null, alt_ref: null, source_id: 'x' };

function tok(over: Partial<Token> & Pick<Token, 'cite_id' | 'pos' | 'surface' | 'editions' | 'corpus' | 'vid'>): Token {
  return { ...BASE, morph: 'N-NSM', ...over } as Token;
}

function com(cite_id: string, source_id: string, vid: number, text = 'comentário'): Commentary {
  return { cite_id, source_id, start_vid: vid, end_vid: vid, text } as Commentary;
}

function panelOf(p: {
  tokens: Token[];
  commentaries?: Commentary[];
  sources?: Record<string, Source>;
  xrefs?: XRef[];
  concordance?: Record<string, { count: number; samples: [] }>;
}): PanelData {
  return {
    range: { start: p.tokens[0]?.vid ?? 0, end: p.tokens[0]?.vid ?? 0 },
    reference: '',
    layers: {
      text: { translations: [], original: p.tokens, variants: [] },
      language: { lexicon: [], concordance: p.concordance ?? {} },
      interpretation: { commentaries: p.commentaries ?? [] },
      intertext: { xrefs: p.xrefs ?? [] },
    },
    sources: p.sources ?? {},
  } as unknown as PanelData;
}

const SOURCES: Record<string, Source> = {
  'fixture-com-a': { id: 'fixture-com-a', author: 'Autor A (1800)', title: 'Comentário A' } as Source,
};

// ---- NT grego (Fp 2:5-8, TAGNT) -----------------------------------------------------------------------------

const VID_NT = 50002007;
/** ἐκένωσεν: presente em TR, BYZ e NA (âncora); hápax no NT na fixture. */
const KENOSIS = tok({
  cite_id: 'tok:gnt:50002007:1',
  corpus: 'gnt',
  vid: VID_NT,
  pos: 1,
  surface: 'ἐκένωσεν',
  editions: 'TR,BYZ,NA',
  strong: 'G2758',
  strong_base: 'G2758',
  lemma: 'κενόω',
  morph: 'V-AAI-3S',
});
/** Presente em TR e BYZ, omitida na NA: não é âncora e forma um sítio de variante. */
const OMITTED_NA = tok({ ...KENOSIS, cite_id: 'tok:gnt:50002007:9', pos: 9, editions: 'TR,BYZ', strong_base: 'G9999', strong: 'G9999' });

describe('peekFacts no NT grego (Fp 2:5-8)', () => {
  it('conta comentaristas distintos e deixa de fora as introduções', () => {
    const facts = peekFacts(
      panelOf({
        tokens: [KENOSIS],
        sources: SOURCES,
        commentaries: [
          com('com:1', 'fixture-com-a', VID_NT),
          com('com:2', 'fixture-com-a', VID_NT + 1),
          com('com:3', 'fixture-com-b', VID_NT),
          com('com:intro', 'fixture-com-c', 50000000),
        ],
      }),
    );
    expect(facts.authors).toBe(2);
  });

  it('variantes: a palavra omitida numa edição-base forma um sítio, com as edições do domínio', () => {
    const facts = peekFacts(panelOf({ tokens: [KENOSIS, OMITTED_NA] }));
    expect(facts.variants).toEqual({ count: 1, editions: 'TR/BYZ/NA' });
  });

  it('sem variação no NT: o fato existe e vale 0', () => {
    expect(peekFacts(panelOf({ tokens: [KENOSIS] })).variants).toEqual({ count: 0, editions: 'TR/BYZ/NA' });
  });

  it('hápax no NT: a palavra em destaque é a única ocorrência, com testamento NT', () => {
    const facts = peekFacts(panelOf({ tokens: [KENOSIS], concordance: { G2758: { count: 1, samples: [] } } }));
    expect(facts.hapax).toBe(true);
    expect(facts.word).toMatchObject({ strongBase: 'G2758', count: 1, testament: 'NT' });
  });

  it('palavra comum no NT não é hápax', () => {
    const facts = peekFacts(panelOf({ tokens: [KENOSIS], concordance: { G2758: { count: 5, samples: [] } } }));
    expect(facts.hapax).toBe(false);
    expect(facts.word).toMatchObject({ strongBase: 'G2758', count: 5, testament: 'NT' });
  });
});

// ---- AT hebraico (1Rs 15:15, TAHOT) -------------------------------------------------------------------------

const VID_AT = 11015015;
/** וַיָּבֵא֙: verbo de alta frequência no AT. */
const VAYA = tok({
  cite_id: 'tok:hot:11015015:1',
  corpus: 'hot',
  vid: VID_AT,
  pos: 1,
  surface: 'וַיָּבֵא֙',
  editions: 'L',
  strong: 'H0935P',
  strong_base: 'H0935',
  lemma: 'בּוֹא',
  morph: 'Hc/Vhw3ms',
});
/** Qere de hápax no AT: a leitura que os tradutores seguem também conta. */
const QERE = tok({ cite_id: 'tok:hot:11015015:5', corpus: 'hot', vid: VID_AT, pos: 5, surface: 'קָדְשֵׁ֖י', editions: 'Q', strong: 'H6944G', strong_base: 'H6944', morph: 'HC/Ncmpc' });

describe('peekFacts no AT hebraico (1Rs 15:15)', () => {
  it('no AT não há fato de variantes (nem zero), mesmo com Qere', () => {
    expect(peekFacts(panelOf({ tokens: [VAYA, QERE] })).variants).toBeNull();
  });

  it('trecho que atravessa testamentos: o fato de variantes vale para o NT', () => {
    const range = { start: 11015015, end: 50002007 };
    const facts = peekFacts({ ...panelOf({ tokens: [KENOSIS, OMITTED_NA] }), range } as PanelData);
    expect(facts.variants).toEqual({ count: 1, editions: 'TR/BYZ/NA' });
  });

  it('hápax no AT: o Qere raro vence a palavra comum, com testamento OT', () => {
    const facts = peekFacts(
      panelOf({ tokens: [VAYA, QERE], concordance: { H0935: { count: 2308, samples: [] }, H6944: { count: 1, samples: [] } } }),
    );
    expect(facts.hapax).toBe(true);
    expect(facts.word).toMatchObject({ strongBase: 'H6944', count: 1, testament: 'OT' });
  });

  it('palavra frequente no AT: escolhe a palavra com testamento OT e não marca hápax', () => {
    const facts = peekFacts(panelOf({ tokens: [VAYA], concordance: { H0935: { count: 2308, samples: [] } } }));
    expect(facts.hapax).toBe(false);
    expect(facts.word).toMatchObject({ strongBase: 'H0935', count: 2308, testament: 'OT' });
  });

  it('referências cruzadas: conta as do trecho', () => {
    const xref = { cite_id: 'xr:1' } as XRef;
    expect(peekFacts(panelOf({ tokens: [VAYA], xrefs: [xref, xref] })).xrefs).toBe(2);
  });
});

// ---- escopo da perícope ---------------------------------------------------------------------------------------

describe('unitStartOf e peekScope', () => {
  it('introdução do livro (x:0) começa no 1:1, no NT e no AT', () => {
    expect(unitStartOf(50000000)).toBe(50001001);
    expect(unitStartOf(11000000)).toBe(11001001);
  });

  it('versículo comum não muda', () => {
    expect(unitStartOf(VID_NT)).toBe(VID_NT);
    expect(unitStartOf(VID_AT)).toBe(VID_AT);
  });

  it('sem perícope: sem início e sem "perícope inteira"', () => {
    expect(peekScope({ start: VID_AT, end: VID_AT }, null)).toEqual({ unitStart: null, whole: false });
  });

  it('seleção que cobre a perícope inteira (começando na introdução do livro)', () => {
    const range = { start: 50001001, end: 50002008 };
    expect(peekScope(range, { start: 50000000, end: 50002008 })).toEqual({ unitStart: 50001001, whole: true });
  });

  it('seleção parcial da perícope: início da perícope e não inteira', () => {
    const range = { start: 50001001, end: 50001003 };
    expect(peekScope(range, { start: 50000000, end: 50002008 })).toEqual({ unitStart: 50001001, whole: false });
  });
});

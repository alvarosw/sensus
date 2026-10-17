// Palavra que move o trecho no AT hebraico (1Rs 15:15, fixtures-ot.ts): verbete pelo sufixo do Strong, partícula
// de função, nome próprio fora dos fallbacks, Qere fora das edições-base. O NT grego está em thread.test.ts.
import { describe, expect, it } from 'vitest';
import type { PanelData, Token, VerseText } from '@sensus/core';
import { buildThread, type ThreadAi, type ThreadStep } from './thread';
import { chooseKeyWord } from './keyword';

const RANGE_AT = { start: 11015015, end: 11015015 };
const DONE: ThreadAi = { status: 'done', summary: null };

const AT = { source_id: 'tahot', corpus: 'hot' as const, vid: 11015015, translit: null, lemma: null, strong: null, strong_base: null, morph_desc: null, gloss_en: null, variant_note: null, alt_ref: null };

function tok(over: Partial<Token> & Pick<Token, 'cite_id' | 'pos' | 'surface' | 'editions'>): Token {
  return { ...AT, morph: 'HNcmsa', ...over } as Token;
}

/** וַיָּבֵא֙: verbo com sufixo P (o verbete é H0935P, não H0935G). */
const VAYA = tok({
  cite_id: 'tok:hot:11015015:1',
  pos: 1,
  surface: 'וַיָּבֵא֙',
  editions: 'L',
  strong: 'H0935P',
  strong_base: 'H0935',
  lemma: 'בּוֹא',
  translit: "vai.ya.Ve'",
  gloss_en: 'and he brought',
  morph: 'Hc/Vhw3ms',
  morph_desc: 'Consecutive Conjunction + Verb : Hiphil Consecutive Imperfect Third Singular Masculine',
});
/** אֶת־: partícula de objeto (HTo), função: não é palavra de conteúdo. */
const ET = tok({
  cite_id: 'tok:hot:11015015:2',
  pos: 2,
  surface: 'אֶת־',
  editions: 'L',
  strong: 'H0853',
  strong_base: 'H0853',
  lemma: 'אֵת',
  gloss_en: '<obj.>',
  morph: 'HTo',
  morph_desc: 'Object indicator',
});
/** יְהוָה: nome próprio no AT (HNpt), que os fallbacks não escolhem. */
const YHWH = tok({
  cite_id: 'tok:hot:11015015:7',
  pos: 7,
  surface: 'יְהוָ֑ה',
  editions: 'L',
  strong: 'H3068G',
  strong_base: 'H3068',
  lemma: 'יהוה',
  gloss_en: 'Yahweh',
  morph: 'HNpt',
  morph_desc: 'Proper Noun (Title)',
});
/** קָדְשֵׁי: substantivo com Strong de base única. */
const KODESH = tok({
  cite_id: 'tok:hot:11015015:3',
  pos: 3,
  surface: 'קָדְשֵׁ֣י',
  editions: 'L',
  strong: 'H6944G',
  strong_base: 'H6944',
  lemma: 'קֹ֫דֶשׁ',
  gloss_en: '[the] holy things of',
  morph: 'HNcmpc',
  morph_desc: 'Noun (Plural Masculine, Construct)',
});
/** A mesma forma como Qere: só na edição Q, fora das edições-base. */
const KODESH_QERE = { ...KODESH, cite_id: 'tok:hot:11015015:5', pos: 5, editions: 'Q' };

/** Verbetes de H0935: o de sufixo G (não é a forma) e o de sufixo P (é). */
const LEX_H0935G = { cite_id: 'lex:H0935G', source_id: 'stepbible-tbesh', key: 'H0935G', strong_base: 'H0935', lemma: 'בּוֹא', translit: 'bo', gloss: 'to come', definition: '', lang: 'en' };
const LEX_H0935P = { cite_id: 'lex:H0935P', source_id: 'stepbible-tbesh', key: 'H0935P', strong_base: 'H0935', lemma: 'לְהָבִיא', translit: 'lehavi', gloss: 'to bring', definition: '', lang: 'en' };

function panelOf(p: { tokens: Token[]; lexicon?: unknown[]; concordance?: Record<string, { count: number; samples: VerseText[] }> }): PanelData {
  return {
    range: RANGE_AT,
    reference: '1 Reis 15:15',
    layers: {
      text: { translations: [], original: p.tokens, variants: [] },
      literary: { before: [], after: [], divisions: [], bookIntro: [] },
      historical: { entities: [], dictionary: [] },
      language: { lexicon: (p.lexicon ?? []) as never[], concordance: p.concordance ?? {} },
      intertext: { xrefs: [], topics: [] },
      interpretation: { commentaries: [] },
    },
    sources: {},
  } as unknown as PanelData;
}

function lingua(steps: ThreadStep[]) {
  return steps.find((s) => s.lens === 'lingua')?.evidence;
}

describe('Língua no AT hebraico: 1Rs 15:15 (TAHOT e TBESH)', () => {
  it('a IA escolheu o verbo: verbete pelo sufixo (H0935P), contagem no AT', () => {
    const panel = panelOf({ tokens: [VAYA], lexicon: [LEX_H0935G, LEX_H0935P], concordance: { H0935: { count: 2308, samples: [] } } });
    const ai: ThreadAi = { status: 'streaming', summary: { overview: [], sections: {}, questions: [], complete: false, keyWordCiteId: VAYA.cite_id } };
    expect(lingua(buildThread({ panel, range: RANGE_AT, books: [], ai }))).toMatchObject({
      kind: 'word',
      tokenCiteId: VAYA.cite_id,
      lemma: 'לְהָבִיא',
      gloss: 'to bring',
      note: '2308 vv. no AT',
      by: 'ai',
    });
  });

  it('o nome próprio do AT fica fora do hápax; o verbo vence', () => {
    const panel = panelOf({
      tokens: [YHWH, VAYA],
      concordance: { H3068: { count: 1, samples: [] }, H0935: { count: 2308, samples: [] } },
    });
    expect(lingua(buildThread({ panel, range: RANGE_AT, books: [], ai: DONE }))).toMatchObject({ tokenCiteId: VAYA.cite_id, by: 'verb' });
  });

  it('nome próprio do AT pode ser escolhido pela IA (by "ai")', () => {
    const panel = panelOf({ tokens: [YHWH], concordance: { H3068: { count: 1, samples: [] } } });
    const choice = chooseKeyWord(panel, RANGE_AT, { active: true, keyWordCiteId: YHWH.cite_id, linguaCiteIds: [], linguaDone: false });
    expect(choice).toMatchObject({ state: 'picked', pick: { token: { cite_id: YHWH.cite_id }, by: 'ai' } });
  });

  it('hápax do AT: a nota é "hápax" e o token é o de conteúdo raro', () => {
    const panel = panelOf({
      tokens: [VAYA, KODESH],
      concordance: { H0935: { count: 2308, samples: [] }, H6944: { count: 1, samples: [] } },
    });
    expect(lingua(buildThread({ panel, range: RANGE_AT, books: [], ai: DONE }))).toMatchObject({ tokenCiteId: KODESH.cite_id, note: 'hápax', by: 'hapax' });
  });

  it('partícula de objeto (HTo) não é palavra do trecho: sem escolha, o passo some', () => {
    const panel = panelOf({ tokens: [ET], concordance: { H0853: { count: 3000, samples: [] } } });
    expect(lingua(buildThread({ panel, range: RANGE_AT, books: [], ai: DONE }))).toBeUndefined();
  });

  it('Qere (só na edição Q) não é palavra-chave: sem ele, o passo some', () => {
    const panel = panelOf({ tokens: [KODESH_QERE], concordance: { H6944: { count: 1, samples: [] } } });
    expect(lingua(buildThread({ panel, range: RANGE_AT, books: [], ai: DONE }))).toBeUndefined();
  });
});

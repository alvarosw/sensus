// Texto original por testamento: escolha do corpus (NT grego, AT hebraico), intervalo de cada testamento, palavras
// do original por versículo e legenda das edições do AT.
import { describe, expect, it } from 'vitest';
import type { Token } from '../src/types';
import {
  corpusOfTestament,
  corpusOfVid,
  editionLegend,
  originalTextOf,
  originalTokensByVid,
  packVid,
  testamentRange,
} from '../src/domain';

const BASE = {
  translit: null,
  lemma: null,
  strong: null,
  strong_base: null,
  morph: null,
  morph_desc: null,
  gloss_en: null,
  variant_note: null,
  alt_ref: null,
  source_id: 'x',
};

function tok(over: Partial<Token> & Pick<Token, 'cite_id' | 'corpus' | 'vid' | 'pos' | 'surface' | 'editions'>): Token {
  return { ...BASE, ...over } as Token;
}

const FP_2_5 = packVid(50, 2, 5);
const RS_15_15 = packVid(11, 15, 15);

describe('escolha do original por testamento', () => {
  it('NT: corpus gnt e fonte TR; AT: corpus hot e fonte WLC', () => {
    expect(corpusOfTestament('NT')).toBe('gnt');
    expect(corpusOfTestament('OT')).toBe('hot');
    expect(corpusOfVid(FP_2_5)).toBe('gnt');
    expect(corpusOfVid(RS_15_15)).toBe('hot');
    expect(originalTextOf('NT')).toBe('grc-tr');
    expect(originalTextOf('OT')).toBe('hbo-wlc');
  });

  it('intervalo de cada testamento: 1:1 de Gênesis até o último de Malaquias, e de Mateus até Apocalipse', () => {
    expect(testamentRange('OT')).toEqual({ start: packVid(1, 1, 1), end: packVid(39, 4, 999) });
    expect(testamentRange('NT')).toEqual({ start: packVid(40, 1, 1), end: packVid(66, 22, 999) });
  });
});

describe('palavras do original por versículo', () => {
  const NT_TOKENS = [
    tok({ cite_id: 'tok:gnt:a', corpus: 'gnt', vid: FP_2_5, pos: 2, surface: 'ὃς', editions: 'TR,BYZ,NA' }),
    tok({ cite_id: 'tok:gnt:b', corpus: 'gnt', vid: FP_2_5, pos: 1, surface: 'τοῦτο', editions: 'TR,BYZ,NA' }),
    // só na BYZ: não é do texto da TR, então não entra no original
    tok({ cite_id: 'tok:gnt:c', corpus: 'gnt', vid: FP_2_5, pos: 3, surface: 'ἐν', editions: 'BYZ' }),
  ];

  it('NT: só a palavra da edição TR, em ordem de posição', () => {
    const m = originalTokensByVid(NT_TOKENS);
    expect(m.get(FP_2_5)?.map((t) => t.surface)).toEqual(['τοῦτο', 'ὃς']);
  });

  const AT_TOKENS = [
    tok({ cite_id: 'tok:hot:2', corpus: 'hot', vid: RS_15_15, pos: 2, surface: 'אֵת', editions: 'L', morph: 'HTo' }),
    tok({ cite_id: 'tok:hot:1', corpus: 'hot', vid: RS_15_15, pos: 1, surface: 'וַיָּבֵא', editions: 'L', morph: 'HC/Vqw3ms' }),
    tok({ cite_id: 'tok:hot:5', corpus: 'hot', vid: RS_15_15, pos: 5, surface: 'קָדְשֵׁ֖י', editions: 'Q', morph: 'HC/Ncmpc' }),
  ];

  it('AT: as palavras hebraicas do versículo, incluindo o Qere, em ordem; nenhuma do grego', () => {
    const m = originalTokensByVid([...AT_TOKENS, ...NT_TOKENS]);
    expect(m.get(RS_15_15)?.map((t) => t.cite_id)).toEqual(['tok:hot:1', 'tok:hot:2', 'tok:hot:5']);
    expect(m.has(FP_2_5)).toBe(true);
    expect(m.get(FP_2_5)?.every((t) => t.corpus === 'gnt')).toBe(true);
  });

  it('token de um corpus que não é o do testamento do versículo fica de fora', () => {
    const wrong = tok({ cite_id: 'tok:hot:x', corpus: 'hot', vid: FP_2_5, pos: 1, surface: 'x', editions: 'L' });
    expect(originalTokensByVid([wrong]).size).toBe(0);
  });
});

describe('legenda das edições do AT', () => {
  it('nomeia L, Q e K em ordem; sem letra conhecida, não há legenda', () => {
    expect(editionLegend(['L', 'Q', 'K'])).toBe('L = Leningrado · Q = Qere · K = Ketiv');
    expect(editionLegend(['Q'])).toBe('Q = Qere');
    expect(editionLegend(['TR', 'BYZ', 'NA'])).toBe('');
    expect(editionLegend([])).toBe('');
  });
});

import { describe, expect, it } from 'vitest';
import {
  CORPUS,
  corpusOfCiteId,
  editionsOf,
  hasEditionVariants,
  isBaseTextToken,
  langOfToken,
  testamentLabel,
  testamentOfBook,
  testamentOfCorpus,
  testamentOfVid,
} from '../src/domain';

describe('língua e testamento (NT grego e AT hebraico/aramaico)', () => {
  it('descreve os dois corpora', () => {
    expect(CORPUS.gnt).toEqual({
      testament: 'NT',
      langs: ['grc'],
      tokensSource: 'tagnt',
      baseEditions: ['TR', 'BYZ', 'NA'],
      textEdition: 'TR',
      interlinearText: 'grc-tr',
    });
    expect(CORPUS.hot).toEqual({
      testament: 'OT',
      langs: ['hbo', 'arc'],
      tokensSource: 'tahot',
      baseEditions: ['L'],
      textEdition: null,
      interlinearText: 'hbo-wlc',
    });
  });

  it('texto-base por corpus: no NT só o que está no TR; no AT, todas as palavras', () => {
    // Fp 2:7 (grego): palavra só no BYZ é variante, não texto-base
    expect(isBaseTextToken({ corpus: 'gnt', editions: 'TR,BYZ,NA' })).toBe(true);
    expect(isBaseTextToken({ corpus: 'gnt', editions: 'BYZ,NA' })).toBe(false);
    // 1Rs 15:15 (hebraico): edições 'L' e Qere 'Q' entram; sem edição nenhuma também
    expect(isBaseTextToken({ corpus: 'hot', editions: 'L' })).toBe(true);
    expect(isBaseTextToken({ corpus: 'hot', editions: 'Q' })).toBe(true);
    expect(isBaseTextToken({ corpus: 'hot', editions: '' })).toBe(true);
  });

  it('só o grego tem variantes entre edições-base; as edições de uma palavra são um conjunto', () => {
    expect(hasEditionVariants('gnt')).toBe(true);
    expect(hasEditionVariants('hot')).toBe(false);
    expect([...editionsOf({ editions: 'TR, BYZ,,NA' })]).toEqual(['TR', 'BYZ', 'NA']);
    expect(editionsOf({ editions: '' }).size).toBe(0);
  });

  it('testamento de livro pela tabela de livros', () => {
    expect(testamentOfBook(40)).toBe('NT'); // Mateus
    expect(testamentOfBook(50)).toBe('NT'); // Filipenses
    expect(testamentOfBook(11)).toBe('OT'); // 1 Reis
    expect(testamentOfBook(27)).toBe('OT'); // Daniel
    expect(() => testamentOfBook(67)).toThrow(RangeError);
  });

  it('testamento de vid, de corpus e rótulo', () => {
    expect(testamentOfVid(50002007)).toBe('NT'); // Fp 2:7
    expect(testamentOfVid(11015015)).toBe('OT'); // 1Rs 15:15
    expect(testamentOfCorpus('gnt')).toBe('NT');
    expect(testamentOfCorpus('hot')).toBe('OT');
    expect(testamentLabel('OT')).toBe('AT');
    expect(testamentLabel('NT')).toBe('NT');
  });

  it('língua do token: grego no NT; no AT, aramaico pelo A inicial da morfologia', () => {
    expect(langOfToken({ corpus: 'gnt', morph: 'V-AAI-3S' })).toBe('grc');
    // 1Rs 15:15, pos 1: וַיָּבֵא, Hc/Vhw3ms
    expect(langOfToken({ corpus: 'hot', morph: 'Hc/Vhw3ms' })).toBe('hbo');
    // Dn 2:4, pos 4 (hebraico, ainda antes do aramaico): HAafsc
    expect(langOfToken({ corpus: 'hot', morph: 'HAafsc' })).toBe('hbo');
    // Dn 2:4, pos 5: מַלְכָּא, ANcbsd/Ta
    expect(langOfToken({ corpus: 'hot', morph: 'ANcbsd/Ta' })).toBe('arc');
    // Dn 2:4, pos 7: חֱיִ, AVqv2ms
    expect(langOfToken({ corpus: 'hot', morph: 'AVqv2ms' })).toBe('arc');
    expect(langOfToken({ corpus: 'hot', morph: null })).toBe('hbo');
  });

  it('lê o corpus de um cite_id de token', () => {
    expect(corpusOfCiteId('tok:gnt:50002007:30')).toBe('gnt');
    expect(corpusOfCiteId('tok:hot:11015015:1')).toBe('hot');
    expect(corpusOfCiteId('txt:blivre:50002007')).toBeNull();
  });
});

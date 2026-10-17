import { describe, expect, it } from 'vitest';
import { isContentTokenByLang, isProperNameToken, isVerbToken, mainSegmentOf } from '../src/domain';
import { isContentToken } from '../src/domain/morph';

describe('morfologia: conteúdo, verbo e nome próprio por língua', () => {
  it('grego (Fp 2:7): ἐκένωσεν é verbo de conteúdo; ἀλλ᾽ é conjunção', () => {
    const verb = { corpus: 'gnt' as const, morph: 'V-AAI-3S', morph_desc: 'Verb; Tense=Aorist' };
    expect(isContentToken(verb)).toBe(true);
    expect(isVerbToken(verb)).toBe(true);
    expect(isProperNameToken(verb)).toBe(false);

    const conj = { corpus: 'gnt' as const, morph: 'CONJ', morph_desc: 'Conjunction' };
    expect(isContentToken(conj)).toBe(false);
    expect(isVerbToken(conj)).toBe(false);
  });

  it('grego: nome próprio pela marcação "Name type=" (Ἰησοῦ, N-GSM-P)', () => {
    const name = {
      corpus: 'gnt' as const,
      morph: 'N-GSM-P',
      morph_desc: 'Noun; Case=Genitive; Number=Singular; Gender=Masculine; Name type=Individual',
    };
    expect(isProperNameToken(name)).toBe(true);
    expect(isContentToken(name)).toBe(true);
    expect(isProperNameToken({ corpus: 'gnt', morph: 'N-NSM', morph_desc: 'Noun; Case=Nominative' })).toBe(false);
  });

  it('hebraico (1Rs 15:15): HTo (partícula de objeto) é função; יְהוָה (HNpt) é nome próprio de conteúdo', () => {
    expect(isContentToken({ corpus: 'hot', morph: 'HTo' })).toBe(false);
    expect(isVerbToken({ corpus: 'hot', morph: 'HTo' })).toBe(false);
    expect(mainSegmentOf({ corpus: 'hot', morph: 'HTo' })).toBe('To');

    // pos 1: וַיָּבֵא, Consecutive conjunction + verbo (Hc/Vhw3ms): conteúdo e verbo
    expect(isContentToken({ corpus: 'hot', morph: 'Hc/Vhw3ms' })).toBe(true);
    expect(isVerbToken({ corpus: 'hot', morph: 'Hc/Vhw3ms' })).toBe(true);

    expect(isProperNameToken({ corpus: 'hot', morph: 'HNpt', morph_desc: null })).toBe(true);
    expect(isContentToken({ corpus: 'hot', morph: 'HNpt' })).toBe(true);
  });

  it('hebraico: prefixos de função não tornam a forma de conteúdo; o substantivo principal decide', () => {
    // pos 3: לַמֶּלֶךְ, preposição + substantivo (HR/Ncmsa)
    expect(isContentToken({ corpus: 'hot', morph: 'HR/Ncmsa' })).toBe(true);
    // pos 9: וְזָהָב, conjunção + substantivo (HC/Ncmsa)
    expect(isContentToken({ corpus: 'hot', morph: 'HC/Ncmsa' })).toBe(true);
    // preposição + pronome sufixo: função
    expect(isContentToken({ corpus: 'hot', morph: 'HRd/Sp3ms' })).toBe(false);
    // conjunção + preposição, sem lexema: função
    expect(isContentToken({ corpus: 'hot', morph: 'HC/R' })).toBe(false);
    expect(isContentToken({ corpus: 'hot', morph: 'HAafsc' })).toBe(true);
    expect(isContentToken({ corpus: 'hot', morph: null })).toBe(true);
    expect(mainSegmentOf({ corpus: 'hot', morph: 'HR/Ncmsa' })).toBe('Ncmsa');
  });

  it('aramaico (Dn 2:4): substantivo com artigo é conteúdo; imperativo é verbo', () => {
    // pos 5: מַלְכָּא, ANcbsd/Ta
    expect(isContentToken({ corpus: 'hot', morph: 'ANcbsd/Ta' })).toBe(true);
    expect(isVerbToken({ corpus: 'hot', morph: 'ANcbsd/Ta' })).toBe(false);
    // pos 7: חֱיִ, AVqv2ms
    expect(isVerbToken({ corpus: 'hot', morph: 'AVqv2ms' })).toBe(true);
    // pos 10: לְעַבְדָךְ, preposição + substantivo + sufixo (AR/Ncbsc/Sp2ms)
    expect(isContentToken({ corpus: 'hot', morph: 'AR/Ncbsc/Sp2ms' })).toBe(true);
  });

  it('a versão por língua tem o nome explícito no núcleo', () => {
    expect(isContentTokenByLang).toBe(isContentToken);
  });
});

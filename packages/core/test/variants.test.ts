import { describe, expect, it } from 'vitest';
import { variantSites, type Token } from '../src/index';

function t(surface: string, pos: number, editions: string, vid = 50002005): Token {
  return {
    cite_id: `tok:gnt:${vid}:${pos}`,
    source_id: 'tagnt',
    corpus: 'gnt',
    vid,
    pos,
    surface,
    translit: null,
    lemma: null,
    strong: null,
    strong_base: null,
    morph: null,
    morph_desc: null,
    gloss_en: null,
    editions,
    variant_note: null,
    alt_ref: null,
  };
}

describe('variantSites', () => {
  it('uma substituição vira um sítio com as duas leituras', () => {
    // TR: a X b ; NA: a Y b
    const tokens = [t('a', 1, 'TR,BYZ,NA'), t('X', 2, 'TR,BYZ'), t('Y', 3, 'NA,SBL'), t('b', 4, 'TR,BYZ,NA')];
    const sites = variantSites(tokens);
    expect(sites).toHaveLength(1);
    expect(sites[0]?.ref).toBe('Filipenses 2:5');
    expect(sites[0]?.trReading.map((x) => x.surface)).toEqual(['X']);
    expect(sites[0]?.naReading.map((x) => x.surface)).toEqual(['Y']);
  });

  it('omissão no TR: a leitura TR fica vazia e a do NA cita o seu token', () => {
    // Caso real de Filipenses 2:5: TR sem o verbo, NA com φρονεῖτε.
    const tokens = [t('τοῦτο', 1, 'TR,BYZ,NA'), t('γὰρ', 2, 'TR,BYZ'), t('φρονεῖτε', 3, 'NA,SBL,WH'), t('ἐν', 4, 'TR,BYZ,NA')];
    const [site] = variantSites(tokens.map((x, i) => (i === 1 ? { ...x, editions: 'TR,BYZ' } : x)));
    expect(site?.trReading.map((x) => x.surface)).toEqual(['γὰρ']);
    expect(site?.naReading.map((x) => x.surface)).toEqual(['φρονεῖτε']);
    expect(site?.naReading[0]?.cite_id).toBe('tok:gnt:50002005:3');
  });

  it('palavra só do NA (fora do TR e do BYZ) aparece como leitura NA sem TR', () => {
    const tokens = [t('a', 1, 'TR,BYZ,NA'), t('ἑαυτὸν', 2, 'BYZ,NA'), t('b', 3, 'TR,BYZ,NA')];
    const sites = variantSites(tokens);
    expect(sites).toHaveLength(1);
    expect(sites[0]?.trReading).toEqual([]);
    expect(sites[0]?.naReading.map((x) => x.surface)).toEqual(['ἑαυτὸν']);
  });

  it('versículo sem diferença não gera sítio; hebraico é ignorado', () => {
    const same = [t('a', 1, 'TR,BYZ,NA'), t('b', 2, 'TR,BYZ,NA')];
    expect(variantSites(same)).toEqual([]);
    const hebrew = [{ ...t('x', 1, 'L'), corpus: 'hot' as const }];
    expect(variantSites(hebrew)).toEqual([]);
  });
});

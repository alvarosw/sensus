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

/** Palavra com morfologia, para os casos que exigem code/desc na leitura. */
function w(surface: string, pos: number, editions: string, vid = 50002005): Token {
  return { ...t(surface, pos, editions, vid), morph: 'X-000', morph_desc: `desc de ${surface}` };
}

describe('variantSites: alinhamento por lacunas (Filipenses 2:5)', () => {
  it('substituição: TR/BYZ "γὰρ φρονείσθω" contra NA "φρονεῖτε" não se misturam', () => {
    // TR: Τοῦτο γὰρ φρονείσθω ἐν ὑμῖν ; NA: Τοῦτο φρονεῖτε ἐν ὑμῖν
    const tokens = [
      t('Τοῦτο', 1, 'TR,BYZ,NA'),
      w('γὰρ', 2, 'TR,BYZ'),
      w('φρονείσθω', 3, 'TR,BYZ'),
      w('φρονεῖτε', 4, 'NA,SBL,WH'),
      t('ἐν', 5, 'TR,BYZ,NA'),
      t('ὑμῖν', 6, 'TR,BYZ,NA'),
    ];
    const sites = variantSites(tokens);
    expect(sites).toHaveLength(1);
    const [site] = sites;
    expect(site?.ref).toBe('Filipenses 2:5');
    expect(site?.readings.map((r) => ({ editions: r.editions, surfaces: r.tokens.map((x) => x.surface) }))).toEqual([
      { editions: ['TR', 'BYZ'], surfaces: ['γὰρ', 'φρονείσθω'] },
      { editions: ['NA'], surfaces: ['φρονεῖτε'] },
    ]);
    expect(site?.trReading.map((x) => x.surface)).toEqual(['γὰρ', 'φρονείσθω']);
    expect(site?.naReading.map((x) => x.surface)).toEqual(['φρονεῖτε']);
    // Cada leitura cita os seus próprios tokens.
    expect(site?.readings[0]?.tokens.map((x) => x.cite_id)).toEqual(['tok:gnt:50002005:2', 'tok:gnt:50002005:3']);
    expect(site?.readings[1]?.tokens[0]?.cite_id).toBe('tok:gnt:50002005:4');
    // Morfologia da palavra vem junto da leitura.
    expect(site?.readings[1]?.tokens[0]?.morph_desc).toBe('desc de φρονεῖτε');
  });

  it('omissão: NA sem a palavra do TR/BYZ gera leitura vazia; a do NA é a palavra presente', () => {
    // TR: Τοῦτο ἐν ὑμῖν ; NA: Τοῦτο φρονεῖτε ἐν ὑμῖν (adição no NA)
    const tokens = [
      t('Τοῦτο', 1, 'TR,BYZ,NA'),
      w('φρονεῖτε', 2, 'NA,SBL,WH'),
      t('ἐν', 3, 'TR,BYZ,NA'),
      t('ὑμῖν', 4, 'TR,BYZ,NA'),
    ];
    const [site] = variantSites(tokens);
    expect(site?.readings).toEqual([
      { editions: ['TR', 'BYZ'], tokens: [] },
      { editions: ['NA'], tokens: [expect.objectContaining({ surface: 'φρονεῖτε', cite_id: 'tok:gnt:50002005:2' })] },
    ]);
    expect(site?.trReading).toEqual([]);
    expect(site?.naReading.map((x) => x.surface)).toEqual(['φρονεῖτε']);
  });

  it('omissão no TR/BYZ com a palavra só no NA: a leitura TR/BYZ fica vazia (—omite— na renderização)', () => {
    const tokens = [t('a', 1, 'TR,BYZ,NA'), w('φρονεῖτε', 2, 'NA,SBL,WH'), t('b', 3, 'TR,BYZ,NA')];
    const [site] = variantSites(tokens);
    expect(site?.readings.find((r) => r.editions.includes('TR'))?.tokens).toEqual([]);
    expect(site?.readings.find((r) => r.editions.includes('NA'))?.tokens.map((x) => x.surface)).toEqual(['φρονεῖτε']);
  });

  it('dois sítios separados por âncoras no mesmo versículo ficam independentes', () => {
    const tokens = [
      t('a', 1, 'TR,BYZ,NA'),
      w('X', 2, 'TR,BYZ'),
      w('Y', 3, 'NA,SBL'),
      t('b', 4, 'TR,BYZ,NA'),
      w('Z', 5, 'NA'),
      t('c', 6, 'TR,BYZ,NA'),
    ];
    const sites = variantSites(tokens);
    expect(sites.map((s) => s.readings.map((r) => r.tokens.map((x) => x.surface)))).toEqual([
      [['X'], ['Y']],
      [[], ['Z']],
    ]);
  });

  it('variante no fim do versículo (sem âncora depois) não é descartada', () => {
    const tokens = [t('a', 1, 'TR,BYZ,NA'), w('X', 2, 'TR,BYZ')];
    const sites = variantSites(tokens);
    expect(sites).toHaveLength(1);
    expect(sites[0]?.readings.map((r) => r.editions)).toEqual([['TR', 'BYZ'], ['NA']]);
  });

  it('palavra só de SBL/WH não gera sítio sozinha', () => {
    const tokens = [t('a', 1, 'TR,BYZ,NA'), w('Q', 2, 'SBL,WH'), t('b', 3, 'TR,BYZ,NA')];
    expect(variantSites(tokens)).toEqual([]);
  });
});

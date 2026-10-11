import { describe, expect, it } from 'vitest';
import { confidenceBand, confidenceLabel, groupPlaces, normPlaceName, openBibleOf, sitesAtVid, type PlaceVerseHit } from '../src/places';

const ob = (score: number, candidates: Array<[string, number]> = []) =>
  JSON.stringify({
    best_modern: { association_score: score },
    modern_candidates: candidates.map(([name, s]) => ({ name, score: s })),
  });

function hit(p: Partial<PlaceVerseHit> & Pick<PlaceVerseHit, 'cite_id' | 'source_id' | 'name' | 'lat' | 'lon' | 'vid'>): PlaceVerseHit {
  return { type: 'place', description: null, data: null, ...p } as PlaceVerseHit;
}

describe('normPlaceName', () => {
  it('ignora sublinhado, número de desambiguação e caixa', () => {
    expect(normPlaceName('Antioch 1')).toBe('antioch');
    expect(normPlaceName('Solomon’s_Portico')).toBe("solomon's portico");
    expect(normPlaceName('Adriatic_Sea')).toBe('adriatic sea');
  });
});

describe('confidenceBand', () => {
  it('faixas: alta ≥ 0,8, média ≥ 0,5, baixa abaixo, sem avaliação', () => {
    expect(confidenceBand(1)).toBe('high');
    expect(confidenceBand(0.8)).toBe('high');
    expect(confidenceBand(0.6)).toBe('mid');
    expect(confidenceBand(0.2)).toBe('low');
    expect(confidenceBand(null)).toBe('none');
  });
});

describe('openBibleOf', () => {
  it('lê association_score (0-1000 → 0-1) e os candidatos', () => {
    const r = openBibleOf(ob(922, [['Philippi', 1000], ['Filipos', 500]]));
    expect(r?.score).toBeCloseTo(0.922);
    expect(r?.candidates).toEqual([
      { name: 'Philippi', score: 1 },
      { name: 'Filipos', score: 0.5 },
    ]);
  });
  it('JSON inválido ou ausente vira null', () => {
    expect(openBibleOf(null)).toBeNull();
    expect(openBibleOf('{não é json')).toBeNull();
  });
});

describe('groupPlaces', () => {
  it('une a mesma localidade de três fontes e usa a confiança do OpenBible', () => {
    const sites = groupPlaces([
      hit({ cite_id: 'ent:theographic:phil', source_id: 'theographic', name: 'Philippi', lat: 41.01316, lon: 24.28409, vid: 44016012 }),
      hit({ cite_id: 'ent:stepbible-tipnr:phil', source_id: 'stepbible-tipnr', name: 'Philippi', lat: 41.01196, lon: 24.28619, vid: 44016012 }),
      hit({ cite_id: 'ent:openbible-geo:phil', source_id: 'openbible-geo', name: 'Philippi', lat: 41.012072, lon: 24.284576, vid: 44016012, data: ob(1000, [['Philippi', 1000]]) }),
      hit({ cite_id: 'ent:openbible-geo:phil', source_id: 'openbible-geo', name: 'Philippi', lat: 41.012072, lon: 24.284576, vid: 50001001, data: ob(1000) }),
    ]);
    expect(sites).toHaveLength(1);
    const s = sites[0]!;
    expect(s.lat).toBeCloseTo(41.012072); // coordenadas do OpenBible
    expect(s.citeIds[0]).toBe('ent:openbible-geo:phil');
    expect(s.sourceIds.sort()).toEqual(['openbible-geo', 'stepbible-tipnr', 'theographic']);
    expect(s.vids).toEqual([44016012, 50001001]);
    expect(s.confidence).toBe(1);
    expect(s.band).toBe('high');
    expect(s.candidates[0]?.name).toBe('Philippi');
  });

  it('separa homônimos distantes e os lista um no outro', () => {
    const sites = groupPlaces([
      hit({ cite_id: 'a', source_id: 'openbible-geo', name: 'Antioch 1', lat: 36.2, lon: 36.16, vid: 44011026, data: ob(1000) }),
      hit({ cite_id: 'b', source_id: 'openbible-geo', name: 'Antioch 2', lat: 38.3, lon: 31.2, vid: 44013014, data: ob(369) }),
    ]);
    expect(sites).toHaveLength(2);
    const syria = sites.find((s) => s.lat > 36 && s.lat < 37)!;
    const pisidia = sites.find((s) => s.lat > 38)!;
    expect(syria.homonyms.map((h) => h.id)).toEqual([pisidia.id]);
    expect(pisidia.band).toBe('low');
    expect(sitesAtVid(sites, 44013014).map((s) => s.id)).toEqual([pisidia.id]);
  });

  it('lugar sem OpenBible fica com banda "none" e sem confiança', () => {
    const [s] = groupPlaces([hit({ cite_id: 'c', source_id: 'stepbible-tipnr', name: 'Troas', lat: 39.8, lon: 26.2, vid: 44016008 })]);
    expect(s!.confidence).toBeNull();
    expect(s!.band).toBe('none');
    expect(confidenceLabel(s!, { high: 'alta', mid: 'média', low: 'baixa', none: 'sem avaliação' })).toBe('sem avaliação');
  });

  it('rótulo de confiança usa vírgula decimal', () => {
    const words = { high: 'alta', mid: 'média', low: 'baixa', none: 'sem avaliação' };
    expect(confidenceLabel({ confidence: 0.922, band: 'high' }, words)).toBe('alta · 0,92');
  });
});

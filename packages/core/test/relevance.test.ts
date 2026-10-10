import { describe, expect, it } from 'vitest';
import {
  buildRelevanceContext,
  GENERIC_ENTITY_REFS,
  isStopHeadword,
  rankDictionary,
  rankEntities,
  type DictionaryHit,
  type EntityHit,
} from '../src/index';

const range = { start: 50002005, end: 50002008 }; // amplitude 3

function dict(headword: string, ref_span: number, total_refs: number, cite = `dic:x:${headword}`): DictionaryHit {
  return { cite_id: cite, source_id: 'x', headword, text: 't', kind: 'dictionary', ref_span, total_refs };
}

const ctx = buildRelevanceContext(range, { name_en: 'Philippians', name_pt: 'Filipenses' }, ['Jesus Christ'], []);

describe('rankDictionary', () => {
  it('descarta verbetes com referência muito mais larga que o trecho (ex.: Apphia, capítulo inteiro)', () => {
    const out = rankDictionary([dict('APPHIA', 29, 1), dict('HUMILITY', 2, 2)], ctx, 10);
    expect(out.map((e) => e.headword)).toEqual(['HUMILITY']);
  });

  it('descarta cabeçalhos que são palavras comuns (ISBE "AS")', () => {
    expect(isStopHeadword('AS')).toBe(true);
    expect(isStopHeadword('CHRIST, OFFICES OF')).toBe(false);
    expect(rankDictionary([dict('AS', 0, 1)], ctx, 10)).toEqual([]);
  });

  it('mantém verbete largo se o cabeçalho casa com o livro ou com uma entidade do trecho', () => {
    const intro = dict('PHILIPPIANS, THE EPISTLE TO THE', 29, 53);
    const jesus = dict('JESUS, THE CHRIST', 40, 15);
    // Ambos casam (bônus); o mais específico (JESUS: 15 refs) vem antes do de 53 refs.
    expect(rankDictionary([intro, jesus], ctx, 10).map((e) => e.headword)).toEqual([
      'JESUS, THE CHRIST',
      'PHILIPPIANS, THE EPISTLE TO THE',
    ]);
  });

  it('ordena por especificidade e depois casamento: menos referências primeiro', () => {
    const out = rankDictionary([dict('BROAD', 2, 20), dict('NARROW', 1, 1), dict('MID', 1, 4)], ctx, 10);
    expect(out.map((e) => e.headword)).toEqual(['NARROW', 'MID', 'BROAD']);
  });

  it('aplica o limite depois de ordenar', () => {
    const out = rankDictionary([dict('ALPHA', 0, 3), dict('BETA', 0, 1), dict('GAMMA', 0, 2)], ctx, 2);
    expect(out.map((e) => e.headword)).toEqual(['BETA', 'GAMMA']);
  });

  it('glosas de palavras de conteúdo contam como casamento', () => {
    const withGloss = buildRelevanceContext(
      range,
      undefined,
      [],
      [
        {
          cite_id: 'tok:gnt:50002005:1',
          source_id: 'tagnt',
          corpus: 'gnt',
          vid: 50002005,
          pos: 1,
          surface: 'x',
          translit: null,
          lemma: null,
          strong: null,
          strong_base: null,
          morph: 'N-NSF',
          morph_desc: null,
          gloss_en: 'Humility',
          editions: 'TR',
          variant_note: null,
          alt_ref: null,
        },
      ],
    );
    expect(withGloss.glosses.has('humility')).toBe(true);
    const out = rankDictionary([dict('HUMILITY', 5, 30), dict('OTHER', 1, 1)], withGloss, 10);
    expect(out[0]?.headword).toBe('HUMILITY'); // casa com a glosa: bônus supera a especificidade
  });
});

describe('rankEntities', () => {
  const e = (name: string, total_refs: number): EntityHit => ({
    cite_id: `ent:x:${name}`,
    source_id: 'x',
    type: 'person',
    name,
    description: null,
    lat: null,
    lon: null,
    data: null,
    total_refs,
  });

  it('exclui entidades genéricas quando há outras no trecho', () => {
    const out = rankEntities([e('God', GENERIC_ENTITY_REFS + 3), e('Paul', 1), e('Epaphroditus', 3)], 10);
    expect(out.map((x) => x.name)).toEqual(['Paul', 'Epaphroditus']);
  });

  it('mantém as genéricas só quando não há mais nenhuma', () => {
    const out = rankEntities([e('God', 23), e('Jesus', 37)], 10);
    expect(out.map((x) => x.name)).toEqual(['God', 'Jesus']);
  });

  it('não mostra genéricas quando o trecho tem outros itens históricos (verbetes)', () => {
    expect(rankEntities([e('God', 23), e('Jesus', 37)], 10, { othersExist: true })).toEqual([]);
  });
});

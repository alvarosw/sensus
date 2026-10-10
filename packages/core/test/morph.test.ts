import { describe, expect, it } from 'vitest';
import { checkMorphClaims, morphValues, parseCited, tokenIndex, type Token } from '../src/index';

function tok(cite: string, desc: string | null, morph = 'V-PAM-2P'): Token {
  return {
    cite_id: cite,
    source_id: 'tagnt',
    corpus: 'gnt',
    vid: 50002005,
    pos: 1,
    surface: 'x',
    translit: null,
    lemma: null,
    strong: null,
    strong_base: null,
    morph,
    morph_desc: desc,
    gloss_en: null,
    editions: 'TR,BYZ,NA',
    variant_note: null,
    alt_ref: null,
  };
}

const IMPERATIVE = 'Verb; Tense=Present; Voice=Active; Mood=Imperative; Person=2nd; Number=Plural';
const INDICATIVE = 'Verb; Tense=Present; Voice=Active; Mood=Indicative; Person=3rd; Number=Singular';
const FUTURE = 'Verb; Tense=Future; Voice=Active; Mood=Indicative; Person=3rd; Number=Singular';
const DATIVE = 'Noun; Case=Dative; Number=Singular; Gender=Masculine';
const MIDDLE = 'Verb; Tense=Aorist; Voice=Middle; Mood=Indicative; Person=3rd; Number=Singular';
const MIDDLE_DEPONENT = 'Verb; Tense=Present; Voice=Middle Deponent; Mood=Indicative; Person=3rd; Number=Singular';
const PERFECT = 'Verb; Tense=Perfect; Voice=Active; Mood=Indicative; Person=3rd; Number=Singular';
const PLUPERFECT = 'Verb; Tense=Pluperfect; Voice=Active; Mood=Indicative; Person=3rd; Number=Singular';

const cite = (n: number) => `tok:gnt:50002005:${n}`;
const seg = (text: string, cites: string[]) => ({ text, cites, invalidCites: [], kind: 'source' as const });
const check = (text: string, cites: string[], tokens: Token[]) =>
  checkMorphClaims([seg(text, cites)], tokenIndex(tokens))[0]?.morphConflicts;

describe('morphValues', () => {
  it('lê modo, tempo, voz, pessoa e número do morph_desc TEGMC', () => {
    expect(morphValues(IMPERATIVE)).toEqual({
      mood: new Set(['imperative']),
      tense: new Set(['present']),
      voice: new Set(['active']),
      person: new Set(['2nd']),
      number: new Set(['plural']),
    });
  });

  it('expande voz composta e tempos com ordinal, infinitivo e particípio', () => {
    const v = morphValues('Verb; Tense=2nd Aorist; Voice=Middle or Passive Deponent; Form=Participle');
    expect(v.tense).toEqual(new Set(['aorist']));
    expect(v.voice).toEqual(new Set(['middle', 'passive', 'deponent']));
    expect(v.mood).toEqual(new Set(['participle']));
    expect(morphValues(null)).toEqual({});
  });
});

describe('checkMorphClaims', () => {
  it('aponta o modo errado: "indicativo" para um imperativo', () => {
    const tokens = [tok(cite(2), IMPERATIVE)];
    expect(check('O verbo φρονεῖτε é indicativo [[tok:gnt:50002005:2]].', [cite(2)], tokens)).toEqual([
      { term: 'indicativo', expected: 'imperativo' },
    ]);
  });

  it('acusa cada leitura errada quando o trecho menciona duas e nenhuma bate', () => {
    const tokens = [tok(cite(2), IMPERATIVE)];
    const conflicts = check('Pode ser indicativo ou subjuntivo [[tok:gnt:50002005:2]].', [cite(2)], tokens);
    expect(conflicts?.map((c) => c.term)).toEqual(['indicativo', 'subjuntivo']);
  });

  it('não acusa quando a afirmação bate com a análise', () => {
    expect(check('É imperativo [[tok:gnt:50002005:2]].', [cite(2)], [tok(cite(2), IMPERATIVE)])).toBeUndefined();
  });

  it('não acusa duas leituras quando uma delas bate com algum token citado', () => {
    const tokens = [tok(cite(2), IMPERATIVE), tok(cite(3), INDICATIVE)];
    expect(check('Indicativo ou imperativo [[tok:gnt:50002005:2]].', [cite(2), cite(3)], tokens)).toBeUndefined();
  });

  it('compara tempo, caso e voz; "média/passiva" bate com média', () => {
    expect(check('presente [[tok:gnt:50002005:2]]', [cite(2)], [tok(cite(2), FUTURE)])).toEqual([
      { term: 'presente', expected: 'futuro' },
    ]);
    expect(check('genitivo [[tok:gnt:50002005:2]]', [cite(2)], [tok(cite(2), DATIVE)])).toEqual([
      { term: 'genitivo', expected: 'dativo' },
    ]);
    expect(check('voz média/passiva [[tok:gnt:50002005:2]]', [cite(2)], [tok(cite(2), MIDDLE)])).toBeUndefined();
    expect(check('voz ativa [[tok:gnt:50002005:2]]', [cite(2)], [tok(cite(2), MIDDLE)])).toEqual([
      { term: 'ativa', expected: 'média' },
    ]);
  });

  it('depoente bate com voz média depoente', () => {
    expect(check('depoente [[tok:gnt:50002005:2]]', [cite(2)], [tok(cite(2), MIDDLE_DEPONENT)])).toBeUndefined();
  });

  it('distingue mais-que-perfeito de perfeito', () => {
    expect(check('mais-que-perfeito [[tok:gnt:50002005:2]]', [cite(2)], [tok(cite(2), PERFECT)])).toEqual([
      { term: 'mais-que-perfeito', expected: 'perfeito' },
    ]);
    expect(check('perfeito [[tok:gnt:50002005:2]]', [cite(2)], [tok(cite(2), PLUPERFECT)])).toEqual([
      { term: 'perfeito', expected: 'mais-que-perfeito' },
    ]);
  });

  it('compara pessoa e número em português e em inglês', () => {
    const tokens = [tok(cite(2), IMPERATIVE)];
    expect(check('3ª pessoa do singular [[tok:gnt:50002005:2]]', [cite(2)], tokens)?.map((c) => c.term)).toEqual([
      '3ª pessoa',
      'singular',
    ]);
    expect(check('The verb is subjunctive [[tok:gnt:50002005:2]]', [cite(2)], tokens)).toEqual([
      { term: 'subjuntivo', expected: 'imperativo' },
    ]);
    expect(check('The verb is imperative [[tok:gnt:50002005:2]]', [cite(2)], tokens)).toBeUndefined();
  });

  it('não acusa quando o token citado não tem a categoria, nem sem token de morfologia', () => {
    expect(check('indicativo [[tok:gnt:50002005:2]]', [cite(2)], [tok(cite(2), 'Noun; Case=Dative')])).toBeUndefined();
    expect(check('indicativo [[tok:gnt:50002005:2]]', [cite(2)], [tok(cite(2), null)])).toBeUndefined();
  });

  it('segmento sem citação de tok não é verificado', () => {
    const segs = checkMorphClaims([seg('indicativo', ['txt:blivre:50002005'])], tokenIndex([]));
    expect(segs[0]?.morphConflicts).toBeUndefined();
  });

  it('funciona sobre a saída de parseCited', () => {
    const valid = new Set([cite(2)]);
    const segs = checkMorphClaims(parseCited('O verbo é indicativo [[tok:gnt:50002005:2]].', valid), tokenIndex([tok(cite(2), IMPERATIVE)]));
    expect(segs[0]?.morphConflicts).toEqual([{ term: 'indicativo', expected: 'imperativo' }]);
    expect(segs[0]?.kind).toBe('source');
  });
});

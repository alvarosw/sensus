import { describe, expect, it } from 'vitest';
import {
  SOURCES,
  TRADITIONS,
  commentatorOf,
  sourceAbbr,
  sourceShort,
  textSources,
  traditionLabel,
  type Commentary,
  type Source,
} from '../src/index';

// Espelho literal do banco (SELECT id, kind, tradition FROM source em data/sensus.db), para o teste falhar
// quando uma fonte do banco não tiver entrada no registro.
const BANCO: Array<{ id: string; kind: string; tradition: string | null }> = [
  { id: 'blivre', kind: 'text', tradition: null },
  { id: 'gill', kind: 'commentary', tradition: 'reformed-baptist' },
  { id: 'grc-tr', kind: 'text', tradition: null },
  { id: 'hbo-wlc', kind: 'text', tradition: null },
  { id: 'kjv', kind: 'text', tradition: null },
  { id: 'openbible-geo', kind: 'entity', tradition: null },
  { id: 'openbible-xref', kind: 'xref', tradition: null },
  { id: 'patristic', kind: 'commentary', tradition: 'patristic' },
  { id: 'stepbible-tbesg', kind: 'lexicon', tradition: null },
  { id: 'stepbible-tbesh', kind: 'lexicon', tradition: null },
  { id: 'stepbible-tflsj', kind: 'lexicon', tradition: null },
  { id: 'stepbible-tipnr', kind: 'entity', tradition: null },
  { id: 'sword-barnes', kind: 'commentary', tradition: 'presbyterian' },
  { id: 'sword-calvincommentaries', kind: 'commentary', tradition: 'reformed' },
  { id: 'sword-clarke', kind: 'commentary', tradition: 'methodist' },
  { id: 'sword-easton', kind: 'dictionary', tradition: null },
  { id: 'sword-hitchcock', kind: 'dictionary', tradition: null },
  { id: 'sword-isbe', kind: 'dictionary', tradition: null },
  { id: 'sword-jfb', kind: 'commentary', tradition: 'reformed' },
  { id: 'sword-kd', kind: 'commentary', tradition: 'lutheran' },
  { id: 'sword-mhc', kind: 'commentary', tradition: 'reformed' },
  { id: 'sword-nave', kind: 'topical', tradition: null },
  { id: 'sword-rwp', kind: 'commentary', tradition: 'baptist' },
  { id: 'sword-scofield', kind: 'commentary', tradition: 'dispensational' },
  { id: 'sword-smith', kind: 'dictionary', tradition: null },
  { id: 'sword-torrey', kind: 'topical', tradition: null },
  { id: 'sword-tsk', kind: 'xref', tradition: null },
  { id: 'sword-wesley', kind: 'commentary', tradition: 'methodist' },
  { id: 'tagnt', kind: 'tokens', tradition: null },
  { id: 'tahot', kind: 'tokens', tradition: null },
  { id: 'theographic', kind: 'entity', tradition: null },
];

// Fontes das ingestões novas (pipeline/ingest, documentadas em DATA_LICENSES.md) e suas tradições.
const NOVAS: Array<{ id: string; kind: string; tradition: string }> = [
  { id: 'sword-abbott', kind: 'commentary', tradition: 'congregational' },
  { id: 'sword-burkitt', kind: 'commentary', tradition: 'anglican' },
  { id: 'sword-catena', kind: 'commentary', tradition: 'catholic' },
  { id: 'sword-lightfoot', kind: 'commentary', tradition: 'reformed' },
  { id: 'sword-luther', kind: 'commentary', tradition: 'lutheran' },
  { id: 'sword-pnt', kind: 'commentary', tradition: 'restoration' },
  { id: 'sword-tfg', kind: 'commentary', tradition: 'restoration' },
  { id: 'egw-great-controversy', kind: 'commentary', tradition: 'adventist' },
  { id: 'egw-patriarchs', kind: 'commentary', tradition: 'adventist' },
  { id: 'egw-prophets', kind: 'commentary', tradition: 'adventist' },
  { id: 'egw-acts', kind: 'commentary', tradition: 'adventist' },
  { id: 'egw-object-lessons', kind: 'commentary', tradition: 'adventist' },
  { id: 'egw-steps', kind: 'commentary', tradition: 'adventist' },
  { id: 'egw-thoughts', kind: 'commentary', tradition: 'adventist' },
  { id: 'smith-daniel', kind: 'commentary', tradition: 'adventist' },
];

const ROLE_OF_KIND: Record<string, string[]> = {
  text: ['text', 'interlinear'],
  tokens: ['tokens'],
  lexicon: ['lexicon'],
  commentary: ['commentary'],
  dictionary: ['dictionary'],
  topical: ['topical'],
  xref: ['xref'],
  entity: ['entity'],
};

const TODAS = [...BANCO, ...NOVAS];

describe('registro de fontes e tradições (domain/sources)', () => {
  it('toda fonte do banco e das ingestões novas está registrada, e não há id órfão', () => {
    const ids = TODAS.map((r) => r.id).sort();
    expect(Object.keys(SOURCES).sort()).toEqual(ids);
  });

  it('o papel registrado combina com o tipo da fonte no banco', () => {
    for (const r of TODAS) {
      expect(ROLE_OF_KIND[r.kind], r.id).toContain(SOURCES[r.id]!.role);
    }
  });

  it('toda fonte de comentário tem comentarista, e a tradição dela tem rótulo pt', () => {
    for (const r of TODAS.filter((x) => x.kind === 'commentary')) {
      expect(SOURCES[r.id]!.commentator, r.id).toBeTruthy();
      expect(TRADITIONS[r.tradition!]?.pt, r.id).toBeTruthy();
    }
  });

  it('toda tradição usada pelas fontes tem rótulo pt, exibido por traditionLabel', () => {
    for (const r of TODAS) {
      if (!r.tradition) continue;
      expect(TRADITIONS[r.tradition]?.pt, r.tradition).toBeTruthy();
      expect(traditionLabel(r.tradition)).toBe(TRADITIONS[r.tradition]!.pt);
    }
  });

  it('a fonte de comentário tem nome curto e rótulo de tradição (ex.: sword-kd)', () => {
    expect(commentatorOf({ id: 'sword-kd' } as Source, { source_id: 'sword-kd' } as Commentary)).toBe('Keil e Delitzsch');
    expect(traditionLabel('lutheran')).toBe('luterana');
  });

  it('textSources() são as traduções que o leitor oferece, com as siglas da barra superior', () => {
    expect(textSources()).toEqual(['blivre', 'kjv']);
    expect(sourceAbbr('blivre')).toBe('BLivre');
    expect(sourceAbbr('kjv')).toBe('KJV');
    expect(sourceShort('blivre')).toBe('Bíblia Livre');
  });

  it('fonte fora do registro: rótulo pelo título do banco, ou pelo id sem título', () => {
    expect(sourceShort('fonte-nova', 'Uma fonte nova de estudo')).toBe('Uma fonte nova de estudo');
    expect(sourceShort('fonte-nova')).toBe('fonte-nova');
  });
});

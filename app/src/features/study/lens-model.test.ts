// Regras puras das lentes: seleção, lugares, histórico, tradição/autor, matriz e comparação (NT grego e AT hebraico).
import { describe, expect, it } from 'vitest';
import { originalTokensByVid, packVid, traditionLabel, type Entity, type Token, type Vid } from '@sensus/core';
import type { CommentaryView } from './format';
import {
  activeTraditionOf,
  commentaryHitIndex,
  commentaryMatrix,
  commentaryTraditions,
  compareRows,
  dedupePlaces,
  filterCommentaries,
  textoCountLabel,
  historicalParts,
  literaryNeighborhood,
  passageDivisions,
  selectedVids,
} from './lens-model';

const FP_2_5 = packVid(50, 2, 5);
const FP_2_6 = packVid(50, 2, 6);
const FP_2_7 = packVid(50, 2, 7);
const RS_15_15 = packVid(11, 15, 15);

const TOKEN_BASE = { translit: null, lemma: null, strong: null, strong_base: null, morph: null, morph_desc: null, gloss_en: null, variant_note: null, alt_ref: null, source_id: 'x' };
function tok(over: Partial<Token> & Pick<Token, 'cite_id' | 'corpus' | 'vid' | 'pos' | 'surface' | 'editions'>): Token {
  return { ...TOKEN_BASE, ...over } as Token;
}

function place(cite: string, name: string, source: string, lat: number | null = 31.7, lon: number | null = 35.2): Entity {
  return { cite_id: cite, source_id: source, type: 'place', name, description: null, lat, lon, data: null };
}

function person(cite: string, name: string): Entity {
  return { cite_id: cite, source_id: 'x', type: 'person', name, description: null, lat: null, lon: null, data: null };
}

function view(author: string, tradition: string, start: Vid, end: Vid, column = author): CommentaryView {
  return {
    commentary: { cite_id: `c:${author}:${start}`, source_id: 's', start_vid: start, end_vid: end, text: '' },
    author,
    column,
    tradition: traditionLabel(tradition),
    body: '',
    intro: false,
  };
}

describe('seleção de versículos', () => {
  it('só os versículos com tradução dentro do intervalo, sem repetição e em ordem', () => {
    const translations = [{ vid: FP_2_7 }, { vid: FP_2_5 }, { vid: FP_2_5 }, { vid: packVid(50, 2, 9) }];
    expect(selectedVids(translations, { start: FP_2_5, end: FP_2_7 })).toEqual([FP_2_5, FP_2_7]);
  });
});

describe('lugares e histórico', () => {
  it('um lugar por nome, pela fonte preferida (theographic antes de openbible-geo); sem coordenadas, fora', () => {
    const out = dedupePlaces([
      place('a', 'Jerusalém', 'openbible-geo', 31.7, 35.2),
      place('b', 'Jerusalém', 'theographic', 31.78, 35.23),
      place('c', 'Sem lugar', 'theographic', null, null),
      person('d', 'Davi'),
    ]);
    expect(out.map((p) => p.cite_id)).toEqual(['b']);
  });

  it('pessoas e grupos sem lugares, sem eventos da linha do tempo e sem nome repetido', () => {
    const entities = [place('p', 'Hebrom', 'theographic'), person('h1', 'Davi'), person('h2', 'Davi'), person('e', 'Batalha')];
    // 'e' já está na linha do tempo, então sai de "Pessoas e grupos"
    const events = [{ cite_id: 'e' }] as unknown as Parameters<typeof historicalParts>[0]['events'];
    const parts = historicalParts({ entities, dictionary: [], events } as unknown as Parameters<typeof historicalParts>[0]);
    expect(parts.places.map((p) => p.name)).toEqual(['Hebrom']);
    expect(parts.people.map((p) => p.cite_id)).toEqual(['h1']);
  });
});

describe('tradição e autor', () => {
  const views = [view('Calvino', 'reformed', FP_2_5, FP_2_5), view('Agostinho', 'patristic', FP_2_5, FP_2_6), view('Calvino', 'reformed', FP_2_6, FP_2_7)];

  it('tradição ativa vira o rótulo pt-BR; sem filtro, null', () => {
    expect(activeTraditionOf(null)).toBeNull();
    expect(activeTraditionOf('reformed')).toBe(traditionLabel('reformed'));
    expect(commentaryTraditions(views)).toEqual([traditionLabel('reformed'), traditionLabel('patristic')]);
  });

  it('filtra por tradição e por autor, ao mesmo tempo', () => {
    const reformada = traditionLabel('reformed');
    expect(filterCommentaries(views, reformada, null).map((v) => v.author)).toEqual(['Calvino', 'Calvino']);
    expect(filterCommentaries(views, null, 'Agostinho').map((v) => v.author)).toEqual(['Agostinho']);
    expect(filterCommentaries(views, reformada, 'Agostinho')).toEqual([]);
  });

  it('a matriz tem os versículos do trecho cobertos pelos comentários e as colunas por autor', () => {
    const m = commentaryMatrix(views, { start: FP_2_5, end: FP_2_7 });
    expect(m.vids).toEqual([FP_2_5, FP_2_6, FP_2_7]);
    expect(m.cols.map((c) => c.key)).toEqual(['Calvino', 'Agostinho']);
    const hit = commentaryHitIndex(views);
    expect(hit(FP_2_6, 'Agostinho')?.label).toBe('Agostinho 2:6');
    expect(hit(FP_2_7, 'Agostinho')).toBeUndefined();
  });
});

describe('comparação da lente Texto (NT grego e AT hebraico)', () => {
  const NT = [
    tok({ cite_id: 'tok:gnt:1', corpus: 'gnt', vid: FP_2_5, pos: 1, surface: 'τοῦτο', editions: 'TR,BYZ,NA' }),
    tok({ cite_id: 'tok:gnt:2', corpus: 'gnt', vid: FP_2_5, pos: 2, surface: 'φρονεῖτε', editions: 'TR,BYZ,NA' }),
  ];
  const AT = [
    tok({ cite_id: 'tok:hot:1', corpus: 'hot', vid: RS_15_15, pos: 1, surface: 'וַיָּבֵא', editions: 'L', morph: 'HC/Vqw3ms' }),
    tok({ cite_id: 'tok:hot:2', corpus: 'hot', vid: RS_15_15, pos: 2, surface: 'אֵת', editions: 'L', morph: 'HTo' }),
  ];
  const originals = originalTokensByVid([...NT, ...AT]);
  const translations = [{ source_id: 'blivre', vid: FP_2_5, text: 'texto livre' }];

  it('NT: o original é o grego TR, com direção ltr', () => {
    const [row] = compareRows([FP_2_5], 'original', translations, originals);
    expect(row).toMatchObject({ kind: 'original', dir: 'ltr' });
    expect(row?.kind === 'original' && row.tokens.map((t) => t.cite_id)).toEqual(['tok:gnt:1', 'tok:gnt:2']);
  });

  it('AT: o original é o hebraico do WLC, com direção rtl e as palavras do próprio versículo', () => {
    const [row] = compareRows([RS_15_15], 'original', translations, originals);
    expect(row).toMatchObject({ kind: 'original', dir: 'rtl' });
    expect(row?.kind === 'original' && row.tokens.map((t) => t.surface)).toEqual(['וַיָּבֵא', 'אֵת']);
  });

  it('versículo sem palavra no original fica vazio', () => {
    expect(compareRows([FP_2_6], 'original', translations, originals)).toEqual([{ vid: FP_2_6, kind: 'empty' }]);
  });

  it('tradução: o texto da fonte escolhida; sem texto, vazio', () => {
    expect(compareRows([FP_2_5, FP_2_6], 'blivre', translations, originals)).toEqual([
      { vid: FP_2_5, kind: 'text', text: 'texto livre' },
      { vid: FP_2_6, kind: 'empty' },
    ]);
    expect(compareRows([FP_2_5], 'kjv', translations, originals)).toEqual([{ vid: FP_2_5, kind: 'empty' }]);
  });
});

describe('vizinhança literária', () => {
  it('dois versículos antes e dois depois do trecho, nunca dentro dele', () => {
    const verse = (vid: Vid) => ({ cite_id: `v${vid}`, vid, text: '' });
    const lit = {
      before: [verse(FP_2_5 - 3), verse(FP_2_5 - 2), verse(FP_2_5 - 1)],
      after: [verse(FP_2_7 + 1), verse(FP_2_7 + 2), verse(FP_2_7 + 3)],
    };
    const n = literaryNeighborhood(lit as unknown as Parameters<typeof literaryNeighborhood>[0], { start: FP_2_5, end: FP_2_7 });
    expect(n.before.map((v) => v.vid)).toEqual([FP_2_5 - 2, FP_2_5 - 1]);
    expect(n.after.map((v) => v.vid)).toEqual([FP_2_7 + 1, FP_2_7 + 2]);
  });

  it('divisões que começam dentro do trecho', () => {
    const divs = [{ vid: FP_2_5 - 1 }, { vid: FP_2_5 }, { vid: FP_2_7 + 1 }];
    expect(passageDivisions(divs, { start: FP_2_5, end: FP_2_7 })).toEqual([{ vid: FP_2_5 }]);
  });
});

describe('cabeçalho da lente Texto', () => {
  it('AT: só os versículos, sem contagem de variantes', () => {
    expect(textoCountLabel(3, null)).toBe('3 vv');
  });

  it('NT: os versículos e as variantes entre edições (singular e plural)', () => {
    expect(textoCountLabel(2, 0)).toBe('2 vv · 0 variantes');
    expect(textoCountLabel(2, 1)).toBe('2 vv · 1 variante');
    expect(textoCountLabel(2, 4)).toBe('2 vv · 4 variantes');
  });
});

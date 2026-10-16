// Montagem do fio: ordem e títulos fixos, omissão sem dados, escolha da evidência de cada passo.
import { describe, expect, it } from 'vitest';
import type { Commentary, PanelData, Source, Token, VerseText, XRef } from '@sensus/core';
import { buildThread, THREAD_TITLES } from './thread';

const RANGE = { start: 50002005, end: 50002008 };

/** Painel mínimo: só os campos que o fio lê. Campos ausentes = sem dados naquela camada. */
function panelOf(p: {
  before?: VerseText[];
  tokens?: Token[];
  lexicon?: unknown[];
  concordance?: Record<string, { count: number; samples: VerseText[] }>;
  xrefs?: Array<XRef & { texts: VerseText[] }>;
  entities?: Array<{ name: string }>;
  dictionary?: Array<{ headword: string }>;
  commentaries?: Commentary[];
  sources?: Record<string, Source>;
} = {}): PanelData {
  return {
    range: { start: RANGE.start, end: RANGE.end },
    reference: 'Filipenses 2:5-8',
    layers: {
      text: { translations: [], original: p.tokens ?? [], variants: [] },
      literary: { before: p.before ?? [], after: [], divisions: [], bookIntro: [] },
      historical: {
        entities: (p.entities ?? []).map((e, i) => ({ cite_id: `ent:${i}`, source_id: 'theographic', type: 'person', description: null, lat: null, lon: null, data: null, ...e })),
        dictionary: (p.dictionary ?? []).map((d, i) => ({ cite_id: `dic:${i}`, source_id: 'sword-isbe', text: '', ...d })),
      },
      language: { lexicon: (p.lexicon ?? []) as never[], concordance: p.concordance ?? {} },
      intertext: { xrefs: p.xrefs ?? [], topics: [] },
      interpretation: { commentaries: p.commentaries ?? [] },
    },
    sources: p.sources ?? {},
  } as unknown as PanelData;
}

function tok(over: Partial<Token> & Pick<Token, 'cite_id' | 'vid' | 'pos' | 'surface' | 'editions'>): Token {
  return {
    source_id: 'tagnt',
    corpus: 'gnt',
    translit: null,
    lemma: null,
    strong: null,
    strong_base: null,
    morph: 'N-NSM',
    morph_desc: null,
    gloss_en: null,
    variant_note: null,
    alt_ref: null,
    ...over,
  };
}

const BEFORE: VerseText = { cite_id: 'txt:blivre:50002004', source_id: 'blivre', vid: 50002004, text: 'Tende em vós o mesmo sentimento.' } as VerseText;

/** Sítio de variação em Fp 2:5: TR/BYZ leem φρονείσθω; NA lê φρονεῖτε. */
const VARIANT_TOKENS: Token[] = [
  tok({ cite_id: 'tok:1', vid: 50002005, pos: 1, surface: 'Τοῦτο', editions: 'TR,BYZ,NA' }),
  tok({ cite_id: 'tok:2', vid: 50002005, pos: 2, surface: 'φρονείσθω', editions: 'TR,BYZ' }),
  tok({ cite_id: 'tok:3', vid: 50002005, pos: 3, surface: 'φρονεῖτε', editions: 'NA' }),
  tok({ cite_id: 'tok:4', vid: 50002005, pos: 4, surface: 'ἐν', editions: 'TR,BYZ,NA' }),
];

const HAPAX_TOKEN = tok({
  cite_id: 'tok:h',
  vid: 50002006,
  pos: 1,
  surface: 'ἁρπαγμόν',
  editions: 'TR,BYZ,NA',
  strong_base: 'G725',
  strong: 'G725',
  lemma: 'ἁρπαγμός',
  gloss_en: 'robbery',
});
const KENOSIS_TOKEN = tok({
  cite_id: 'tok:k',
  vid: 50002007,
  pos: 1,
  surface: 'ἐκένωσεν',
  editions: 'TR,BYZ,NA',
  strong_base: 'G2758',
  strong: 'G2758',
  lemma: 'κενόω',
});

const FULL = (): PanelData =>
  panelOf({
    before: [BEFORE],
    tokens: [...VARIANT_TOKENS, HAPAX_TOKEN, KENOSIS_TOKEN],
    concordance: { G725: { count: 1, samples: [] }, G2758: { count: 5, samples: [] } },
    xrefs: [
      { cite_id: 'xr:low', source_id: 'openbible-xref', from_vid: 50002005, to_start_vid: 47008009, to_end_vid: 47008009, weight: 0.2, texts: [{ cite_id: 'txt:a', text: 'baixo' } as VerseText] },
      { cite_id: 'xr:top', source_id: 'openbible-xref', from_vid: 50002005, to_start_vid: 47008009, to_end_vid: 47008009, weight: 0.9, texts: [{ cite_id: 'txt:b', text: 'sendo rico, se fez pobre' } as VerseText] },
    ],
    entities: [{ name: 'Filipos' }, { name: 'Timóteo' }, { name: 'Epafrodito' }, { name: 'Filipos' }],
    dictionary: [{ headword: 'KENOSIS' }],
    commentaries: [
      { cite_id: 'com:0', source_id: 'matthew-henry', start_vid: 50002005, end_vid: 50002005, text: 'x' },
      { cite_id: 'com:1', source_id: 'matthew-henry', start_vid: 50002005, end_vid: 50002005, text: 'x' },
      { cite_id: 'com:intro', source_id: 'matthew-henry', start_vid: 50002000, end_vid: 50002000, text: 'x' },
    ],
    sources: { 'matthew-henry': { id: 'matthew-henry', title: 'Matthew Henry', author: 'Matthew Henry (1662-1714)' } as Source },
  });

describe('buildThread', () => {
  it('sem painel não há passos (a folha ainda carrega)', () => {
    expect(buildThread({ panel: null, range: RANGE, books: [], hasAi: true })).toEqual([]);
  });

  it('com dados e IA, os passos saem na ordem narrativa e com os títulos fixos', () => {
    const steps = buildThread({ panel: FULL(), range: RANGE, books: [], hasAi: true });
    expect(steps.map((s) => s.lens)).toEqual(['literario', 'lingua', 'texto', 'intertexto', 'historico', 'interpretacao', 'aplicacao']);
    expect(steps.map((s) => s.title)).toEqual([
      'Onde estamos',
      'A palavra que move o trecho',
      'Os manuscritos divergem',
      'Ecos em outros textos',
      'Pessoas, lugares e contexto',
      'Como a igreja leu',
      'E para nós',
    ]);
    expect(steps.map((s) => THREAD_TITLES[s.lens])).toEqual(steps.map((s) => s.title));
  });

  it('sem IA, o passo Aplicação some e os demais continuam com evidência', () => {
    const steps = buildThread({ panel: FULL(), range: RANGE, books: [], hasAi: false });
    expect(steps.map((s) => s.lens)).not.toContain('aplicacao');
    expect(steps).toHaveLength(6);
  });

  it('Aplicação não tem evidência própria', () => {
    const app = buildThread({ panel: FULL(), range: RANGE, books: [], hasAi: true }).at(-1)!;
    expect(app.lens).toBe('aplicacao');
    expect(app.evidence).toBeNull();
  });

  it('omite passos sem dados no painel (sem variantes, sem vizinho, sem xrefs)', () => {
    const steps = buildThread({
      panel: panelOf({ tokens: [tok({ cite_id: 'tok:x', vid: 50002005, pos: 1, surface: 'Τοῦτο', editions: 'TR,BYZ,NA' })] }),
      range: RANGE,
      books: [],
      hasAi: false,
    });
    expect(steps.map((s) => s.lens)).toEqual([]);
  });

  it('sem variantes não há passo "Os manuscritos divergem"', () => {
    const steps = buildThread({ panel: panelOf({ tokens: VARIANT_TOKENS.filter((t) => t.editions === 'TR,BYZ,NA') }), range: RANGE, books: [], hasAi: false });
    expect(steps.map((s) => s.lens)).not.toContain('texto');
  });

  it('Literário: o versículo vizinho anterior mais próximo, com a referência', () => {
    const before2: VerseText = { ...BEFORE, cite_id: 'txt:x', vid: 50002003, text: 'mais antigo' } as VerseText;
    const step = buildThread({ panel: panelOf({ before: [before2, BEFORE] }), range: RANGE, books: [], hasAi: false })[0]!;
    expect(step.lens).toBe('literario');
    expect(step.evidence).toMatchObject({ kind: 'verse', text: 'Tende em vós o mesmo sentimento.' });
    expect(step.evidence && 'ref' in step.evidence && step.evidence.ref).toContain('2:4');
  });

  it('Língua: a palavra mais rara; hápax quando ocorre uma vez, "N vv." quando ocorre mais', () => {
    const steps = buildThread({ panel: FULL(), range: RANGE, books: [], hasAi: false });
    const lingua = steps.find((s) => s.lens === 'lingua')!;
    expect(lingua.evidence).toMatchObject({ kind: 'word', lemma: 'ἁρπαγμός', gloss: 'robbery', note: 'hápax', tokenCiteId: 'tok:h' });

    const common = buildThread({
      panel: panelOf({ tokens: [KENOSIS_TOKEN], concordance: { G2758: { count: 5, samples: [] } } }),
      range: RANGE,
      books: [],
      hasAi: false,
    })[0]!;
    expect(common.evidence).toMatchObject({ kind: 'word', lemma: 'κενόω', note: '5 vv. no NT' });
  });

  it('Texto: a primeira variante, com as leituras e as edições de cada uma; omissão vira "omite"', () => {
    const steps = buildThread({ panel: FULL(), range: RANGE, books: [], hasAi: false });
    const texto = steps.find((s) => s.lens === 'texto')!;
    expect(texto.evidence).toEqual({
      kind: 'variants',
      ref: '2:5',
      readings: [
        { text: 'φρονείσθω', editions: ['TR', 'BYZ'] },
        { text: 'φρονεῖτε', editions: ['NA'] },
      ],
    });
  });

  it('Intertexto: a referência cruzada de maior peso, com o texto do destino', () => {
    const steps = buildThread({ panel: FULL(), range: RANGE, books: [], hasAi: false });
    const inter = steps.find((s) => s.lens === 'intertexto')!;
    expect(inter.evidence).toMatchObject({ kind: 'xref', text: 'sendo rico, se fez pobre', citeId: 'xr:top' });
  });

  it('Histórico: até três nomes, entidades antes de verbetes, sem repetir', () => {
    const steps = buildThread({ panel: FULL(), range: RANGE, books: [], hasAi: false });
    const hist = steps.find((s) => s.lens === 'historico')!;
    expect(hist.evidence).toEqual({ kind: 'names', names: ['Filipos', 'Timóteo', 'Epafrodito'] });
  });

  it('Interpretação: comentaristas distintos sem introduções, com "e mais N" depois de cinco', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      cite_id: `com:${i}`,
      source_id: `src-${i}`,
      start_vid: 50002005,
      end_vid: 50002005,
      text: 'x',
    })) as Commentary[];
    const sources = Object.fromEntries(many.map((c) => [c.source_id, { id: c.source_id, title: `Autor ${c.source_id}`, author: `Autor ${c.source_id}` } as Source]));
    const steps = buildThread({ panel: panelOf({ commentaries: many, sources }), range: RANGE, books: [], hasAi: false });
    const interp = steps.find((s) => s.lens === 'interpretacao')!;
    expect(interp.evidence).toMatchObject({ kind: 'commentators', more: 2 });
    expect(interp.evidence && 'names' in interp.evidence && interp.evidence.names).toHaveLength(5);

    const withIntro = buildThread({ panel: FULL(), range: RANGE, books: [], hasAi: false }).find((s) => s.lens === 'interpretacao')!;
    expect(withIntro.evidence).toEqual({ kind: 'commentators', names: ['Matthew Henry'], more: 0 });
  });
});

// Montagem do fio: ordem e títulos fixos, omissão sem dados, escolha da evidência de cada passo.
import { describe, expect, it } from 'vitest';
import type { Block, Commentary, PanelData, Source, StructuredSummary, Token, VerseText, XRef } from '@sensus/core';
import { buildThread, THREAD_TITLES, type ThreadAi } from './thread';
import { isNameToken, normalizeForm } from './keyword';

const RANGE = { start: 50002005, end: 50002008 };
/** Sem IA configurada. */
const NO_AI: ThreadAi = { status: 'noprovider', summary: null };
/** IA terminada e sem resumo (só os fallbacks). */
const DONE: ThreadAi = { status: 'done', summary: null };

function summaryOf(over: Partial<StructuredSummary> = {}): StructuredSummary {
  return { overview: [], sections: {}, questions: [], complete: false, ...over };
}

/** Parágrafo do desenvolvimento da IA com as citações dadas (válidas). */
function citing(...citeIds: string[]): Block {
  return {
    type: 'paragraph',
    inlines: [{ type: 'cite', refs: citeIds.map((id) => ({ citeId: id, label: id, valid: true, citeIds: [id] })) }],
    claim: { kind: 'source', uncited: [], inference: [], morphConflicts: [] },
  };
}

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
    expect(buildThread({ panel: null, range: RANGE, books: [], ai: DONE })).toEqual([]);
  });

  it('com dados e IA, os passos saem na ordem narrativa e com os títulos fixos', () => {
    const steps = buildThread({ panel: FULL(), range: RANGE, books: [], ai: DONE });
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

  it('sem IA configurada, o passo Aplicação some e os demais continuam com evidência', () => {
    const steps = buildThread({ panel: FULL(), range: RANGE, books: [], ai: NO_AI });
    expect(steps.map((s) => s.lens)).not.toContain('aplicacao');
    expect(steps).toHaveLength(6);
  });

  it('Aplicação não tem evidência própria', () => {
    const app = buildThread({ panel: FULL(), range: RANGE, books: [], ai: DONE }).at(-1)!;
    expect(app.lens).toBe('aplicacao');
    expect(app.evidence).toBeNull();
  });

  it('omite passos sem dados no painel (sem variantes, sem vizinho, sem xrefs)', () => {
    const steps = buildThread({
      panel: panelOf({ tokens: [tok({ cite_id: 'tok:x', vid: 50002005, pos: 1, surface: 'Τοῦτο', editions: 'TR,BYZ,NA' })] }),
      range: RANGE,
      books: [],
      ai: NO_AI,
    });
    expect(steps.map((s) => s.lens)).toEqual([]);
  });

  it('sem variantes não há passo "Os manuscritos divergem"', () => {
    const steps = buildThread({ panel: panelOf({ tokens: VARIANT_TOKENS.filter((t) => t.editions === 'TR,BYZ,NA') }), range: RANGE, books: [], ai: NO_AI });
    expect(steps.map((s) => s.lens)).not.toContain('texto');
  });

  it('Literário: o versículo vizinho anterior mais próximo, com a referência', () => {
    const before2: VerseText = { ...BEFORE, cite_id: 'txt:x', vid: 50002003, text: 'mais antigo' } as VerseText;
    const step = buildThread({ panel: panelOf({ before: [before2, BEFORE] }), range: RANGE, books: [], ai: NO_AI })[0]!;
    expect(step.lens).toBe('literario');
    expect(step.evidence).toMatchObject({ kind: 'verse', text: 'Tende em vós o mesmo sentimento.' });
    expect(step.evidence && 'ref' in step.evidence && step.evidence.ref).toContain('2:4');
  });

  it('Texto: a primeira variante, com as leituras e as edições de cada uma; omissão vira "omite"', () => {
    const steps = buildThread({ panel: FULL(), range: RANGE, books: [], ai: DONE });
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
    const steps = buildThread({ panel: FULL(), range: RANGE, books: [], ai: DONE });
    const inter = steps.find((s) => s.lens === 'intertexto')!;
    expect(inter.evidence).toMatchObject({ kind: 'xref', text: 'sendo rico, se fez pobre', citeId: 'xr:top' });
  });

  it('Histórico: até três nomes, entidades antes de verbetes, sem repetir', () => {
    const steps = buildThread({ panel: FULL(), range: RANGE, books: [], ai: DONE });
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
    const steps = buildThread({ panel: panelOf({ commentaries: many, sources }), range: RANGE, books: [], ai: NO_AI });
    const interp = steps.find((s) => s.lens === 'interpretacao')!;
    expect(interp.evidence).toMatchObject({ kind: 'commentators', more: 2 });
    expect(interp.evidence && 'names' in interp.evidence && interp.evidence.names).toHaveLength(5);

    const withIntro = buildThread({ panel: FULL(), range: RANGE, books: [], ai: NO_AI }).find((s) => s.lens === 'interpretacao')!;
    expect(withIntro.evidence).toEqual({ kind: 'commentators', names: ['Matthew Henry'], more: 0 });
  });
});

/** Palavra de Língua do fio (painel FULL, sem menções nos comentários de teste): só o nome do passo importa aqui. */
function lingua(steps: ReturnType<typeof buildThread>) {
  return steps.find((s) => s.lens === 'lingua')?.evidence;
}

describe('Língua: a palavra que move o trecho (keyword.ts)', () => {
  it('a IA escolheu (linha "=" do resumo): a palavra escolhida, com by "ai"', () => {
    const ai: ThreadAi = { status: 'streaming', summary: summaryOf({ keyWordCiteId: 'tok:k' }) };
    expect(lingua(buildThread({ panel: FULL(), range: RANGE, books: [], ai }))).toMatchObject({
      kind: 'word',
      tokenCiteId: 'tok:k',
      lemma: 'κενόω',
      note: '5 vv. no NT',
      by: 'ai',
    });
  });

  it('IA ainda sem marcador e @lingua não terminou: esqueleto (pending), o passo fica', () => {
    const steps = buildThread({ panel: FULL(), range: RANGE, books: [], ai: { status: 'waiting', summary: null } });
    expect(lingua(steps)).toEqual({ kind: 'pending' });
    expect(steps.map((s) => s.lens)).toContain('lingua');
    const streaming = buildThread({ panel: FULL(), range: RANGE, books: [], ai: { status: 'streaming', summary: summaryOf({ sections: { literario: [] } }) } });
    expect(lingua(streaming)).toEqual({ kind: 'pending' });
  });

  it('a escolha da IA fora do trecho não conta: espera até @lingua terminar e cai nos fallbacks', () => {
    const fora: ThreadAi = { status: 'streaming', summary: summaryOf({ keyWordCiteId: 'tok:outro' }) };
    expect(lingua(buildThread({ panel: FULL(), range: RANGE, books: [], ai: fora }))).toEqual({ kind: 'pending' });
    const feito: ThreadAi = { status: 'done', summary: summaryOf({ keyWordCiteId: 'tok:outro' }) };
    expect(lingua(buildThread({ panel: FULL(), range: RANGE, books: [], ai: feito }))).toMatchObject({ tokenCiteId: 'tok:h', by: 'hapax' });
  });

  it('a seção @lingua acabou (a seguinte começou) sem marcador: passa aos fallbacks sem esperar', () => {
    const ai: ThreadAi = { status: 'streaming', summary: summaryOf({ sections: { texto: [] } }) };
    expect(lingua(buildThread({ panel: FULL(), range: RANGE, books: [], ai }))).toMatchObject({ tokenCiteId: 'tok:h', by: 'hapax' });
  });

  it('erro da IA: sem esperar, começa do fallback de comentários (aqui sem menções, cai no hápax)', () => {
    const ai: ThreadAi = { status: 'error', summary: null };
    expect(lingua(buildThread({ panel: FULL(), range: RANGE, books: [], ai }))).toMatchObject({ by: 'hapax' });
  });

  it('fallback 1: a seção @lingua citou um token do trecho sem marcar a palavra', () => {
    const ai: ThreadAi = { status: 'done', summary: summaryOf({ sections: { lingua: [citing('tok:k', 'tok:h')] } }) };
    expect(lingua(buildThread({ panel: FULL(), range: RANGE, books: [], ai }))).toMatchObject({ tokenCiteId: 'tok:k', by: 'section' });
  });

  it('fallback 1: só um lex: citado mapeia o Strong para um token do trecho', () => {
    const ai: ThreadAi = {
      status: 'done',
      summary: summaryOf({ sections: { lingua: [citing('lex:stepbible-tbesg:G2758')] } }),
    };
    expect(lingua(buildThread({ panel: FULL(), range: RANGE, books: [], ai }))).toMatchObject({ tokenCiteId: 'tok:k', by: 'section' });
  });

  it('fallback 1 ignora citações inválidas e cai no fallback seguinte', () => {
    const invalida: Block = {
      type: 'paragraph',
      inlines: [{ type: 'cite', refs: [{ citeId: 'tok:k', label: 'x', valid: false }] }],
      claim: { kind: 'source', uncited: [], inference: [], morphConflicts: [] },
    };
    const ai: ThreadAi = { status: 'done', summary: summaryOf({ sections: { lingua: [invalida] } }) };
    expect(lingua(buildThread({ panel: FULL(), range: RANGE, books: [], ai }))).toMatchObject({ by: 'hapax' });
  });

  it('fallback 2: a palavra mais mencionada nos comentários que cobrem o trecho, com a contagem', () => {
    const panel = panelOf({
      tokens: [HAPAX_TOKEN, KENOSIS_TOKEN],
      concordance: { G725: { count: 1, samples: [] }, G2758: { count: 5, samples: [] } },
      commentaries: [
        { cite_id: 'com:a', source_id: 'c', start_vid: 50002005, end_vid: 50002005, text: 'Ele se esvaziou: ἐκένωσεν, a kenosis de ἐκένωσεν.' },
        { cite_id: 'com:b', source_id: 'c', start_vid: 50002006, end_vid: 50002006, text: 'κενόω aparece aqui.' },
      ] as Commentary[],
      sources: { c: { id: 'c', title: 'C', author: 'C' } as Source },
    });
    expect(lingua(buildThread({ panel, range: RANGE, books: [], ai: DONE }))).toMatchObject({ tokenCiteId: 'tok:k', by: 'commentary', mentions: 3 });
  });

  it('fallback 2: a glosa em inglês não conta (gain não casa com κέρδος)', () => {
    const KERDOS = tok({ cite_id: 'tok:kerdos', vid: 50002006, pos: 2, surface: 'κέρδος', editions: 'TR,BYZ,NA', strong_base: 'G2771', strong: 'G2771', lemma: 'κέρδος', gloss_en: 'gain' });
    const panel = panelOf({
      tokens: [KERDOS, HAPAX_TOKEN],
      concordance: { G2771: { count: 3, samples: [] }, G725: { count: 1, samples: [] } },
      commentaries: [{ cite_id: 'com:g', source_id: 'c', start_vid: 50002005, end_vid: 50002005, text: 'No gain for them, and gain is not the point.' }] as Commentary[],
      sources: { c: { id: 'c', title: 'C', author: 'C' } as Source },
    });
    expect(lingua(buildThread({ panel, range: RANGE, books: [], ai: DONE }))).toMatchObject({ tokenCiteId: 'tok:h', by: 'hapax' });
  });

  it('fallback 2: casa a transliteração e ignora comentários que não cobrem o trecho', () => {
    const panel = panelOf({
      tokens: [{ ...KENOSIS_TOKEN, translit: 'kenōsen' }],
      concordance: { G2758: { count: 5, samples: [] } },
      commentaries: [
        { cite_id: 'com:fora', source_id: 'c', start_vid: 50002009, end_vid: 50002009, text: 'kenosen kenosen kenosen' },
        { cite_id: 'com:dentro', source_id: 'c', start_vid: 50002007, end_vid: 50002007, text: 'Kenosen, emptied.' },
      ] as Commentary[],
      sources: { c: { id: 'c', title: 'C', author: 'C' } as Source },
    });
    expect(lingua(buildThread({ panel, range: RANGE, books: [], ai: DONE }))).toMatchObject({ tokenCiteId: 'tok:k', by: 'commentary', mentions: 1 });
  });

  it('fallback 3: sem menções, o hápax do trecho', () => {
    expect(lingua(buildThread({ panel: FULL(), range: RANGE, books: [], ai: DONE }))).toMatchObject({
      kind: 'word',
      tokenCiteId: 'tok:h',
      lemma: 'ἁρπαγμός',
      gloss: 'robbery',
      note: 'hápax',
      by: 'hapax',
    });
  });

  it('fallback 4: sem comentários nem hápax, um verbo (o mais repetido no trecho; no empate, o mais raro no NT)', () => {
    const VERB_A = tok({ cite_id: 'tok:va', vid: 50002005, pos: 1, surface: 'ἔπεμψα', editions: 'TR,BYZ,NA', strong_base: 'G3992', strong: 'G3992', lemma: 'πέμπω', morph: 'V-AAI-1S', morph_desc: 'Verb; Tense=Aorist' });
    const VERB_B = tok({ cite_id: 'tok:vb', vid: 50002006, pos: 1, surface: 'ἐκένωσεν', editions: 'TR,BYZ,NA', strong_base: 'G2758', strong: 'G2758', lemma: 'κενόω', morph: 'V-AAI-3S', morph_desc: 'Verb; Tense=Aorist' });
    const VERB_C = tok({ cite_id: 'tok:vc', vid: 50002007, pos: 1, surface: 'ἐταπείνωσεν', editions: 'TR,BYZ,NA', strong_base: 'G5013', strong: 'G5013', lemma: 'ταπεινόω', morph: 'V-AAI-3S', morph_desc: 'Verb; Tense=Aorist' });
    const panel = panelOf({
      tokens: [VERB_A, VERB_B, VERB_C],
      concordance: { G3992: { count: 90, samples: [] }, G2758: { count: 5, samples: [] }, G5013: { count: 11, samples: [] } },
    });
    expect(lingua(buildThread({ panel, range: RANGE, books: [], ai: DONE }))).toMatchObject({ tokenCiteId: 'tok:vb', by: 'verb', note: '5 vv. no NT' });

    const repetido = panelOf({
      tokens: [VERB_A, VERB_B, { ...VERB_A, cite_id: 'tok:va2', vid: 50002008, pos: 2 }],
      concordance: { G3992: { count: 90, samples: [] }, G2758: { count: 5, samples: [] } },
    });
    expect(lingua(buildThread({ panel: repetido, range: RANGE, books: [], ai: DONE }))).toMatchObject({ tokenCiteId: 'tok:va', by: 'verb' });
  });

  it('sem nenhuma palavra possível (só função), o passo é omitido', () => {
    const artigo = tok({ cite_id: 'tok:art', vid: 50002005, pos: 1, surface: 'τὸ', editions: 'TR,BYZ,NA', strong_base: 'G3588', strong: 'G3588', lemma: 'ὁ', morph: 'T-ASN' });
    const steps = buildThread({ panel: panelOf({ tokens: [artigo] }), range: RANGE, books: [], ai: DONE });
    expect(steps.map((s) => s.lens)).not.toContain('lingua');
  });

  it('normalização: sem acentos, sem diacríticos e sigma final como σ', () => {
    expect(normalizeForm('ἁρπαγμὸν')).toBe('αρπαγμον');
    expect(normalizeForm('ΚΑΙΣ')).toBe('καισ');
    expect(normalizeForm('Kenōsis')).toBe('kenosis');
  });
});

describe('Língua: nomes próprios e formas curtas ficam de fora dos fallbacks', () => {
  const ISRAEL = tok({
    cite_id: 'tok:israel',
    vid: 50002006,
    pos: 2,
    surface: 'Ἰσραήλ',
    editions: 'TR,BYZ,NA',
    strong_base: 'G2474',
    strong: 'G2474',
    lemma: 'Ἰσραήλ',
    translit: 'Israēl',
    gloss_en: 'Israel',
    morph: 'N-GSM-L',
    morph_desc: 'Noun; Case=Genitive; Number=Singular; Gender=Masculine; Name type=Location',
  });
  const COMMENT_ISRAEL: Commentary[] = [
    { cite_id: 'com:i', source_id: 'c', start_vid: 50002005, end_vid: 50002005, text: 'Israel, Israel and Israel again.' },
  ] as Commentary[];
  const SOURCES = { c: { id: 'c', title: 'C', author: 'C' } as Source };

  it('nome próprio é reconhecido pela morfologia do TAGNT; palavra comum não', () => {
    expect(isNameToken(ISRAEL)).toBe(true);
    expect(isNameToken(KENOSIS_TOKEN)).toBe(false);
  });

  it('fallback 2: um nome muito mencionado nos comentários não é escolhido', () => {
    const panel = panelOf({
      tokens: [ISRAEL, HAPAX_TOKEN],
      concordance: { G2474: { count: 68, samples: [] }, G725: { count: 1, samples: [] } },
      commentaries: COMMENT_ISRAEL,
      sources: SOURCES,
    });
    expect(lingua(buildThread({ panel, range: RANGE, books: [], ai: DONE }))).toMatchObject({ tokenCiteId: 'tok:h', by: 'hapax' });
  });

  it('fallback 3 e 4: nomes não viram hápax nem verbo', () => {
    const rare = { ...ISRAEL, morph: 'N-GSM-L' };
    const sozinho = panelOf({ tokens: [rare], concordance: { G2474: { count: 1, samples: [] } } });
    expect(lingua(buildThread({ panel: sozinho, range: RANGE, books: [], ai: DONE }))).toBeUndefined();
  });

  it('a IA continua livre para escolher um nome (by "ai")', () => {
    const panel = panelOf({ tokens: [ISRAEL], concordance: { G2474: { count: 68, samples: [] } } });
    const ai: ThreadAi = { status: 'streaming', summary: summaryOf({ keyWordCiteId: 'tok:israel' }) };
    expect(lingua(buildThread({ panel, range: RANGE, books: [], ai }))).toMatchObject({ tokenCiteId: 'tok:israel', by: 'ai' });
  });

  it('fallback 1: um nome citado pelo desenvolvimento da IA ainda pode ser a palavra', () => {
    const panel = panelOf({ tokens: [ISRAEL], concordance: { G2474: { count: 68, samples: [] } } });
    const ai: ThreadAi = { status: 'done', summary: summaryOf({ sections: { lingua: [citing('tok:israel')] } }) };
    expect(lingua(buildThread({ panel, range: RANGE, books: [], ai }))).toMatchObject({ tokenCiteId: 'tok:israel', by: 'section' });
  });

  it('fallback 2: forma com menos de quatro letras não conta (en de ἦν não vira menção)', () => {
    const EIMI = tok({
      cite_id: 'tok:en',
      vid: 50002006,
      pos: 3,
      surface: 'ἦν',
      editions: 'TR,BYZ,NA',
      strong_base: 'G1510',
      strong: 'G1510',
      lemma: 'εἰμί',
      translit: 'en',
      morph: 'V-IAI-3S',
      morph_desc: 'Verb; Tense=Imperfect; Voice=Active; Mood=Indicative',
    });
    const panel = panelOf({
      tokens: [EIMI, KENOSIS_TOKEN],
      concordance: { G1510: { count: 2050, samples: [] }, G2758: { count: 5, samples: [] } },
      commentaries: [{ cite_id: 'com:en', source_id: 'c', start_vid: 50002005, end_vid: 50002005, text: 'en en en en kai kai' }] as Commentary[],
      sources: SOURCES,
    });
    // Sem menção válida, cai no verbo (ἦν é o único verbo do trecho).
    expect(lingua(buildThread({ panel, range: RANGE, books: [], ai: DONE }))).toMatchObject({ tokenCiteId: 'tok:en', by: 'verb' });
  });
});


// Chamadores do núcleo que usam o domínio (docs/ARCHITECTURE_REVIEW.md, passo 3 e 4): ordem de fontes de lugares,
// léxico longo, língua de palavra em texto da IA (com aramaico), vid empacotado, segmentação para tradução e
// camada 4 do painel no AT. Fixtures: fixtures.ts (NT grego, Fp 2) e fixtures-ot.ts (1Rs 15:15, Dn 2:4).
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildPanel,
  isLongLexiconSource,
  langOfWordText,
  packVid,
  parseRichText,
  placeSourceRank,
  Repo,
  segmentForTranslation,
  serializePanel,
  unpackVid,
  type Block,
  type Inline,
  type RichTextContext,
  type Token,
} from '../src/index';
import { createFixtureDb, driverFor } from './fixtures';
import { VID_1KGS_15_15, VID_DAN_2_4, seedOldTestament } from './fixtures-ot';

describe('fontes de lugares, léxico longo e vid (domínio)', () => {
  it('ordem de preferência das fontes de lugares; fonte desconhecida fica por último', () => {
    expect(placeSourceRank('openbible-geo')).toBe(0);
    expect(placeSourceRank('theographic')).toBe(1);
    expect(placeSourceRank('stepbible-tipnr')).toBe(2);
    expect(placeSourceRank('outra-fonte')).toBe(9);
  });

  it('só o LSJ grego é léxico longo', () => {
    expect(isLongLexiconSource('stepbible-tflsj')).toBe(true);
    expect(isLongLexiconSource('stepbible-tbesg')).toBe(false);
    expect(isLongLexiconSource('stepbible-tbesh')).toBe(false);
  });

  it('vid empacotado e desempacotado (1Rs 15:15 e Fp 2:7)', () => {
    expect(packVid(11, 15, 15)).toBe(VID_1KGS_15_15);
    expect(unpackVid(VID_1KGS_15_15)).toEqual({ book: 11, chapter: 15, verse: 15 });
    expect(unpackVid(50002007)).toEqual({ book: 50, chapter: 2, verse: 7 });
  });
});

describe('língua de palavra sem token (escrita) ', () => {
  it('hebraico (com pontos) é hbo; grego é grc', () => {
    expect(langOfWordText('בְּרֵאשִׁית')).toBe('hbo');
    expect(langOfWordText('λόγος')).toBe('grc');
  });
});

describe('texto da IA: língua da palavra original (aramaico pelo token)', () => {
  let db: DatabaseSync;
  let ctx: RichTextContext;

  beforeEach(async () => {
    db = createFixtureDb();
    const repo = new Repo(driverFor(db));
    const panel = await buildPanel(repo, { start: 50002005, end: 50002005 }, { contextVerses: 0 });
    ctx = { citeIds: new Set(), citeIndex: new Map(), tokens: panel.layers.text.original };
  });

  afterEach(() => db.close());

  it('palavra com token aramaico (ANcbsd/Ta) é arc; hebraica sem token é hbo; o token é citado', () => {
    const aramaic: Token = {
      ...ctx.tokens![0]!,
      cite_id: 'tok:hot:27002004:5',
      corpus: 'hot',
      surface: 'מַלְכָּא',
      morph: 'ANcbsd/Ta',
    };
    const blocks = parseRichText('O rei מַלְכָּא e o nome בְּרֵאשִׁית.', { ...ctx, tokens: [aramaic] });
    const paragraph = blocks[0] as Extract<Block, { type: 'paragraph' }>;
    const originals = paragraph.inlines.filter((i): i is Extract<Inline, { type: 'original' }> => i.type === 'original');
    expect(originals.map((o) => [o.text, o.lang])).toEqual([
      ['מַלְכָּא', 'arc'],
      ['בְּרֵאשִׁית', 'hbo'],
    ]);
    expect(originals[0]!.tokenCiteId).toBe('tok:hot:27002004:5');
    expect(originals[1]!.tokenCiteId).toBeUndefined();
  });

  it('palavra grega com token do NT continua grc', () => {
    const greek = ctx.tokens!.find((t) => t.corpus === 'gnt' && t.surface.length > 0)!;
    const blocks = parseRichText(`Veja ${greek.surface}.`, ctx);
    const paragraph = blocks[0] as Extract<Block, { type: 'paragraph' }>;
    const original = paragraph.inlines.find((i): i is Extract<Inline, { type: 'original' }> => i.type === 'original');
    expect(original?.lang).toBe('grc');
    expect(original?.tokenCiteId).toBe(greek.cite_id);
  });
});

describe('segmentação para tradução: escrita e léxicos do domínio', () => {
  const runs = (text: string): string[] =>
    segmentForTranslation(text)
      .filter((s) => s.kind === 'translate')
      .map((s) => s.text);

  it('hebraico com pontos e o léxico TBESH não vão ao tradutor', () => {
    const joined = runs('Veja בְּרֵאשִׁית e o léxico TBESH aqui.').join(' ');
    expect(joined).not.toContain('בְּרֵאשִׁית');
    expect(joined).not.toContain('TBESH');
    expect(joined).toContain('Veja');
  });

  it('grego com polytonismo continua protegido', () => {
    expect(runs('Veja φρονεῖτε agora.').join(' ')).not.toContain('φρονεῖτε');
  });
});

describe('camada 4 do painel no AT (palavras de conteúdo por língua)', () => {
  let db: DatabaseSync;
  let repo: Repo;

  const layer4 = (text: string): string =>
    text.split('### Palavras de conteúdo (análise morfológica)')[1]?.split('\n### ')[0] ?? '';

  beforeEach(() => {
    db = createFixtureDb();
    seedOldTestament(db);
    repo = new Repo(driverFor(db));
  });

  afterEach(() => db.close());

  it('1Rs 15:15: a partícula de objeto (HTo) não entra como palavra de conteúdo', async () => {
    const panel = await buildPanel(repo, { start: VID_1KGS_15_15, end: VID_1KGS_15_15 }, { contextVerses: 1 });
    const section = layer4(serializePanel(panel).text);
    expect(section).toContain('morfologia Hc/Vhw3ms');
    expect(section).not.toContain('morfologia HTo');
  });

  it('Dn 2:4: palavras aramaicas de conteúdo entram com a sua morfologia', async () => {
    const panel = await buildPanel(repo, { start: VID_DAN_2_4, end: VID_DAN_2_4 }, { contextVerses: 0 });
    const section = layer4(serializePanel(panel).text);
    expect(section).toContain('morfologia ANcbsd/Ta');
    expect(section).toContain('morfologia AR/Ncbsc/Sp2ms');
  });
});

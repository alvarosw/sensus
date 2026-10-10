import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { buildPanel, Repo, type PanelData } from '../src/index';
import { createFixtureDb, driverFor } from './fixtures';

const RANGE = { start: 50002005, end: 50002008 };

let db: DatabaseSync;
let repo: Repo;

beforeEach(() => {
  db = createFixtureDb();
  repo = new Repo(driverFor(db));
});

afterEach(() => {
  db.close();
});

describe('Repo', () => {
  it('lista livros e fontes', async () => {
    const books = await repo.books();
    expect(books.map((b) => b.osis)).toEqual(['Phil', 'Col']);
    expect((await repo.sources()).length).toBe(10);
    expect((await repo.source('blivre'))?.kind).toBe('text');
    expect(await repo.source('nao-existe')).toBeNull();
  });

  it('lê um capítulo e vizinhos de um texto', async () => {
    const chapter = await repo.chapter('blivre', 50, 2);
    expect(chapter.map((v) => v.vid)).toEqual([50002004, 50002005, 50002006, 50002007, 50002008, 50002009]);

    const neighbors = await repo.neighbors('blivre', RANGE, 2);
    expect(neighbors.before.map((v) => v.vid)).toEqual([50001002, 50002004]);
    expect(neighbors.after.map((v) => v.vid)).toEqual([50002009, 50003001]);
  });

  it('retorna divisões: título vigente antes do intervalo e as que começam nele', async () => {
    const divisions = await repo.divisions('blivre', RANGE);
    expect(divisions.map((d) => [d.vid, d.title])).toEqual([
      [50001001, 'Saudação'],
      [50002005, 'O exemplo de Cristo'],
      [50003001, null],
    ]);
  });

  it('delimita a unidade literária: divisão anterior até o versículo antes da próxima', async () => {
    expect(await repo.literaryUnit('blivre', RANGE)).toEqual({ start: 50002005, end: 50002009 });
    // Divisão "Saudação" (1:1) até o versículo antes da divisão seguinte (2:5).
    expect(await repo.literaryUnit('blivre', { start: 50001002, end: 50001002 })).toEqual({
      start: 50001001,
      end: 50002004,
    });
    // Sem divisão antes nem depois (outro livro): começa no início do livro e vai ao último versículo.
    expect(await repo.literaryUnit('blivre', { start: 51001001, end: 51001001 })).toEqual({
      start: 51000000,
      end: 51001001,
    });
  });

  it('inclui versículos da unidade nos vizinhos, além da janela de contexto', async () => {
    const unitWide = await repo.neighbors('blivre', RANGE, 0, { start: 50002004, end: 50002011 });
    expect(unitWide.before.map((v) => v.vid)).toEqual([50002004]);
    expect(unitWide.after.map((v) => v.vid)).toEqual([50002009]);
    const none = await repo.neighbors('blivre', RANGE, 0);
    expect(none).toEqual({ before: [], after: [] });
  });

  it('filtra tokens por corpus e ordena por vid e pos', async () => {
    const tokens = await repo.tokens(RANGE);
    expect(tokens.map((t) => t.pos)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(await repo.tokens(RANGE, 'hot')).toEqual([]);
  });

  it('busca léxico por strong_base', async () => {
    const entries = await repo.lexicon(['G1722', 'G2424', 'G9999']);
    expect(entries.map((e) => e.strong_base)).toEqual(['G1722', 'G2424']);
    expect(await repo.lexicon([])).toEqual([]);
  });

  it('conta ocorrências e exclui o intervalo dos exemplos', async () => {
    const all = await repo.concordance('G1722', 'blivre', 5);
    expect(all.count).toBe(3);
    expect(all.samples.map((s) => s.vid)).toEqual([50001001, 50002005, 50002006]);

    const others = await repo.concordance('G1722', 'blivre', 5, RANGE);
    expect(others.count).toBe(3);
    expect(others.samples.map((s) => s.vid)).toEqual([50001001]);
  });

  it('retorna comentários sobrepostos e as introduções do capítulo e do livro', async () => {
    const rows = await repo.commentaries(RANGE);
    expect(rows.map((c) => c.cite_id)).toEqual([
      'com:com-disp:50000000-50000000',
      'com:com-ref:50002000-50002000',
      'com:com-disp:50002005-50002011',
      'com:com-ref:50002005-50002011',
    ]);
  });

  it('une dicionários e índices temáticos pelo entry_ref, com o tipo da fonte', async () => {
    const dict = await repo.dictionaryEntries(RANGE, ['dictionary']);
    expect(dict.map((d) => d.cite_id)).toContain('dic:easton:christ');
    expect(dict.every((d) => d.kind === 'dictionary')).toBe(true);

    const topics = await repo.dictionaryEntries(RANGE, ['topical']);
    expect(topics.map((d) => d.cite_id)).toEqual(['dic:nave:humility']);
  });

  it('acha o verbete de introdução do livro pelo headword', async () => {
    const intro = await repo.bookIntro({ name_en: 'Philippians', name_pt: 'Filipenses' });
    expect(intro.map((d) => d.cite_id)).toEqual(['dic:easton:philippians-epistle-to-the']);
  });

  it('ordena referências cruzadas por peso e traz o texto dos alvos', async () => {
    const xrefs = await repo.xrefs(RANGE, 12);
    expect(xrefs.map((x) => x.weight)).toEqual([9.5, 2, null]);
    expect(xrefs[0]?.texts.map((v) => v.vid)).toEqual([50001002]);
  });

  it('lista entidades ligadas ao intervalo', async () => {
    expect((await repo.entities(RANGE)).map((e) => e.name)).toEqual(['Paulo']);
  });

  it('resolve cite_ids de todos os tipos e recusa ids desconhecidos', async () => {
    expect((await repo.resolveCite('txt:blivre:50002005'))?.table).toBe('verse_text');
    expect((await repo.resolveCite('tok:gnt:50002005:1'))?.table).toBe('token');
    expect((await repo.resolveCite('lex:strongs-gr:G1722'))?.table).toBe('lexicon_entry');
    expect((await repo.resolveCite('com:com-ref:50002005-50002011'))?.table).toBe('commentary');
    expect((await repo.resolveCite('dic:easton:christ'))?.table).toBe('dictionary_entry');
    expect((await repo.resolveCite('xr:openbible:50002005:50001002-50001002'))?.table).toBe('xref');
    expect((await repo.resolveCite('ent:isbe-ent:paulo'))?.table).toBe('entity');

    expect(await repo.resolveCite('txt:blivre:1')).toBeNull();
    expect(await repo.resolveCite('zzz:x:1')).toBeNull();
    expect(await repo.resolveCite('semdoispontos')).toBeNull();
  });
});

describe('buildPanel', () => {
  let panel: PanelData;

  beforeEach(async () => {
    panel = await buildPanel(repo, RANGE, { contextVerses: 2 });
  });

  it('monta a referência em pt-BR e as seis camadas', () => {
    expect(panel.reference).toBe('Filipenses 2:5-8');
    expect(panel.range).toEqual(RANGE);
    expect(panel.layers.text.translations.map((v) => v.cite_id)).toEqual(
      expect.arrayContaining(['txt:blivre:50002005', 'txt:kjv:50002005', 'txt:blivre:50002008']),
    );
    expect(panel.layers.text.translations).toHaveLength(5);
  });

  it('marca como variantes as palavras gregas fora de TR, BYZ ou NA', () => {
    expect(panel.layers.text.original).toHaveLength(7);
    expect(panel.layers.text.variants.map((t) => t.pos)).toEqual([5, 7]);
  });

  it('traz versículos vizinhos sem cruzar o livro', () => {
    expect(panel.layers.literary.before.map((v) => v.vid)).toEqual([50001002, 50002004]);
    expect(panel.layers.literary.after.map((v) => v.vid)).toEqual([50002009, 50003001]);
    expect(panel.layers.literary.divisions.map((d) => d.title)).toEqual(['Saudação', 'O exemplo de Cristo', null]);
    expect(panel.layers.literary.unit).toEqual({ start: 50002005, end: 50002009 });
    expect(panel.layers.literary.bookIntro.map((d) => d.cite_id)).toEqual(['dic:easton:philippians-epistle-to-the']);
  });

  it('separa dicionário e temas, e lista entidades', () => {
    expect(panel.layers.historical.dictionary.map((d) => d.cite_id)).toContain('dic:easton:christ');
    expect(panel.layers.intertext.topics.map((d) => d.cite_id)).toEqual(['dic:nave:humility']);
    expect(panel.layers.historical.entities.map((e) => e.cite_id)).toEqual(['ent:isbe-ent:paulo']);
  });

  it('faz léxico e concordância para cada strong_base do intervalo', () => {
    expect(panel.layers.language.lexicon.map((e) => e.strong_base)).toEqual(['G5426', 'G1722', 'G2424']);
    expect(Object.keys(panel.layers.language.concordance).sort()).toEqual(
      ['G1438', 'G1722', 'G2424', 'G3739', 'G5124', 'G5426'].sort(),
    );
    expect(panel.layers.language.concordance.G1722?.count).toBe(3);
    expect(panel.layers.language.concordance.G1722?.samples.length).toBeLessThanOrEqual(3);
  });

  it('reúne comentários de duas tradições e as introduções', () => {
    expect(panel.layers.interpretation.commentaries).toHaveLength(4);
  });

  it('preenche o mapa de fontes com as referenciadas', () => {
    expect(Object.keys(panel.sources).sort()).toEqual(
      ['blivre', 'com-disp', 'com-ref', 'easton', 'isbe-ent', 'kjv', 'nave', 'openbible', 'strongs-gr', 'tagnt'].sort(),
    );
    expect(panel.sources.blivre?.title).toBe('Bíblia Livre');
  });

  it('respeita o limite de exemplos de concordância', async () => {
    const small = await buildPanel(repo, RANGE, { limits: { concordanceSamples: 0 } });
    expect(small.layers.language.concordance.G1722?.samples).toEqual([]);
    expect(small.layers.language.concordance.G1722?.count).toBe(3);
  });
});

// Repo com textDriver: o texto de uma Bíblia baixada vem do banco dela, e o resto (referências, léxico, fontes
// principais) continua no banco principal. Os dois bancos são de teste, criados aqui: um banco principal (fixture
// de Filipenses) e um banco de pacote mínimo com a Bíblia "rvr1909" (NT: Fp 2:5; AT: 1Rs 15:15).
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildPanel, Repo } from '../src/index';
import { createFixtureDb, driverFor, insert, source } from './fixtures';
import { seedOldTestament, VID_1KGS_15_15 } from './fixtures-ot';

const SCHEMA = new URL('../../../pipeline/schema.sql', import.meta.url);
const BIBLE = 'rvr1909';
const VID_FP_2_5 = 50002005;
const VID_FP_2_4 = 50002004;
const VID_FP_2_6 = 50002006;
const VID_1KGS_15_14 = 11015014;

/** Banco de pacote mínimo: esquema lógico, uma fonte de texto e versículos de NT e AT. */
function createBibleDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(SCHEMA, 'utf8'));
  insert(db, 'source', [source(BIBLE, 'text', 'Reina-Valera 1909', { lang: 'es', attribution: 'teste' })]);
  insert(db, 'verse_text', [
    { cite_id: `txt:${BIBLE}:${VID_FP_2_4}`, source_id: BIBLE, vid: VID_FP_2_4, text: 'No mirando cada uno a lo suyo propio' },
    { cite_id: `txt:${BIBLE}:${VID_FP_2_5}`, source_id: BIBLE, vid: VID_FP_2_5, text: 'Haya, pues, en vosotros este sentir' },
    { cite_id: `txt:${BIBLE}:${VID_FP_2_6}`, source_id: BIBLE, vid: VID_FP_2_6, text: 'El cual, siendo en forma de Dios' },
    { cite_id: `txt:${BIBLE}:${VID_1KGS_15_14}`, source_id: BIBLE, vid: VID_1KGS_15_14, text: 'Mas el corazón de Asa fue perfecto' },
    { cite_id: `txt:${BIBLE}:${VID_1KGS_15_15}`, source_id: BIBLE, vid: VID_1KGS_15_15, text: 'Metió en el tesoro de la casa de Jehová' },
  ]);
  insert(db, 'text_division', [
    { source_id: BIBLE, vid: VID_FP_2_5, kind: 'heading', title: 'Cristo, ejemplo de humildad' },
    { source_id: BIBLE, vid: VID_1KGS_15_15, kind: 'paragraph', title: null },
  ]);
  return db;
}

let main: DatabaseSync;
let bible: DatabaseSync;
let repo: Repo;
let plain: Repo;

beforeEach(() => {
  main = createFixtureDb();
  seedOldTestament(main);
  bible = createBibleDb();
  repo = new Repo(driverFor(main), {
    textDriver: (sourceId) => (sourceId === BIBLE ? driverFor(bible) : null),
  });
  plain = new Repo(driverFor(main));
});

afterEach(() => {
  main.close();
  bible.close();
});

describe('Repo com textDriver', () => {
  it('verseTexts da Bíblia baixada lê o banco dela (NT, Fp 2:5)', async () => {
    const [v] = await repo.verseTexts(BIBLE, { start: VID_FP_2_5, end: VID_FP_2_5 });
    expect(v?.text).toBe('Haya, pues, en vosotros este sentir');
    expect(v?.source_id).toBe(BIBLE);
  });

  it('verseTexts da Bíblia baixada no AT (1Rs 15:15)', async () => {
    const [v] = await repo.verseTexts(BIBLE, { start: VID_1KGS_15_15, end: VID_1KGS_15_15 });
    expect(v?.text).toBe('Metió en el tesoro de la casa de Jehová');
  });

  it('fontes do banco principal continuam no principal (BLivre não está no pacote)', async () => {
    const blivre = await repo.verseTexts('blivre', { start: VID_FP_2_5, end: VID_FP_2_5 });
    expect(blivre[0]?.text).toBe('Tende em vós o mesmo sentimento que houve também em Cristo Jesus,');
    expect(await repo.verseTexts(BIBLE, { start: VID_FP_2_5, end: VID_FP_2_5 }, 1)).toHaveLength(1);
  });

  it('chapter e neighbors leem o texto da Bíblia baixada, com a mesma regra de livro', async () => {
    const cap = await repo.chapter(BIBLE, 50, 2);
    expect(cap.map((v) => v.vid)).toEqual([VID_FP_2_4, VID_FP_2_5, VID_FP_2_6]);
    const near = await repo.neighbors(BIBLE, { start: VID_FP_2_5, end: VID_FP_2_5 }, 1);
    expect(near.before.map((v) => v.vid)).toEqual([VID_FP_2_4]);
    expect(near.after.map((v) => v.vid)).toEqual([VID_FP_2_6]);
  });

  it('divisions lê as divisões da Bíblia baixada', async () => {
    const divs = await repo.divisions(BIBLE, { start: VID_FP_2_6, end: VID_FP_2_6 });
    expect(divs.map((d) => d.title)).toContain('Cristo, ejemplo de humildad');
  });

  it('literaryUnit mistura os bancos: parágrafos do original (principal) e o último versículo da Bíblia baixada', async () => {
    // Fp 2:1 é parágrafo do TAGNT (banco principal); o fim vem do último versículo da Bíblia baixada (2:6).
    const unit = await repo.literaryUnit(BIBLE, { start: VID_FP_2_5, end: VID_FP_2_5 });
    expect(unit).toEqual({ start: 50002001, end: VID_FP_2_6 });
  });

  it('xrefs leem as referências no principal e o texto dos alvos na Bíblia baixada', async () => {
    const plainXrefs = await plain.xrefs({ start: VID_FP_2_5, end: VID_FP_2_5 }, 5);
    const withBible = await repo.xrefs({ start: VID_FP_2_5, end: VID_FP_2_5 }, 5, BIBLE);
    expect(withBible.map((x) => x.cite_id)).toEqual(plainXrefs.map((x) => x.cite_id));
    expect(withBible.every((x) => x.texts.every((t) => t.source_id === BIBLE))).toBe(true);
  });

  it('consultas fora do texto (léxico, concordância) não mudam', async () => {
    expect((await repo.lexicon(['H0935'])).map((e) => e.cite_id)).toEqual(
      (await plain.lexicon(['H0935'])).map((e) => e.cite_id),
    );
    expect((await repo.concordance('H0935', 'blivre', 3)).count).toBe((await plain.concordance('H0935', 'blivre', 3)).count);
  });

  it('sem a opção, o comportamento é o do banco principal', async () => {
    expect(await plain.verseTexts(BIBLE, { start: VID_FP_2_5, end: VID_FP_2_5 })).toEqual([]);
    const cap = await plain.chapter('blivre', 50, 2);
    expect(cap.length).toBeGreaterThan(0);
    expect(cap.every((v) => v.source_id === 'blivre')).toBe(true);
  });

  it('textDriver que devolve null cai no principal', async () => {
    const fallback = new Repo(driverFor(main), { textDriver: () => null });
    const [v] = await fallback.verseTexts('blivre', { start: VID_FP_2_4, end: VID_FP_2_4 });
    expect(v?.source_id).toBe('blivre');
  });
});

describe('concordância e citações com textDriver', () => {
  it('amostras da concordância vêm do banco da Bíblia baixada (NT grego, Fp 2:5, G5426)', async () => {
    const c = await repo.concordance('G5426', BIBLE, 3);
    expect(c.count).toBe((await plain.concordance('G5426', 'blivre', 3)).count);
    expect(c.samples.map((s) => s.vid)).toEqual([VID_FP_2_5]);
    expect(c.samples[0]?.source_id).toBe(BIBLE);
    expect(c.samples[0]?.text).toBe('Haya, pues, en vosotros este sentir');
  });

  it('amostras da concordância no AT hebraico (1Rs 15:15, H0935)', async () => {
    const c = await repo.concordance('H0935', BIBLE, 10);
    expect(c.count).toBeGreaterThan(1);
    expect(c.count).toBe((await plain.concordance('H0935', 'blivre', 10)).count);
    expect(c.samples.map((s) => s.vid)).toEqual([VID_1KGS_15_15]);
    expect(c.samples[0]?.text).toBe('Metió en el tesoro de la casa de Jehová');
  });

  it('a busca pula vids sem texto na Bíblia e continua até encher o limite (G1722: Fp 1:1 não tem texto)', async () => {
    // G1722 ocorre em Fp 1:1 (50001001), Fp 2:5 e Fp 2:6; a Bíblia baixada só tem 2:5 e 2:6.
    expect((await repo.concordance('G1722', BIBLE, 1)).samples.map((s) => s.vid)).toEqual([VID_FP_2_5]);
    expect((await repo.concordance('G1722', BIBLE, 5)).samples.map((s) => s.vid)).toEqual([VID_FP_2_5, VID_FP_2_6]);
  });

  it('exclude tira o intervalo dos exemplos, mas não do total', async () => {
    const c = await repo.concordance('G1722', BIBLE, 5, { start: VID_FP_2_5, end: VID_FP_2_5 });
    expect(c.samples.map((s) => s.vid)).toEqual([VID_FP_2_6]);
    expect(c.count).toBe((await repo.concordance('G1722', BIBLE, 5)).count);
  });

  it('resolveCite de txt: da Bíblia baixada lê o banco dela (NT e AT)', async () => {
    const nt = await repo.resolveCite(`txt:${BIBLE}:${VID_FP_2_5}`);
    expect(nt).toEqual({ table: 'verse_text', record: expect.objectContaining({ source_id: BIBLE, text: 'Haya, pues, en vosotros este sentir' }) });
    const at = await repo.resolveCite(`txt:${BIBLE}:${VID_1KGS_15_15}`);
    expect(at).toEqual({ table: 'verse_text', record: expect.objectContaining({ text: 'Metió en el tesoro de la casa de Jehová' }) });
  });

  it('sem textDriver, txt: de Bíblia baixada não resolve (o principal não a tem)', async () => {
    expect(await plain.resolveCite(`txt:${BIBLE}:${VID_FP_2_5}`)).toBeNull();
  });
});

describe('painel com a Bíblia escolhida', () => {
  it('textSource da Bíblia baixada alimenta contexto e a comparação (translationSources)', async () => {
    const range = { start: VID_FP_2_5, end: VID_FP_2_5 };
    const panel = await buildPanel(repo, range, { textSource: BIBLE, translationSources: ['blivre', BIBLE] });
    expect(panel.layers.text.translations.map((t) => t.source_id).sort()).toEqual(['blivre', BIBLE]);
    expect(panel.layers.literary.before.map((v) => v.text)).toEqual(['No mirando cada uno a lo suyo propio']);
    // Exclui o próprio intervalo: G1722 fica com Fp 2:6 (a Bíblia baixada não tem Fp 1:1).
    expect(panel.layers.language.concordance.G1722?.samples.map((s) => [s.source_id, s.vid])).toEqual([[BIBLE, VID_FP_2_6]]);
  });

  it('sem translationSources, as traduções são as do banco principal', async () => {
    const panel = await buildPanel(plain, { start: VID_FP_2_5, end: VID_FP_2_5 });
    expect(panel.layers.text.translations.every((t) => t.source_id === 'blivre' || t.source_id === 'kjv')).toBe(true);
  });
});

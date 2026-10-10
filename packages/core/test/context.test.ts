import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildPanel,
  clipBySentence,
  isContentToken,
  Repo,
  serializePanel,
  shortTitle,
  type Commentary,
  type PanelData,
} from '../src/index';
import { createFixtureDb, driverFor } from './fixtures';

const RANGE = { start: 50002005, end: 50002008 };

let db: DatabaseSync;
let panel: PanelData;

beforeEach(async () => {
  db = createFixtureDb();
  panel = await buildPanel(new Repo(driverFor(db)), RANGE, { contextVerses: 2 });
});

afterEach(() => {
  db.close();
});

/** Ids citados nas linhas do tipo "- [id] ...". */
function idsInText(text: string): Set<string> {
  const ids = new Set<string>();
  for (const m of text.matchAll(/^- \[([^\]]+)\]/gm)) ids.add(m[1] ?? '');
  return ids;
}

/** Painel com apenas os comentários informados (demais camadas vazias). */
function commentaryOnly(commentaries: Commentary[]): PanelData {
  const clone = structuredClone(panel);
  clone.layers.text.translations = [];
  clone.layers.text.original = [];
  clone.layers.text.variants = [];
  clone.layers.literary = { before: [], after: [], divisions: [], bookIntro: [] };
  clone.layers.historical = { entities: [], dictionary: [] };
  clone.layers.language = { lexicon: [], concordance: {} };
  clone.layers.intertext = { xrefs: [], topics: [] };
  clone.layers.interpretation = { commentaries };
  return clone;
}

describe('serializePanel', () => {
  it('inclui tudo com orçamento folgado e agrupa nas seis camadas', () => {
    const ctx = serializePanel(panel, 60_000);
    expect(ctx.omitted).toBe(0);
    expect(ctx.text.length).toBeLessThanOrEqual(60_000);
    for (const title of ['Camada 1', 'Camada 2', 'Camada 3', 'Camada 4', 'Camada 5', 'Camada 6']) {
      expect(ctx.text).toContain(title);
    }
    expect(ctx.text).toContain('# Passagem: Filipenses 2:5-8');
    expect(ctx.text).toContain('[txt:blivre:50002005] Bíblia Livre: Tende em vós');
    expect(ctx.text).toContain('(tradição: reformed)');
  });

  it('citeIds é exatamente o conjunto de ids que aparecem no texto', () => {
    const ctx = serializePanel(panel, 60_000);
    expect(new Set(ctx.citeIds)).toEqual(idsInText(ctx.text));
    expect(ctx.citeIds.has('lex:strongs-gr:G1722')).toBe(true);
    expect(ctx.citeIds.has('tok:gnt:50002008:7')).toBe(true);
  });

  it('respeita o orçamento e mantém ao menos um item de cada camada não vazia', () => {
    const budget = 3000;
    const ctx = serializePanel(panel, budget);
    expect(ctx.text.length).toBeLessThanOrEqual(budget);
    expect(ctx.omitted).toBeGreaterThan(0);
    expect(ctx.text).toContain('[txt:blivre:50002005]');
    for (let layer = 1; layer <= 6; layer++) {
      expect(ctx.text).toContain(`## Camada ${layer}`);
    }
    expect(ctx.text).toContain('omitidos por limite');
  });

  it('divide o orçamento por camada: uma camada grande não zera as outras', () => {
    const clone = structuredClone(panel);
    const big = 'Frase de comentário sobre a passagem. '.repeat(40);
    clone.layers.interpretation.commentaries = Array.from({ length: 30 }, (_, i) => ({
      cite_id: `com:com-ref:${50002005 + i}-${50002005 + i}`,
      source_id: 'com-ref',
      start_vid: 50002005 + i,
      end_vid: 50002005 + i,
      text: big,
    }));
    const ctx = serializePanel(clone, 20_000);
    expect(ctx.text.length).toBeLessThanOrEqual(20_000);
    // Camada 6 tem 25% do orçamento; as demais camadas continuam representadas.
    for (const layer of [1, 2, 3, 4, 5]) expect(ctx.text).toContain(`## Camada ${layer}`);
    expect(ctx.text).toContain('[txt:blivre:50002005]');
    expect(ctx.text).toContain('[lex:strongs-gr:G1722]');
  });

  it('usa o léxico breve para toda palavra e o longo só para palavras de conteúdo', () => {
    const clone = structuredClone(panel);
    const long = 'Verbete longo. '.repeat(200);
    clone.sources['stepbible-tbesg'] = { ...clone.sources.blivre!, id: 'stepbible-tbesg', kind: 'lexicon', title: 'TBESG' };
    clone.sources['stepbible-tflsj'] = { ...clone.sources.blivre!, id: 'stepbible-tflsj', kind: 'lexicon', title: 'TFLSJ' };
    clone.layers.language.lexicon = [
      // G1722 (ἐν, preposição): só breve.
      { cite_id: 'lex:stepbible-tbesg:G1722', source_id: 'stepbible-tbesg', key: 'G1722', strong_base: 'G1722', lemma: 'ἐν', translit: 'en', gloss: 'em', definition: 'Breve sobre ἐν.', lang: 'en' },
      { cite_id: 'lex:stepbible-tflsj:G1722', source_id: 'stepbible-tflsj', key: 'G1722', strong_base: 'G1722', lemma: 'ἐν', translit: 'en', gloss: 'em', definition: long, lang: 'en' },
      // G2424 (Ἰησοῦς, nome): breve + longo.
      { cite_id: 'lex:stepbible-tbesg:G2424', source_id: 'stepbible-tbesg', key: 'G2424', strong_base: 'G2424', lemma: 'Ἰησοῦς', translit: 'Iēsous', gloss: 'Jesus', definition: 'Breve sobre Jesus.', lang: 'en' },
      { cite_id: 'lex:stepbible-tflsj:G2424', source_id: 'stepbible-tflsj', key: 'G2424', strong_base: 'G2424', lemma: 'Ἰησοῦς', translit: 'Iēsous', gloss: 'Jesus', definition: long, lang: 'en' },
    ];
    // Só G2424 é palavra de conteúdo; G1722 aparece como preposição (PREP).
    clone.layers.text.original = [
      { ...clone.layers.text.original[0]!, strong_base: 'G2424', morph: 'N-DSM-P' },
      { ...clone.layers.text.original[0]!, pos: 99, cite_id: 'tok:gnt:50002005:99', strong_base: 'G1722', morph: 'PREP' },
    ];
    const ctx = serializePanel(clone, 60_000);
    expect(ctx.text).toContain('[lex:stepbible-tbesg:G1722]');
    expect(ctx.text).not.toContain('[lex:stepbible-tflsj:G1722]');
    expect(ctx.text).toContain('[lex:stepbible-tflsj:G2424]');
    const longLine = ctx.text.split('\n').find((l) => l.includes('[lex:stepbible-tflsj:G2424]')) ?? '';
    expect(longLine.endsWith('…')).toBe(true);
    expect(longLine.length).toBeLessThan(900);
  });

  it('nunca ultrapassa o orçamento, mesmo com orçamentos pequenos', () => {
    for (const budget of [400, 800, 1500, 5000]) {
      expect(serializePanel(panel, budget).text.length).toBeLessThanOrEqual(budget);
    }
  });

  it('intercala comentários de tradições diferentes quando o espaço é curto', () => {
    const many: Commentary[] = [];
    for (let i = 0; i < 3; i++) {
      const vid = 50002005 + i;
      many.push({
        cite_id: `com:com-ref:${vid}-${vid}`,
        source_id: 'com-ref',
        start_vid: vid,
        end_vid: vid,
        text: `Reformado ${i}. ${'Frase reformada de comentário. '.repeat(60)}`,
      });
      many.push({
        cite_id: `com:com-disp:${vid}-${vid}`,
        source_id: 'com-disp',
        start_vid: vid,
        end_vid: vid,
        text: `Dispensacional ${i}. ${'Frase dispensacional de comentário. '.repeat(60)}`,
      });
    }
    // Espaço para cerca de dois comentários (~1000 caracteres cada) além do cabeçalho.
    const ctx = serializePanel(commentaryOnly(many), 3600);
    expect(ctx.text.length).toBeLessThanOrEqual(3600);
    expect(ctx.text).toContain('com:com-ref:50002005-50002005');
    expect(ctx.text).toContain('com:com-disp:50002005-50002005');
    expect(ctx.text).not.toContain('com:com-ref:50002007-50002007');
  });

  it('trunca comentários longos e mantém a tradição na linha', () => {
    const long: Commentary = {
      cite_id: 'com:com-ref:50002005-50002005',
      source_id: 'com-ref',
      start_vid: 50002005,
      end_vid: 50002005,
      text: 'palavra '.repeat(500),
    };
    const ctx = serializePanel(commentaryOnly([long]), 60_000);
    const line = ctx.text.split('\n').find((l) => l.includes('com:com-ref:50002005-50002005')) ?? '';
    expect(line.endsWith('…')).toBe(true);
    expect(line.length).toBeLessThan(1000);
    expect(line).toContain('(tradição: reformed)');
  });
});

describe('clipBySentence', () => {
  it('mantém o texto inteiro quando cabe e corta no fim de uma sentença quando não cabe', () => {
    expect(clipBySentence('Curto. Demais.', 100)).toBe('Curto. Demais.');
    expect(clipBySentence('Primeira frase. Segunda frase bem mais longa que a primeira.', 25)).toBe('Primeira frase.…');
  });

  it('corta no meio quando a primeira sentença já excede o limite, sempre com "…"', () => {
    const out = clipBySentence('palavra '.repeat(100), 50);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(50);
  });
});

describe('léxico, unidade literária e títulos', () => {
  it('inclui o léxico breve de toda palavra mesmo com orçamento apertado', () => {
    const ctx = serializePanel(panel, 3000);
    expect(ctx.text.length).toBeLessThanOrEqual(3000);
    for (const base of ['lex:strongs-gr:G1722', 'lex:strongs-gr:G5426', 'lex:strongs-gr:G2424']) {
      expect(ctx.citeIds.has(base)).toBe(true);
    }
  });

  it('informa a unidade literária no início da camada 2', () => {
    const ctx = serializePanel(panel, 60_000);
    expect(ctx.text).toContain('Unidade literária (divisão de texto que contém o trecho): Filipenses 2:5-9.');
    expect(ctx.text.indexOf('Unidade literária')).toBeGreaterThan(ctx.text.indexOf('## Camada 2'));
  });

  it('distingue palavras de conteúdo de palavras de função pela classe gramatical', () => {
    const base = panel.layers.text.original[0]!;
    const with_ = (morph: string | null) => ({ ...base, morph });
    expect(isContentToken(with_('N-DSM-P'))).toBe(true);
    expect(isContentToken(with_('V-PAM-2P'))).toBe(true);
    expect(isContentToken(with_('A-NPF'))).toBe(true);
    expect(isContentToken(with_('ADV'))).toBe(true);
    expect(isContentToken(with_('PREP'))).toBe(false);
    expect(isContentToken(with_('CONJ'))).toBe(false);
    expect(isContentToken(with_('T-ASM'))).toBe(false);
    expect(isContentToken(with_('R-NSN'))).toBe(false);
    expect(isContentToken(with_('PRT-N'))).toBe(false);
    expect(isContentToken(with_(null))).toBe(true);
  });

  it('encurta títulos longos para a sigla antes de " - " ou " ("', () => {
    expect(shortTitle('TBESG - Translators Brief Lexicon of Extended Strongs for Greek')).toBe('TBESG');
    expect(shortTitle('Textus Receptus (derived from TAGNT)')).toBe('Textus Receptus (derived from TAGNT)');
    expect(shortTitle('Textus Receptus (derived from the TAGNT text of the Greek NT)')).toBe('Textus Receptus');
    expect(shortTitle('Strong (grego)')).toBe('Strong (grego)');
  });
});

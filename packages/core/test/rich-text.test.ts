import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BOOK_TABLE,
  blocksToPlainText,
  buildCiteIndex,
  buildPanel,
  buildRichTextContext,
  commentatorName,
  formatShortRef,
  parseRichText,
  Repo,
  serializePanel,
  titleCaseHeadword,
  wordKey,
  type Block,
  type Inline,
  type RichTextContext,
} from '../src/index';
import { createFixtureDb, driverFor } from './fixtures';

let db: DatabaseSync;
let ctx: RichTextContext;
let books: Awaited<ReturnType<Repo['books']>>;

beforeEach(async () => {
  db = createFixtureDb();
  const repo = new Repo(driverFor(db));
  const panel = await buildPanel(repo, { start: 50002005, end: 50002008 }, { contextVerses: 2 });
  books = await repo.books();
  const context = serializePanel(panel, 60_000);
  ctx = buildRichTextContext(context, panel, books);
});

afterEach(() => db.close());

/** Todos os textos visíveis de uma lista de blocos (sem citações). */
function visibleText(blocks: readonly Block[]): string {
  const inl = (xs: Inline[]): string => xs.map((x) => (x.type === 'cite' ? '' : x.text)).join('');
  return blocks
    .flatMap((b) => {
      if (b.type === 'list') return b.items.map((i) => inl(i.inlines));
      return [inl(b.inlines)];
    })
    .join('\n');
}

function citesOf(blocks: readonly Block[]): Inline[] {
  const out: Inline[] = [];
  for (const b of blocks) {
    const groups = b.type === 'list' ? b.items.flatMap((i) => i.inlines) : b.inlines;
    out.push(...groups.filter((x) => x.type === 'cite'));
  }
  return out;
}

describe('buildCiteIndex', () => {
  it('rotula versículos com a fonte curta e a referência (sem livro no próprio trecho)', () => {
    expect(ctx.citeIndex.get('txt:blivre:50002005')?.label).toBe('Bíblia Livre 2:5');
    expect(ctx.citeIndex.get('txt:kjv:50002005')?.label).toBe('KJV 2:5');
    expect(ctx.citeIndex.get('txt:blivre:50001002')?.label).toBe('Bíblia Livre 1:2');
  });

  it('rotula palavras originais pela própria forma e xr pelo destino com abreviação do livro', () => {
    expect(ctx.citeIndex.get('tok:gnt:50002005:2')?.label).toBe('φρονεῖτε');
    expect(ctx.citeIndex.get('xr:openbible:50002005:50001002-50001002')?.label).toBe('Fp 1:2');
  });

  it('rotula dicionário com a fonte e o cabeçalho em caixa de título; entidade pelo nome', () => {
    // Fonte do fixture ('easton') sem nome curto próprio: usa o título curto da fonte.
    expect(ctx.citeIndex.get('dic:easton:christ')?.label).toBe('Dicionário de Easton: Christ');
    expect(ctx.citeIndex.get('dic:easton:philippians-epistle-to-the')?.label).toBe('Dicionário de Easton: Philippians, Epistle to the');
    expect(ctx.citeIndex.get('ent:isbe-ent:paulo')?.label).toBe('Paulo');
  });

  it('é determinístico: duas construções produzem o mesmo índice', async () => {
    const repo = new Repo(driverFor(db));
    const panel = await buildPanel(repo, { start: 50002005, end: 50002008 }, { contextVerses: 2 });
    const a = [...buildCiteIndex(panel, books)];
    const b = [...buildCiteIndex(panel, books)];
    expect(a).toEqual(b);
  });
});

describe('rótulos auxiliares', () => {
  it('formatShortRef: mesmo livro sem prefixo, outro livro com prefixo, intervalos', () => {
    expect(formatShortRef(50002005, 50002005, books, false)).toBe('2:5');
    expect(formatShortRef(50002005, 50002008, books, false)).toBe('2:5–8');
    expect(formatShortRef(50002005, 50003001, books, false)).toBe('2:5–3:1');
    expect(formatShortRef(43005018, 43005018, BOOK_TABLE, true)).toBe('Jo 5:18');
  });

  it('titleCaseHeadword: caixa de título com palavras pequenas minúsculas', () => {
    expect(titleCaseHeadword('CHRIST, OFFICES OF')).toBe('Christ, Offices of');
    expect(titleCaseHeadword('PHILIPPI')).toBe('Philippi');
    expect(titleCaseHeadword('EMPTY; EMPTIER')).toBe('Empty; Emptier');
  });

  it('commentatorName: pai da igreja pelo primeiro trecho; comentarista conhecido; autor como fallback', () => {
    const c = (source_id: string, text: string) => ({
      cite_id: 'x',
      source_id,
      start_vid: 1,
      end_vid: 1,
      text,
    });
    expect(commentatorName({ id: 'patristic' } as never, c('patristic', 'John Chrysostom — Homily on Philippians 1\n\nHere...'))).toBe('Crisóstomo');
    expect(commentatorName({ id: 'sword-mhc' } as never, c('sword-mhc', 'Philippians'))).toBe('Matthew Henry');
    expect(commentatorName({ id: 'patristic' } as never, c('patristic', 'Methodius of Olympus\n\nText'))).toBe('Metódio de Olimpo');
    expect(
      commentatorName({ id: 'x', author: 'Anônimo Autor (1800)' } as never, c('x', 'texto')),
    ).toBe('Anônimo Autor');
  });

  it('wordKey normaliza NFC, remove pontuação e minúsculas', () => {
    expect(wordKey('Ἰησοῦ,')).toBe(wordKey('Ἰησοῦ'));
    expect(wordKey('ἀλλ᾽')).toBe(wordKey('ἀλλ’'));
  });
});

describe('parseRichText', () => {
  it('títulos, parágrafos, negrito, itálico, listas, citações e quebra de linha', () => {
    const blocks = parseRichText(
      ['# Título', '', 'Um **forte** e *leve* parágrafo.', 'continua aqui.', '', '- item um', '- item **dois**', '', '1. primeiro', '2. segundo'].join('\n'),
      ctx,
    );
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'list', 'list']);
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1 });
    const para = blocks[1] as Extract<Block, { type: 'paragraph' }>;
    expect(para.inlines.some((i) => i.type === 'text' && i.bold && i.text === 'forte')).toBe(true);
    expect(para.inlines.some((i) => i.type === 'text' && i.italic && i.text === 'leve')).toBe(true);
    expect(visibleText([blocks[1]!])).toBe('Um forte e leve parágrafo. continua aqui.');
    expect((blocks[2] as Extract<Block, { type: 'list' }>).ordered).toBe(false);
    expect((blocks[3] as Extract<Block, { type: 'list' }>).ordered).toBe(true);
  });

  it('citações viram um grupo por sequência; ids válidos e inválidos', () => {
    const blocks = parseRichText('Afirma [[txt:blivre:50002005]] e [[txt:blivre:99999999]] e [[dic:easton:christ, ent:isbe-ent:paulo]].', ctx);
    const groups = citesOf(blocks);
    expect(groups).toHaveLength(3); // cada citação separada por texto ('e') é um grupo próprio
    const refs = groups.flatMap((g) => (g.type === 'cite' ? g.refs : []));
    expect(refs.map((r) => [r.citeId, r.valid])).toEqual([
      ['txt:blivre:50002005', true],
      ['txt:blivre:99999999', false],
      ['dic:easton:christ', true],
      ['ent:isbe-ent:paulo', true],
    ]);
    expect(refs[0]?.label).toBe('Bíblia Livre 2:5');
  });

  it('aceita [id] simples e vários ids na mesma citação', () => {
    const blocks = parseRichText('Um [txt:blivre:50002005] e outro [[dic:easton:christ, ent:isbe-ent:paulo]].', ctx);
    const refs = citesOf(blocks).flatMap((g) => (g.type === 'cite' ? g.refs : []));
    expect(refs.map((r) => r.citeId)).toEqual(['txt:blivre:50002005', 'dic:easton:christ', 'ent:isbe-ent:paulo']);
  });

  it('une versículos consecutivos da mesma fonte em um chip com intervalo', () => {
    const blocks = parseRichText('Veja [[txt:blivre:50002005]][[txt:blivre:50002006]][[txt:blivre:50002007]] e [[txt:kjv:50002005]].', ctx);
    const refs = citesOf(blocks).flatMap((g) => (g.type === 'cite' ? g.refs : []));
    expect(refs[0]).toMatchObject({ label: 'Bíblia Livre 2:5–7', citeId: 'txt:blivre:50002005' });
    expect(refs[0]?.citeIds).toEqual(['txt:blivre:50002005', 'txt:blivre:50002006', 'txt:blivre:50002007']);
    expect(refs[1]?.label).toBe('KJV 2:5');
  });

  it('palavras gregas viram original e ligam ao token quando casam', () => {
    const blocks = parseRichText('O termo ἐν e a forma φρονεῖτε, mais ὑμῖν.', ctx);
    const originals = (blocks[0] as Extract<Block, { type: 'paragraph' }>).inlines.filter(
      (i): i is Extract<Inline, { type: 'original' }> => i.type === 'original',
    );
    expect(originals.map((o) => o.text)).toEqual(['ἐν', 'φρονεῖτε', 'ὑμῖν']);
    expect(originals[0]).toMatchObject({ lang: 'grc', tokenCiteId: 'tok:gnt:50002005:3' });
    expect(originals[1]?.tokenCiteId).toBe('tok:gnt:50002005:2');
    expect(originals[2]?.tokenCiteId).toBeUndefined();
  });

  it('tabelas viram parágrafos por linha; cerca de código vira texto comum', () => {
    const blocks = parseRichText('| a | b |\n|---|---|\n| 1 | 2 |\n\n```\nvalor\n```', ctx);
    expect(blocks.every((b) => b.type === 'paragraph')).toBe(true);
    expect(visibleText(blocks)).toBe('a; b\n1; 2\nvalor');
  });

  it('classifica cada bloco: fonte, inferência, misto e estrutura', () => {
    const blocks = parseRichText(
      [
        'Fato com fonte [[txt:blivre:50002005]].',
        '',
        '(Inferência) A igreja deve imitar Cristo.',
        '',
        'Fato sem fonte.',
        '',
        '**1. Texto**',
      ].join('\n'),
      ctx,
    );
    const kinds = blocks.map((b) => (b.type === 'heading' || b.type === 'list' ? null : b.claim.kind));
    expect(kinds).toEqual(['source', 'inference', 'mixed', 'structure']);
    const mixed = blocks[2] as Extract<Block, { type: 'paragraph' }>;
    expect(mixed.claim.uncited).toEqual(['Fato sem fonte.']);
  });

  it('acusa conflito morfológico no bloco que cita um token com modo errado', () => {
    const blocks = parseRichText('O verbo φρονεῖτε é indicativo [[tok:gnt:50002005:2]].', ctx);
    const para = blocks[0] as Extract<Block, { type: 'paragraph' }>;
    expect(para.claim.morphConflicts).toEqual([{ term: 'indicativo', expected: 'imperativo' }]);
  });

  it('streaming: a última linha sem quebra é texto comum, e marcador incompleto não aparece', () => {
    const blocks = parseRichText('Frase completa [[txt:blivre:50002005]].\nDepois [[txt:blivre:500', ctx);
    const text = visibleText(blocks);
    expect(text).toContain('Depois');
    expect(text).not.toContain('[[');
    expect(citesOf(blocks)).toHaveLength(1); // só a citação completa
  });

  it('nenhuma prefixo do texto completo deixa marcador pela metade visível', () => {
    const full = [
      '## Título com [[txt:blivre:50002005]]',
      'Parágrafo um **forte** [[txt:blivre:50002005]] [[txt:kjv:50002005]].',
      '- item [[dic:easton:christ]]',
      '> citação [[tok:gnt:50002005:2]]',
    ].join('\n');
    for (let i = 0; i <= full.length; i++) {
      const blocks = parseRichText(full.slice(0, i), ctx);
      const visible = blocksToPlainText(blocks);
      expect(visible).not.toMatch(/\[\[|\[(?:txt|tok|lex|com|dic|xr|ent):/);
    }
    expect(citesOf(parseRichText(full, ctx)).length).toBeGreaterThanOrEqual(4);
  });

  it('blocksToPlainText rotula citações e marca inválidas', () => {
    const plain = blocksToPlainText(parseRichText('Texto [[txt:blivre:50002005]] e [[txt:x:1]].', ctx));
    expect(plain).toBe('Texto [Bíblia Livre 2:5] e [inválida: txt:x:1].');
  });
});

import { readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BOOK_TABLE,
  blocksToPlainText,
  buildCiteIndex,
  buildPanel,
  buildRichTextContext,
  claimsOf,
  commentatorOf,
  formatShortRef,
  parseRichText,
  Repo,
  stripInferenceLabels,
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

  it('formatShortRef: AT (Gn 1:1, Dn 2:4, 1Rs 15:15) e capítulo inteiro', () => {
    expect(formatShortRef(1001001, 1001001, BOOK_TABLE, false)).toBe('1:1');
    expect(formatShortRef(27002004, 27002004, BOOK_TABLE, true)).toBe('Dn 2:4');
    expect(formatShortRef(11015015, 11015015, BOOK_TABLE, true)).toBe('1Rs 15:15');
    expect(formatShortRef(1001001, 1001031, BOOK_TABLE, true)).toBe('Gn 1:1–31');
    expect(formatShortRef(1001000, 1001999, BOOK_TABLE, true)).toBe('Gn 1');
    expect(formatShortRef(1001001, 1002999, BOOK_TABLE, true)).toBe('Gn 1:1–2');
    expect(formatShortRef(1001000, 1002999, BOOK_TABLE, false)).toBe('1:0–2');
  });

  it('titleCaseHeadword: caixa de título com palavras pequenas minúsculas', () => {
    expect(titleCaseHeadword('CHRIST, OFFICES OF')).toBe('Christ, Offices of');
    expect(titleCaseHeadword('PHILIPPI')).toBe('Philippi');
    expect(titleCaseHeadword('EMPTY; EMPTIER')).toBe('Empty; Emptier');
  });

  it('commentatorOf: pai da igreja pelo primeiro trecho; comentarista conhecido; autor como fallback', () => {
    const c = (source_id: string, text: string) => ({
      cite_id: 'x',
      source_id,
      start_vid: 1,
      end_vid: 1,
      text,
    });
    expect(commentatorOf({ id: 'patristic' } as never, c('patristic', 'John Chrysostom — Homily on Philippians 1\n\nHere...'))).toBe('Crisóstomo');
    expect(commentatorOf({ id: 'sword-mhc' } as never, c('sword-mhc', 'Philippians'))).toBe('Matthew Henry');
    expect(commentatorOf({ id: 'patristic' } as never, c('patristic', 'Methodius of Olympus\n\nText'))).toBe('Metódio de Olimpo');
    expect(
      commentatorOf({ id: 'x', author: 'Anônimo Autor (1800)' } as never, c('x', 'texto')),
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

/** Contexto que aceita os cite_ids do próprio trecho (os trechos reais citam ids de outras passagens). */
function ctxFor(text: string): RichTextContext {
  const citeIds = new Set(ctx.citeIds);
  for (const m of text.matchAll(/(?:txt|tok|lex|com|dic|xr|ent):[A-Za-z0-9:._-]+/g)) citeIds.add(m[0]);
  return { ...ctx, citeIds };
}

const LABEL_RE = /infer[êe]ncia/i;

describe('blocos: rótulo de inferência e atribuição com trechos reais', () => {
  it('parágrafo de aplicação (Fp 1:27-2:4, resumo): três inferências na mesma moldura, sem o rótulo no texto', () => {
    const text = [
      '(Inferência) A conduta "digna do evangelho" exige coerência entre confissão e vida comunitária, especialmente sob pressão externa.',
      '(Inferência) A unidade não é uniformidade forçada, mas fruto da humildade que considera o outro superior, imitando a mentalidade de Cristo (2:5-11).',
      '(Inferência) O sofrimento por Cristo não é acidente, mas graça concedida que valida a cidadania celestial e fortalece o testemunho coletivo.',
    ].join('\n');
    const blocks = parseRichText(text, ctxFor(text));
    expect(blocks).toHaveLength(1);
    const para = blocks[0] as Extract<Block, { type: 'paragraph' }>;
    expect(para.claim.kind).toBe('inference');
    expect(para.claim.uncited).toEqual([]);
    expect(visibleText(blocks)).not.toMatch(LABEL_RE);
    expect(visibleText(blocks)).toContain('A conduta "digna do evangelho"');
  });

  it.each([
    ['**(Inferência)** Aplique à igreja.', '(Inferência)'],
    ['*(Inferência)* Aplique à igreja.', '*(Inferência)*'],
    ['_Inferência:_ Aplique à igreja.', '_Inferência:_'],
    ['Inferência: Aplique à igreja.', 'Inferência:'],
    ['(inferência) Aplique à igreja.', '(inferência)'],
    ['   (Inferência)    Aplique   à igreja.', 'extra spaces'],
    ['"(Inferência) Aplique à igreja."', 'aspas'],
  ])('parágrafo que começa com %j vira inferência, sem o rótulo (%s)', (text) => {
    const blocks = parseRichText(text, ctxFor(text));
    expect(blocks[0]).toMatchObject({ type: 'paragraph', claim: { kind: 'inference' } });
    expect(visibleText(blocks)).not.toMatch(LABEL_RE);
    expect(visibleText(blocks)).toContain('Aplique à igreja.');
  });

  it('itens de lista e citação com as variantes do rótulo', () => {
    const text = '- **(Inferência)** Aplique à igreja.\n- *(Inferência)* Imite a humildade.\n- _Inferência:_ Sirva.\n\n> (inferência) Ame.';
    const blocks = parseRichText(text, ctxFor(text));
    const list = blocks[0] as Extract<Block, { type: 'list' }>;
    expect(list.items.map((i) => i.claim.kind)).toEqual(['inference', 'inference', 'inference']);
    expect(blocks[1]).toMatchObject({ type: 'quote', claim: { kind: 'inference' } });
    expect(visibleText(blocks)).not.toMatch(LABEL_RE);
  });

  it('rótulo no meio do parágrafo: a frase de inferência é destacada e o rótulo continua visível (sem moldura)', () => {
    const text = 'Fato com fonte [[txt:blivre:50002005]]. (Inferência) A igreja deve imitar Cristo.';
    const blocks = parseRichText(text, ctxFor(text));
    const para = blocks[0] as Extract<Block, { type: 'paragraph' }>;
    expect(para.claim.kind).toBe('source');
    expect(para.claim.inference).toEqual(['(Inferência) A igreja deve imitar Cristo.']);
    expect(visibleText(blocks)).toContain('(Inferência) A igreja deve imitar Cristo.');
  });

  it('rótulo final de item real (Fp 2:5-8 e 1:27-2:4): o item inteiro é inferência', () => {
    const text =
      '- A leitura *τινα* (plural neutro) não concorda com *παράκλησις*; gramaticalmente esperaria um substantivo plural neutro (ex.: “consolações”). (Inferência)';
    const blocks = parseRichText(text, ctxFor(text));
    const list = blocks[0] as Extract<Block, { type: 'list' }>;
    expect(list.items[0]?.claim.kind).toBe('inference');
    expect(list.items[0]?.claim.uncited).toEqual([]);
    expect(visibleText(blocks)).not.toMatch(LABEL_RE);
  });

  it('negrito inicial antes do rótulo (Fp 2:5-8, resposta): a inferência tem moldura e o título fica', () => {
    const text =
      '**Efeito na conexão lógica**  \n(Inferência) A omissão de γὰρ remove um marcador explícito de fundamentação (“pois”, “porque”) que ligaria o imperativo do v. 5 à exortação do v. 4. Sem essa partícula, a relação argumentativa torna-se menos explícita, embora o contexto imediato ainda possa sugerir continuidade.';
    const blocks = parseRichText(text, ctxFor(text));
    expect(blocks[0]).toMatchObject({ type: 'paragraph', claim: { kind: 'inference', uncited: [] } });
    expect(visibleText(blocks)).toContain('Efeito na conexão lógica');
    expect(visibleText(blocks)).not.toMatch(LABEL_RE);
  });

  it('afirmação com citação no fim do item não aparece como sem fonte (Fp 1:27, léxico real)', () => {
    const text =
      '**G4866 συναθλέω (*sunathleō*)** — “lutar junto”, “combater em equipe”. Glosa: “to contend” [[tok:gnt:50001027:270]]. Ocorre em Fp 1:27 e 4:3 [[lex:stepbible-tbesg:G4866]].';
    const blocks = parseRichText(text, ctxFor(text));
    const para = blocks[0] as Extract<Block, { type: 'paragraph' }>;
    expect(para.claim.kind).toBe('source');
    expect(para.claim.uncited).toEqual([]);
  });

  it('frase sem citação antes do último grupo de citações é coberta; a depois dele continua sem fonte', () => {
    const text =
      'Em 1:27 é particípio presente ativo: **συναθλοῦντες** [[tok:gnt:50001027:270]], indicando ação simultânea. *Particípio* = forma verbal que funciona como adjetivo.';
    const blocks = parseRichText(text, ctxFor(text));
    const para = blocks[0] as Extract<Block, { type: 'paragraph' }>;
    expect(para.claim.kind).toBe('mixed');
    expect(para.claim.uncited).toEqual(['*Particípio* = forma verbal que funciona como adjetivo.']);
  });

  it('"Observação" com o contexto (Fp 1:27-2:4, interpretação real) é estrutura, e "Abaixo…" também', () => {
    const text = [
      '**Observação**: O contexto não traz comentários de tradições dispensacionalista ou de aliança (covenant) sobre esta passagem; portanto, não é possível apresentar leituras simétricas dessas correntes aqui.',
      'Abaixo, cada um é resumido com suas ênfases.',
    ].join('\n\n');
    const blocks = parseRichText(text, ctxFor(text));
    const obs = blocks[0] as Extract<Block, { type: 'paragraph' }>;
    expect(obs.claim.uncited).toEqual(['portanto, não é possível apresentar leituras simétricas dessas correntes aqui.']);
    const abaixo = blocks[1] as Extract<Block, { type: 'paragraph' }>;
    expect(abaixo.claim.kind).toBe('structure');
  });

  it('invariante: uncited não vazio exatamente quando kind é mixed', () => {
    const text = [
      'Sem fonte nenhuma.',
      '',
      'Fato [[txt:blivre:50002005]]. Outro sem fonte.',
      '',
      '(Inferência) Aplique. Fato com fonte [[txt:blivre:50002005]].',
      '',
      '- Item sem fonte.\n- Item [[txt:blivre:50002005]].',
    ].join('\n');
    for (const claim of claimsOf(parseRichText(text, ctxFor(text)))) {
      expect(claim.uncited.length > 0).toBe(claim.kind === 'mixed');
    }
  });
});

describe('stripInferenceLabels', () => {
  it('tira o rótulo de cada frase sem colar as frases vizinhas', () => {
    expect(stripInferenceLabels('(Inferência) A conduta. (Inferência) A unidade. Fim.')).toBe('A conduta. A unidade. Fim.');
    expect(stripInferenceLabels('Cristo. (Inferência) A obediência.')).toBe('Cristo. A obediência.');
    expect(stripInferenceLabels('**(Inferência)** Aplique. _Inferência:_ Sirva.')).toBe('Aplique. Sirva.');
  });

  it('não mexe em "inferência" no meio de uma frase comum', () => {
    expect(stripInferenceLabels('Uma inferência: o texto é claro.')).toBe('Uma inferência: o texto é claro.');
  });
});

describe('stripInferenceLabels com rótulo seguido de pontuação', () => {
  it('"texto (Inferência)." vira "texto." sem espaço sobrando', () => {
    expect(stripInferenceLabels('Fato curto (Inferência).')).toBe('Fato curto.');
  });
});

describe('inferência no celular: listas, negrito, citação e rótulo no meio', () => {
  const FIXTURE_PATH = new URL('../../../app/dev/fixtures/inference-phone.json', import.meta.url);
  const phone = (): string => (JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as { text: string }).text;

  it('itens de lista com rótulo dentro do negrito saem sem "**" sobrando e viram inferência', () => {
    const text = phone().split('\n').filter((l) => l.startsWith('- ')).join('\n');
    const blocks = parseRichText(text, ctxFor(text));
    const list = blocks[0] as Extract<Block, { type: 'list' }>;
    expect(list.items).toHaveLength(5);
    // Itens só com inferência viram moldura; o item com cláusula factual citada (";") fica 'source' e destaca a frase.
    expect(list.items.map((i) => i.claim.kind)).toEqual(['inference', 'source', 'inference', 'source', 'inference']);
    for (const item of list.items) expect(item.claim.inference.length).toBeGreaterThan(0);
    // O item com moldura não mostra o rótulo nem asteriscos; os itens parciais mantêm o rótulo (destaque azul na frase).
    const framed = list.items[0]!;
    const shown = visibleText([{ type: 'paragraph', inlines: framed.inlines, claim: framed.claim }]);
    expect(shown).not.toMatch(LABEL_RE);
    expect(shown).not.toContain('**');
    expect(shown).toContain('Ensine unidade sem exigir uniformidade em tudo: neste trecho');
  });

  it('inferência parcial dentro de um item com citação: a frase de inferência fica destacada, o rótulo continua visível', () => {
    const text = '- (Inferência) **Examine a liderança**, perguntando se as decisões são movidas por humildade. O texto contrapõe essas motivações [[txt:blivre:50002003]].';
    const blocks = parseRichText(text, ctxFor(text));
    const item = (blocks[0] as Extract<Block, { type: 'list' }>).items[0]!;
    expect(item.claim.kind).toBe('source');
    expect(item.claim.inference).toEqual(['(Inferência) **Examine a liderança**, perguntando se as decisões são movidas por humildade.']);
    expect(visibleText(blocks)).toContain('(Inferência) Examine a liderança');
  });

  it('frase de inferência com citação no fim, no meio do parágrafo', () => {
    const text = 'Fato com fonte [[txt:blivre:50002005]]. (Inferência) Imite Cristo [[txt:blivre:50002008]].';
    const blocks = parseRichText(text, ctxFor(text));
    const para = blocks[0] as Extract<Block, { type: 'paragraph' }>;
    expect(para.claim.kind).toBe('source');
    expect(para.claim.inference).toEqual(['(Inferência) Imite Cristo.']);
  });

  it('inferência com citação no próprio bloco: a moldura continua inferência', () => {
    const text = '(Inferência) Imite Cristo [[txt:blivre:50002008]].';
    const blocks = parseRichText(text, ctxFor(text));
    expect(blocks[0]).toMatchObject({ type: 'paragraph', claim: { kind: 'inference' } });
    expect(visibleText(blocks).trim()).toBe('Imite Cristo .');
  });
});

describe('citações repetidas', () => {
  const cites = (blocks: Block[]) => {
    const p = blocks[0];
    if (!p || (p.type !== 'paragraph' && p.type !== 'quote')) throw new Error('esperado parágrafo');
    return p.inlines.filter((i): i is Extract<Inline, { type: 'cite' }> => i.type === 'cite');
  };

  it('a mesma fonte repetida logo em seguida vira um chip só', () => {
    const raw = 'Paulo escreveu aos crentes [txt:blivre:50002005] [txt:blivre:50002005].';
    const found = cites(parseRichText(raw, ctx));
    expect(found).toHaveLength(1);
    expect(found[0]!.refs).toHaveLength(1);
  });

  it('a mesma fonte separada por texto continua aparecendo nos dois lugares', () => {
    const raw = 'Primeiro [txt:blivre:50002005] e depois outra frase [txt:blivre:50002005].';
    expect(cites(parseRichText(raw, ctx))).toHaveLength(2);
  });

  it('fontes diferentes lado a lado continuam separadas', () => {
    const raw = 'Afirmação com dupla base [txt:blivre:50002005] [txt:kjv:50002005].';
    const found = cites(parseRichText(raw, ctx));
    expect(found).toHaveLength(1);
    expect(found[0]!.refs.map((r) => r.citeId)).toEqual(['txt:blivre:50002005', 'txt:kjv:50002005']);
  });
});

/** Ids de todas as citações (incluindo as de um grupo de versículos unidos) na ordem do texto. */
function citeIdsOfBlocks(blocks: readonly Block[]): string[] {
  return citesOf(blocks).flatMap((i) => (i.type === 'cite' ? i.refs.flatMap((r) => r.citeIds ?? [r.citeId]) : []));
}

describe('citações com colchete simples e listas em colchetes (saída real de Gemma 4 e Nemotron Ultra)', () => {
  // Trechos literais das saídas do benchmark (tmp/bench-models/texts): a única diferença do formato do app é o colchete.
  const GEMMA_SUMMARY =
    'O Textus Receptus (TR) apresenta em 2:1 o pronome indefinido *τινα* [tok:gnt:50002001:161] no nominativo plural neutro, enquanto BYZ/NA trazem *τις* [tok:gnt:50002001:160] no nominativo singular feminino [[txt:blivre:50002001]]. Em 2:5, o TR/BYZ usa o verbo *φρονείσθω* [tok:gnt:50002005:31] no presente passivo imperativo terceira pessoa singular, diferindo do *φρονεῖτε* [tok:gnt:50002005:30] (presente ativo imperativo segunda pessoa plural) da NA [[txt:blivre:50002005]]. Outras variantes ocorrem em 2:3, 2:4 e 2:7, alterando conjunções e formas verbais [[txt:blivre:50002003]] [[txt:blivre:50002004]] [[txt:blivre:50002007]].';
  const GEMMA_ANSWER =
    'O texto inicia com a alegria de Paulo por ter sido lembrado pelos filipenses [[txt:blivre:50004010]]. Na língua original, o termo para "contentar-me" é *autarkēs* [tok:gnt:50004011:120], que significa ser autossuficiente ou independente [[lex:stepbible-tbesg:G0842]].';
  const ULTRA_LIST =
    '- Os versículos seguintes afirmam que **o mundo foi feito por meio do Verbo, mas não o conheceu** (1:10) [[txt:blivre:43001006], [txt:blivre:43001010]].\n- Termo: [[tok:gnt:43001001:100], [tok:gnt:43001001:110]]';

  it('o resumo do Gemma vira chips para todo colchete simples, sem colchete sobrando no texto', () => {
    const blocks = parseRichText(GEMMA_SUMMARY, ctx);
    expect(citeIdsOfBlocks(blocks)).toEqual([
      'tok:gnt:50002001:161',
      'tok:gnt:50002001:160',
      'txt:blivre:50002001',
      'tok:gnt:50002005:31',
      'tok:gnt:50002005:30',
      'txt:blivre:50002005',
      'txt:blivre:50002003',
      'txt:blivre:50002004',
      'txt:blivre:50002007',
    ]);
    expect(visibleText(blocks)).not.toMatch(/[[\]]/);
  });

  it('a resposta do Gemma com léxico e tabela de palavras: citações e texto corretos', () => {
    const blocks = parseRichText(GEMMA_ANSWER, ctx);
    expect(citeIdsOfBlocks(blocks)).toEqual(['txt:blivre:50004010', 'tok:gnt:50004011:120', 'lex:stepbible-tbesg:G0842']);
    expect(visibleText(blocks)).not.toMatch(/[[\]]/);
  });

  it('listas [[id], [id]] do Nemotron Ultra viram chips, sem colchetes soltos', () => {
    const blocks = parseRichText(ULTRA_LIST, ctx);
    expect(citeIdsOfBlocks(blocks)).toEqual([
      'txt:blivre:43001006',
      'txt:blivre:43001010',
      'tok:gnt:43001001:100',
      'tok:gnt:43001001:110',
    ]);
    expect(visibleText(blocks)).not.toMatch(/[[\]]/);
  });

  it('links Markdown e colchetes comuns continuam como texto', () => {
    const blocks = parseRichText('Veja [Mateus](https://example.org) e [contexto] [1].', ctx);
    expect(citeIdsOfBlocks(blocks)).toEqual([]);
    expect(blocksToPlainText(blocks)).toBe('Veja Mateus e [contexto] [1].');
  });
});

import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  answerMessages,
  attachmentsBlock,
  deepenMessages,
  MAX_LENS_QUESTIONS,
  splitLensQuestions,
  summaryCacheKey,
  SUMMARY_PROMPT_VERSION,
  blocksToPlainText,
  buildPanel,
  buildRichTextContext,
  chatMessages,
  CHAT_CONTEXT_PREFIX,
  extractQuestions,
  parseStructuredAnswer,
  parseStructuredSummary,
  Repo,
  SECTION_KEYS,
  SECTION_LABELS,
  SECTION_LAYER,
  sectionMessages,
  serializePanel,
  splitMarkers,
  summaryMessages,
  buildSystemPrompt,
  type RichTextContext,
  type StructuredSummary,
} from '../src/index';
import { createFixtureDb, driverFor } from './fixtures';

let db: DatabaseSync;
let ctx: RichTextContext;
let contextText: string;

beforeEach(async () => {
  db = createFixtureDb();
  const repo = new Repo(driverFor(db));
  const panel = await buildPanel(repo, { start: 50002005, end: 50002008 }, { contextVerses: 2 });
  const context = serializePanel(panel, 60_000);
  contextText = context.text;
  ctx = buildRichTextContext(context, panel, await repo.books());
});

afterEach(() => db.close());

const SAMPLE = [
  '@visao',
  'A passagem exorta à **humildade** [[txt:blivre:50002005]].',
  '',
  '**@texto**',
  'Traduções: [[txt:blivre:50002005]] e [[txt:kjv:50002005]]. O grego usa ἐν [[tok:gnt:50002005:3]].',
  '',
  '@literario',
  '- Versículos anteriores exortam à unidade [[txt:blivre:50002004]].',
  '- O hino segue.',
  '',
  '## @historico',
  'Termo *humilhação* em [[dic:easton:christ]].',
  '@lingua',
  'Sem lista: [[lex:strongs-gr:G1722]].',
  '@intertexto',
  'Veja [[xr:openbible:50002005:50001002-50001002]].',
  '@interpretacao',
  'Comentário: [[txt:blivre:50002005]].',
  '@aplicacao',
  '(Inferência) Imite a humildade de Cristo.',
  '@perguntas',
  '- Qual o sentido de ἐν aqui?',
  '- Como a kenosis se relaciona com a exaltação?',
  '- Que tradição lê o hino como modelo?',
  '@fim',
].join('\n');

describe('splitMarkers', () => {
  it('reconhece marcadores em todas as formas (com #, **, : e conteúdo na mesma linha)', () => {
    const text = ['Antes', '## @texto', 'a', '**@Literário**', 'b', '@lingua: c', '@fim'].join('\n');
    const s = splitMarkers(text, ['texto', 'literario', 'lingua', 'fim']);
    expect(s.preamble).toEqual(['Antes']);
    expect(s.parts.get('texto')).toEqual(['a']);
    expect(s.parts.get('literario')).toEqual(['b']);
    expect(s.parts.get('lingua')).toEqual(['c']);
    expect(s.complete).toBe(true);
  });

  it('ignora marcadores desconhecidos e não mostra um marcador parcial no fim do stream', () => {
    const s = splitMarkers('@texto\nlinha\n@xyz texto\n@tex', ['texto']);
    expect(s.parts.get('texto')).toEqual(['linha', '@xyz texto']);
    expect(s.complete).toBe(false);
  });
});

describe('parseStructuredSummary', () => {
  it('separa visão geral, seções, perguntas e fim', () => {
    const out = parseStructuredSummary(SAMPLE, ctx);
    expect(out.complete).toBe(true);
    expect(blocksToPlainText(out.overview)).toContain('humildade');
    expect(Object.keys(out.sections).sort()).toEqual(
      ['aplicacao', 'historico', 'interpretacao', 'intertexto', 'lingua', 'literario', 'texto'].sort(),
    );
    expect(out.questions).toEqual([
      'Qual o sentido de ἐν aqui?',
      'Como a kenosis se relaciona com a exaltação?',
      'Que tradição lê o hino como modelo?',
    ]);
  });

  it('cada seção vira blocos com citações resolvidas e classificação', () => {
    const out = parseStructuredSummary(SAMPLE, ctx);
    const texto = out.sections.texto ?? [];
    const cited = texto.flatMap((b) => (b.type === 'list' ? [] : b.inlines)).filter((i) => i.type === 'cite');
    expect(cited.length).toBeGreaterThan(0);
    const aplicacao = out.sections.aplicacao?.[0];
    expect(aplicacao?.type === 'paragraph' && aplicacao.claim.kind).toBe('inference');
    const literario = out.sections.literario ?? [];
    expect(literario[0]?.type).toBe('list');
  });

  it('aceita as formas variadas de marcador e joga texto antes do primeiro para a visão geral', () => {
    const text = 'Preâmbulo solto.\n## @visao\nVisão.\n**@Texto:**\nTexto [[txt:blivre:50002005]].\n@fim';
    const out = parseStructuredSummary(text, ctx);
    // Linhas de um mesmo parágrafo se juntam com espaço (markdown).
    expect(blocksToPlainText(out.overview)).toBe('Preâmbulo solto. Visão.');
    expect(blocksToPlainText(out.sections.texto ?? [])).toBe('Texto [Bíblia Livre 2:5].');
  });

  it('sem @fim: complete é false e seções parciais aparecem', () => {
    const cut = SAMPLE.slice(0, SAMPLE.indexOf('@lingua'));
    const out = parseStructuredSummary(cut, ctx);
    expect(out.complete).toBe(false);
    expect(out.sections.lingua).toBeUndefined();
    expect(out.sections.literario).toBeDefined();
  });

  it('streaming: todo prefixo do texto completo parseia sem erro e nunca mostra marcador pela metade', () => {
    let previousSections = 0;
    for (let i = 0; i <= SAMPLE.length; i++) {
      const prefix = SAMPLE.slice(0, i);
      const out: StructuredSummary = parseStructuredSummary(prefix, ctx);
      const visible = [
        blocksToPlainText(out.overview),
        ...Object.values(out.sections).map((b) => blocksToPlainText(b ?? [])),
        ...out.questions,
      ].join('\n');
      expect(visible).not.toMatch(/\[\[|\[(?:txt|tok|lex|com|dic|xr|ent):|@[a-z]+$/);
      expect(out.complete).toBe(i === SAMPLE.length);
      previousSections = Math.max(previousSections, Object.keys(out.sections).length);
    }
    expect(previousSections).toBe(SECTION_KEYS.length);
  });
});

describe('parseStructuredAnswer', () => {
  it('texto rico antes de @perguntas e perguntas de seguimento depois, com @fim', () => {
    const text = '## Resposta\nO termo **ἐν** indica [[lex:strongs-gr:G1722]].\n@perguntas\n- Pergunta A?\n- Pergunta B?\n@fim';
    const out = parseStructuredAnswer(text, ctx);
    expect(out.complete).toBe(true);
    expect(out.followUps).toEqual(['Pergunta A?', 'Pergunta B?']);
    expect(out.blocks.map((b) => b.type)).toEqual(['heading', 'paragraph']);
  });

  it('streaming: sem @fim ainda não está completa; @perguntas parcial é ocultado', () => {
    const text = 'Resposta [[txt:blivre:50002005]].\n@perg';
    const out = parseStructuredAnswer(text, ctx);
    expect(out.complete).toBe(false);
    expect(out.followUps).toEqual([]);
    expect(blocksToPlainText(out.blocks)).toBe('Resposta [Bíblia Livre 2:5].');
  });

  it('extractQuestions tira marcadores de lista, negrito e citações', () => {
    expect(extractQuestions(['- **Quem** escreveu? [[txt:blivre:50001001]]', '* Por quê?', '2. Quando?'])).toEqual([
      'Quem escreveu?',
      'Por quê?',
      'Quando?',
    ]);
  });
});

describe('prompts e tabelas de seção', () => {
  it('SECTION_LABELS, SECTION_LAYER e SECTION_KEYS cobrem as sete seções', () => {
    expect(Object.keys(SECTION_LABELS).sort()).toEqual([...SECTION_KEYS].sort());
    expect(SECTION_LABELS.interpretacao).toBe('História da interpretação');
    expect(SECTION_LAYER.texto).toBe('text');
    expect(SECTION_LAYER.lingua).toBe('language');
    expect(SECTION_LAYER.aplicacao).toBeNull();
  });

  it('summaryMessages pede as linhas-marcadoras e o @fim, com o contexto', () => {
    const [sys, user] = summaryMessages({ text: contextText });
    expect(sys?.content).toContain('renderiza markdown');
    expect(user?.content).toContain('@visao');
    expect(user?.content).toContain('@perguntas');
    expect(user?.content).toContain('@fim');
    expect(user?.content).toContain(contextText);
  });

  it('sectionMessages nomeia a seção, pede @perguntas e @fim', () => {
    const msgs = sectionMessages({ text: contextText }, 'lingua');
    const user = msgs[msgs.length - 1]!.content;
    expect(user).toContain(SECTION_LABELS.lingua);
    expect(user).toContain('@perguntas');
    expect(user).toContain('@fim');
    expect(() => sectionMessages({ text: '' }, 'nope' as never)).toThrow(RangeError);
  });

  it('answerMessages põe o contexto com o prefixo de chat e formato no fim da pergunta', () => {
    const msgs = answerMessages({ text: contextText }, [{ role: 'user', content: 'oi' }], '  Quem é Paulo?  ');
    expect(msgs[1]?.content.startsWith(CHAT_CONTEXT_PREFIX)).toBe(true);
    const last = msgs[msgs.length - 1]!;
    expect(last.content.startsWith('Quem é Paulo?')).toBe(true);
    expect(last.content).toContain('@perguntas');
    expect(last.content).toContain('@fim');
  });

  it('chatMessages é alias de answerMessages', () => {
    const history = [{ role: 'assistant' as const, content: 'x' }];
    expect(chatMessages({ text: contextText }, history, 'Pergunta')).toEqual(
      answerMessages({ text: contextText }, history, 'Pergunta'),
    );
  });

  it('o prompt de sistema diz que markdown é renderizado e proíbe tabelas', () => {
    const sys = buildSystemPrompt();
    expect(sys).toContain('renderiza markdown');
    expect(sys).toContain('Não use tabelas');
    expect(sys).toContain('[[cite_id]]');
  });
});

describe('perguntas por lente, anexos, foco e aprofundamento', () => {
  it('linhas "? " viram perguntas da lente (até 2), fora do corpo da seção', () => {
    const text = [
      '@visao',
      'Visão.',
      '? Pergunta da visão?',
      '@texto',
      'Texto [[txt:blivre:50002005]].',
      '? Primeira lente?',
      '? Segunda lente?',
      '? Terceira ignorada?',
      '@fim',
    ].join('\n');
    const out = parseStructuredSummary(text, ctx);
    expect(out.sectionQuestions?.visao).toEqual(['Pergunta da visão?']);
    expect(out.sectionQuestions?.texto).toEqual(['Primeira lente?', 'Segunda lente?']);
    expect(blocksToPlainText(out.sections.texto ?? [])).toBe('Texto [Bíblia Livre 2:5].');
    expect(blocksToPlainText(out.overview)).toBe('Visão.');
  });

  it('"?" sozinho (início de stream) some; "?abc" continua sendo texto', () => {
    expect(splitLensQuestions(['?', 'corpo', '?sem espaço', '? ok?'])).toEqual({
      body: ['corpo', '?sem espaço'],
      questions: ['ok?'],
    });
    expect(MAX_LENS_QUESTIONS).toBe(2);
  });

  it('o formato do resumo pede perguntas por lente', () => {
    const user = summaryMessages({ text: contextText })[1]!.content;
    expect(user).toContain('começando com "? "');
    expect(user.match(/\? \(1 a 2 perguntas/g)?.length).toBeGreaterThanOrEqual(7);
  });

  it('summaryMessages com focus menciona a seleção e pede o resumo da unidade', () => {
    const user = summaryMessages({ text: contextText }, { focus: { start: 50002005, end: 50002008 } })[1]!.content;
    expect(user).toContain('Seleção do leitor dentro desta unidade: Filipenses 2:5-8');
    expect(user).toContain('Resuma a unidade inteira');
    expect(summaryMessages({ text: contextText })[1]!.content).not.toContain('Seleção do leitor');
  });

  it('summaryCacheKey depende só da unidade e da versão do formato', () => {
    const unit = { start: 50002001, end: 50002030 };
    expect(summaryCacheKey(unit)).toBe(`summary:${SUMMARY_PROMPT_VERSION}:50002001-50002030`);
    expect(summaryCacheKey({ ...unit })).toBe(summaryCacheKey(unit));
    expect(summaryCacheKey({ start: 50002001, end: 50002029 })).not.toBe(summaryCacheKey(unit));
  });

  it('anexos entram na mensagem do usuário com rótulo, cite_ids e texto citado', () => {
    const msgs = answerMessages({ text: contextText }, [], 'Explique', {
      attachments: [
        { label: 'Versículo 2:5', citeIds: ['txt:blivre:50002005'], text: 'Tende em vós o mesmo sentimento' },
        { label: 'Nota', text: 'uma nota' },
      ],
    });
    const user = msgs[msgs.length - 1]!.content;
    expect(user).toContain('Anexos (foque a resposta neles');
    expect(user).toContain('- Versículo 2:5 (cite_ids: txt:blivre:50002005)');
    expect(user).toContain('"Tende em vós o mesmo sentimento"');
    expect(user).toContain('- Nota');
    expect(attachmentsBlock([])).toBe('');
    expect(answerMessages({ text: contextText }, [], 'Explique').at(-1)!.content).not.toContain('Anexos');
  });

  it('deepenMessages aceita visão geral e o ponto a detalhar; lente inválida lança erro', () => {
    const msgs = deepenMessages({ text: contextText }, 'visao', { claim: 'a kenosis' });
    const user = msgs[msgs.length - 1]!.content;
    expect(user).toContain('Aprofunde a lente "Visão geral"');
    expect(user).toContain('Detalhar este ponto: "a kenosis"');
    expect(user).toContain('@perguntas');
    expect(user).toContain('@fim');
    expect(deepenMessages({ text: contextText }, 'lingua')[1]!.content).toContain(SECTION_LABELS.lingua);
    expect(() => deepenMessages({ text: '' }, 'nope' as never)).toThrow(RangeError);
  });
});

describe('prompt: citação logo após cada frase e rótulo de inferência exato', () => {
  it('manda citar logo após cada frase factual e não deixar frase sem citação por causa da posição', () => {
    const sys = buildSystemPrompt();
    expect(sys).toContain('Logo após cada frase factual');
    expect(sys).toContain('Frase factual. [[cite_id]]');
    expect(sys).toContain('Cada frase factual tem a sua citação');
  });

  it('manda começar inferências com exatamente "(Inferência)" e só a frase de inferência num parágrafo misto', () => {
    const sys = buildSystemPrompt();
    expect(sys).toContain('começam com exatamente "(Inferência)"');
    expect(sys).toContain('comece com "(Inferência)" só a frase de inferência');
    const user = summaryMessages({ text: contextText })[1]!.content;
    expect(user).toContain('Logo após cada frase factual, a citação [[cite_id]]');
    expect(user).toContain('Frases de inferência começam com "(Inferência)"');
  });

  it('a versão do resumo mudou com o prompt (invalida o cache de resumos antigos)', () => {
    expect(SUMMARY_PROMPT_VERSION).toBe('resumo-v3');
  });
});

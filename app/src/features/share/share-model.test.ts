// Texto de copiar e compartilhar: referência com travessão, números sobrescritos, troca de capítulo, NT e AT, e a
// síntese da IA em texto simples (citações numeradas, inferência marcada, fontes e rodapé).
import { describe, expect, it } from 'vitest';
import { makeVid, type Block, type ClaimInfo, type CiteRef } from '@sensus/core';
import { describeCiteEntry, shareRef, superscript, synthShareText, verseShareText, type SynthLabels } from './share-model';

const fp = (c: number, v: number) => makeVid(50, c, v);
const rs = (c: number, v: number) => makeVid(11, c, v);

const FP_2_5_8 = [
  { vid: fp(2, 5), text: 'Isto seja, para que esteja em vós este modo de pensar, que também esteve em Cristo Jesus:' },
  { vid: fp(2, 6), text: 'mesmo ele sendo em forma de Deus, não considerou a igualdade a Deus como algo para se apegar;' },
  { vid: fp(2, 7), text: 'Pelo contrário, ele esvaziou a si mesmo, tomando a forma de servo, e se tornou semelhante aos homens;' },
  { vid: fp(2, 8), text: 'e, quando se encontrava em forma humana, ele humilhou a si mesmo, sendo obediente até a morte, e morte de cruz.' },
];

describe('shareRef', () => {
  it('NT: um versículo, intervalo, troca de capítulo e de livro', () => {
    expect(shareRef(fp(2, 5), fp(2, 5))).toBe('Fp 2:5');
    expect(shareRef(fp(2, 5), fp(2, 8))).toBe('Fp 2:5–8');
    expect(shareRef(fp(1, 27), fp(2, 4))).toBe('Fp 1:27–2:4');
    expect(shareRef(fp(4, 23), makeVid(51, 1, 1))).toBe('Fp 4:23 – Cl 1:1');
  });

  it('AT: 1Rs 15:15', () => {
    expect(shareRef(rs(15, 15), rs(15, 15))).toBe('1Rs 15:15');
  });

  it('usa a abreviação do idioma do app', () => {
    expect(shareRef(fp(2, 5), fp(2, 8), 'en')).toBe('Phil 2:5–8');
  });
});

describe('verseShareText', () => {
  it('sem números: texto corrido e a referência com a sigla na linha de baixo', () => {
    const out = verseShareText({ verses: FP_2_5_8, start: fp(2, 5), end: fp(2, 8), bible: 'BLivre', numbers: false });
    const [text, ref] = out.split('\n');
    expect(ref).toBe('Fp 2:5–8 (BLivre)');
    expect(text!.startsWith('Isto seja')).toBe(true);
    expect(text).toContain('Jesus: mesmo ele');
    expect(out).not.toMatch(/[⁰-⁹]/);
  });

  it('com números: sobrescritos antes de cada versículo', () => {
    const out = verseShareText({ verses: FP_2_5_8, start: fp(2, 5), end: fp(2, 8), bible: 'BLivre', numbers: true });
    expect(out.startsWith('⁵ Isto seja')).toBe(true);
    expect(out).toContain(' ⁶ mesmo ele');
    expect(out).toContain(' ⁸ e, quando');
  });

  it('troca de capítulo: o primeiro versículo do capítulo novo leva capítulo:versículo', () => {
    const verses = [
      { vid: fp(1, 30), text: 'tendo o mesmo combate.' },
      { vid: fp(2, 1), text: 'Portanto, se há alguma consolação em Cristo,' },
      { vid: fp(2, 2), text: 'completai a minha alegria' },
    ];
    const out = verseShareText({ verses, start: fp(1, 30), end: fp(2, 2), bible: 'BLivre', numbers: true });
    expect(out).toBe('³⁰ tendo o mesmo combate. 2:1 Portanto, se há alguma consolação em Cristo, ² completai a minha alegria\nFp 1:30–2:2 (BLivre)');
  });

  it('AT (1Rs 15:15): espaços e quebras da edição viram um espaço', () => {
    const verses = [{ vid: rs(15, 15), text: 'And he brought in the things\n\nwhich his father had dedicated' }];
    const out = verseShareText({ verses, start: rs(15, 15), end: rs(15, 15), bible: 'KJV', numbers: true });
    expect(out).toBe('¹⁵ And he brought in the things which his father had dedicated\n1Rs 15:15 (KJV)');
  });

  it('superscript', () => {
    expect(superscript(5)).toBe('⁵');
    expect(superscript(120)).toBe('¹²⁰');
  });
});

describe('synthShareText', () => {
  const LABELS: SynthLabels = { sources: 'Fontes', inference: '(Inferência)', aiFooter: 'Resumo gerado por IA a partir das fontes acima.', via: 'via Sensus' };
  const claim = (kind: ClaimInfo['kind']): ClaimInfo => ({ kind, uncited: [], inference: [], morphConflicts: [] });
  const ref = (citeId: string, label: string, valid = true): CiteRef => ({ citeId, label, valid });
  const henry = ref('com:sword-mhc:50002001-50002011', 'Henry');

  const overview: Block[] = [
    {
      type: 'paragraph',
      claim: claim('source'),
      inlines: [
        { type: 'text', text: 'Paulo apresenta a atitude de Cristo como modelo ' },
        { type: 'cite', refs: [ref('txt:blivre:50002005', 'Bíblia Livre 2:5')] },
        { type: 'text', text: '. O verbo traduz ' },
        { type: 'original', text: 'κενόω', lang: 'grc' },
        { type: 'text', text: ' ' },
        { type: 'cite', refs: [ref('lex:stepbible-tbesg:G2758', 'TBESG κενόω'), henry, ref('com:inventado', '?', false)] },
        { type: 'text', text: '.' },
      ],
    },
    { type: 'paragraph', claim: claim('inference'), inlines: [{ type: 'text', text: 'O hino sustenta o pedido de humildade.' }] },
  ];
  const lingua: Block[] = [
    { type: 'paragraph', claim: claim('source'), inlines: [{ type: 'text', text: 'Henry de novo' }, { type: 'cite', refs: [henry] }] },
  ];
  // AT: o mesmo formato vale para um resumo do AT hebraico.
  const at: Block[] = [
    { type: 'paragraph', claim: claim('source'), inlines: [{ type: 'text', text: 'Asa consagra os utensílios ' }, { type: 'cite', refs: [ref('txt:blivre:11015015', 'Bíblia Livre 15:15')] }] },
  ];

  it('numera as fontes na ordem, repete o número da mesma fonte e ignora citação inválida', () => {
    const out = synthShareText({ title: 'Fp 2:5–11 · Visão geral', parts: [{ blocks: overview }, { heading: 'Língua', blocks: lingua }, { heading: 'Vazio', blocks: [] }], labels: LABELS });
    expect(out).toBe(
      [
        'Fp 2:5–11 · Visão geral',
        'Paulo apresenta a atitude de Cristo como modelo [1]. O verbo traduz κενόω [2][3].\n\n(Inferência) O hino sustenta o pedido de humildade.',
        'Língua\nHenry de novo [3]',
        'Fontes\n[1] Bíblia Livre 2:5\n[2] TBESG κενόω\n[3] Henry',
        'Resumo gerado por IA a partir das fontes acima.\nvia Sensus',
      ].join('\n\n'),
    );
  });

  it('usa a descrição da fonte quando há', () => {
    const out = synthShareText({ title: 'T', parts: [{ blocks: lingua }], labels: LABELS, describe: (r) => `${r.label} · Complete Commentary` });
    expect(out).toContain('[1] Henry · Complete Commentary');
  });

  it('AT e sem citações: sem a seção Fontes', () => {
    expect(synthShareText({ title: '1Rs 15:15', parts: [{ blocks: at }], labels: LABELS })).toContain('[1] Bíblia Livre 15:15');
    const plain: Block[] = [{ type: 'paragraph', claim: claim('structure'), inlines: [{ type: 'text', text: 'Só texto.' }] }];
    const out = synthShareText({ title: 'T', parts: [{ blocks: plain }], labels: LABELS });
    expect(out).toBe('T\n\nSó texto.\n\nResumo gerado por IA a partir das fontes acima.\nvia Sensus');
  });

  it('listas numeradas e com marcador', () => {
    const list: Block[] = [
      { type: 'list', ordered: true, items: [{ inlines: [{ type: 'text', text: 'um' }], claim: claim('source') }, { inlines: [{ type: 'text', text: 'dois' }], claim: claim('inference') }] },
    ];
    expect(synthShareText({ title: 'T', parts: [{ blocks: list }], labels: LABELS })).toContain('1. um\n2. (Inferência) dois');
  });
});

describe('describeCiteEntry', () => {
  it('acrescenta a obra quando o rótulo não a diz', () => {
    const com = { label: 'Henry', table: 'commentary' as const, sourceTitle: "Matthew Henry's Complete Commentary", tradition: null };
    expect(describeCiteEntry(com, 'Henry')).toBe("Henry · Matthew Henry's Complete Commentary");
    const verse = { label: 'Bíblia Livre 2:5', table: 'verse_text' as const, sourceTitle: 'Bíblia Livre', tradition: null };
    expect(describeCiteEntry(verse, 'Bíblia Livre 2:5')).toBe('Bíblia Livre 2:5');
    expect(describeCiteEntry(undefined, 'TBESG κενόω')).toBe('TBESG κενόω');
  });
});

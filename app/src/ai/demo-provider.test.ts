// O demo reconhece o pedido de aprofundamento pela chave da seção (não pelo rótulo, que é texto de prompt).
import { describe, expect, it } from 'vitest';
import {
  curiosityMessages,
  curiosityReviewMessages,
  deepenMessages,
  SECTION_KEYS,
  SECTION_LABELS,
  type ChatMessage,
  type CuriosityCandidate,
} from '@sensus/core';
import type { Fixture } from '../../dev/fixtures/types';
import { classifyRequest, DEMO_NO_CURIOSITY, DEMO_REJECT_REVIEW, DemoProvider, pickFixture } from './demo-provider';

const CONTEXT = { text: '<contexto>\n[1] Filipenses 2:5-8\n</contexto>' };

describe('classifyRequest', () => {
  it('cada seção do resumo é reconhecida pela chave', () => {
    for (const key of SECTION_KEYS) {
      const req = classifyRequest(deepenMessages(CONTEXT, key));
      expect(req.kind).toBe('section');
      expect(req.kind === 'section' && req.section).toBe(key);
    }
  });

  it('o rótulo mudando não quebra o casamento (a chave manda)', () => {
    const msgs = deepenMessages(CONTEXT, 'lingua');
    const renamed = msgs.map((m) => ({ ...m, content: m.content.replace(`"${SECTION_LABELS.lingua}"`, '"Outro nome"') }));
    expect(classifyRequest(renamed)).toMatchObject({ kind: 'section', section: 'lingua' });
  });

  it('visão geral não é uma seção do resumo', () => {
    expect(classifyRequest(deepenMessages(CONTEXT, 'visao'))).toMatchObject({ kind: 'section', section: null });
  });
});

// ---- curiosidade do trecho ---------------------------------------------------------------------

const UNIT_CTX_TEXT = '# Passagem: Filipenses 1:21-2:11\n<contexto>\n[1] Filipenses 1:27\n</contexto>';
const OTHER_CTX_TEXT = '# Passagem: João 8:52-59\n<contexto>\n[1] João 8:58\n</contexto>';
const CANDIDATE: CuriosityCandidate = {
  kind: 'termo',
  hook: 'politeuomai evoca a cidadania romana',
  listener: 'Os filipenses sabiam o que era a cidadania [[lex:x]]',
  today: 'Hoje se lê como conduta genérica',
  change: 'A exortação ganha peso cívico [[tok:y]]',
  evidence: ['lex:x', 'tok:y'],
  confidence: 'alta',
  raw: '',
};
const CURIOSITY_TEXT = '@curiosidade termo\ngancho: politeuomai evoca a cidadania romana\n@fim';
const REVIEW_TEXT = 'interesse: 5\nfundamento: 5\ndisputa: nao\nalcance: sim\ntipo: sim\npeso: sim\nmotivo: x\n@fim';

const fixture = (kind: Fixture['kind'], reference: string, start: number, end: number, text: string): Fixture => ({
  version: 1,
  kind,
  reference,
  range: { start, end },
  model: 'demo-test',
  recordedAt: '2026-11-21T00:00:00.000Z',
  text,
});
const UNIT_FIX = fixture('curiosity', 'Filipenses 1:21-2:11', 50001021, 50002011, CURIOSITY_TEXT);
const UNIT_REV = fixture('curiosity-review', 'Filipenses 1:21-2:11', 50001021, 50002011, REVIEW_TEXT);

async function collect(p: DemoProvider, messages: ChatMessage[]): Promise<string> {
  let out = '';
  for await (const piece of p.stream({ messages, temperature: 0.2, maxTokens: 900 })) out += piece;
  return out;
}
const FAST = { chunkChars: 100_000, chunkDelayMs: 0, startDelayMs: 0 };

describe('curiosidade do trecho no demo', () => {
  it('reconhece o gerador e o revisor pelas instruções do núcleo', () => {
    expect(classifyRequest(curiosityMessages({ text: UNIT_CTX_TEXT }))).toEqual({ kind: 'curiosity', reference: 'Filipenses 1:21-2:11' });
    expect(classifyRequest(curiosityReviewMessages({ text: UNIT_CTX_TEXT }, CANDIDATE))).toEqual({
      kind: 'curiosity-review',
      reference: 'Filipenses 1:21-2:11',
    });
  });

  it('a mesma unidade recebe a fixture gravada; outra unidade recebe "nenhuma curiosidade"', async () => {
    const p = new DemoProvider(FAST, [UNIT_FIX, UNIT_REV]);
    expect(await collect(p, curiosityMessages({ text: UNIT_CTX_TEXT }))).toBe(CURIOSITY_TEXT);
    expect(await collect(p, curiosityMessages({ text: OTHER_CTX_TEXT }))).toBe(DEMO_NO_CURIOSITY);
  });

  it('nunca devolve a curiosidade de outro trecho (nem com fixture de outro livro)', async () => {
    const joao = fixture('curiosity', 'João 8:52-59', 43008052, 43008059, '@curiosidade eco\n@fim');
    const p = new DemoProvider(FAST, [joao]);
    expect(await collect(p, curiosityMessages({ text: UNIT_CTX_TEXT }))).toBe(DEMO_NO_CURIOSITY);
  });

  it('o revisor usa a fixture da mesma unidade; sem ela, reprova', async () => {
    const withRev = new DemoProvider(FAST, [UNIT_FIX, UNIT_REV]);
    expect(await collect(withRev, curiosityReviewMessages({ text: UNIT_CTX_TEXT }, CANDIDATE))).toBe(REVIEW_TEXT);
    const without = new DemoProvider(FAST, [UNIT_FIX]);
    expect(await collect(without, curiosityReviewMessages({ text: UNIT_CTX_TEXT }, CANDIDATE))).toBe(DEMO_REJECT_REVIEW);
  });

  it('pedidos de resumo continuam escolhendo a fixture do resumo, não a de curiosidade', () => {
    const summary = fixture('summary', 'Filipenses 1:21-2:11', 50001021, 50002011, 'resumo');
    expect(pickFixture(classifyRequest([{ role: 'user', content: UNIT_CTX_TEXT }]), [UNIT_FIX, summary])).toBe(summary);
  });
});

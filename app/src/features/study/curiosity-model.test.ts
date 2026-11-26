// Regras puras da curiosidade na folha: o gerador (NT grego e AT hebraico) e o texto mostrado.
import { describe, expect, it } from 'vitest';
import type { RichTextContext } from '@sensus/core';
import { judgeGenerator, plainText, shortHook } from './curiosity-model';

/** Contexto mínimo: só as entradas que o portão consulta (tabela de cada cite_id). */
function ctxWith(tables: Record<string, string>): RichTextContext {
  const citeIndex = new Map(Object.entries(tables).map(([id, table]) => [id, { table, label: id, short: id }]));
  return { citeIds: new Set(Object.keys(tables)), citeIndex } as unknown as RichTextContext;
}

const ECO_CTX = ctxWith({ 'xr:exo-3-14': 'xref', 'txt:bl:43008058': 'verse_text' });
const TERMO_NT = ctxWith({ 'tok:jo-8-58-gr': 'token', 'lex:g1510': 'lexicon_entry', 'txt:bl:43008058': 'verse_text' });
const TERMO_AT = ctxWith({ 'tok:is-7-14-he': 'token', 'lex:h5959': 'lexicon_entry', 'txt:bl:23007014': 'verse_text' });

function raw(parts: { kind: 'eco' | 'termo'; ids: string[]; confidence?: string; hook?: string }): string {
  const [a, b] = parts.ids as [string, string];
  return [
    `@curiosidade ${parts.kind}`,
    `gancho: ${parts.hook ?? 'Eu sou ecoa o nome de Deus em Êx 3:14'}`,
    `ouvinte: Os ouvintes conheciam Êx 3:14 [[${a}]]`,
    'hoje: Hoje o trecho costuma ser lido só como uma afirmação de identidade',
    `muda: Muda a leitura da discussão [[${b}]]`,
    `evidencias: [[${a}]] [[${b}]]`,
    `confianca: ${parts.confidence ?? 'alta'}`,
    '@fim',
  ].join('\n');
}

describe('judgeGenerator', () => {
  it('@nenhuma some sem candidata', () => {
    const step = judgeGenerator('@nenhuma\n@fim', ECO_CTX);
    expect(step).toEqual({ kind: 'hide', reason: '@nenhuma: nenhuma curiosidade no trecho' });
  });

  it('resposta malformada some', () => {
    expect(judgeGenerator('@curiosidade eco\ngancho: x\n@fim', ECO_CTX)).toMatchObject({ kind: 'hide' });
  });

  it('eco com referência cruzada e duas citações passa como candidata', () => {
    const step = judgeGenerator(raw({ kind: 'eco', ids: ['xr:exo-3-14', 'txt:bl:43008058'] }), ECO_CTX);
    expect(step.kind).toBe('candidate');
    if (step.kind === 'candidate') expect(step.candidate.evidence).toEqual(['xr:exo-3-14', 'txt:bl:43008058']);
  });

  it('confiança média é reprovada no portão', () => {
    const step = judgeGenerator(raw({ kind: 'eco', ids: ['xr:exo-3-14', 'txt:bl:43008058'], confidence: 'media' }), ECO_CTX);
    expect(step).toMatchObject({ kind: 'hide' });
  });

  it('termo do NT grego passa com palavra e sentido vindos do léxico', () => {
    const step = judgeGenerator(raw({ kind: 'termo', ids: ['tok:jo-8-58-gr', 'lex:g1510'] }), TERMO_NT);
    expect(step.kind).toBe('candidate');
  });

  it('termo do AT hebraico também passa, com a mesma regra', () => {
    const step = judgeGenerator(raw({ kind: 'termo', ids: ['tok:is-7-14-he', 'lex:h5959'] }), TERMO_AT);
    expect(step.kind).toBe('candidate');
  });

  it('termo sem a palavra citada é reprovado (no hebraico também)', () => {
    const step = judgeGenerator(raw({ kind: 'termo', ids: ['lex:h5959', 'txt:bl:23007014'] }), TERMO_AT);
    expect(step).toMatchObject({ kind: 'hide' });
  });

  it('gancho com exagero é reprovado', () => {
    const step = judgeGenerator(raw({ kind: 'eco', ids: ['xr:exo-3-14', 'txt:bl:43008058'], hook: 'Um segredo incrível!' }), ECO_CTX);
    expect(step).toMatchObject({ kind: 'hide' });
  });
});

describe('texto mostrado', () => {
  it('plainText tira os marcadores de citação', () => {
    expect(plainText('Os ouvintes conheciam [[xr:a]] e [[txt:b c]].')).toBe('Os ouvintes conheciam e.');
  });

  it('shortHook corta em 34 caracteres com reticências', () => {
    expect(shortHook('Curto')).toBe('Curto');
    expect(shortHook('a'.repeat(40))).toBe(`${'a'.repeat(34)}…`);
  });
});

import { describe, expect, it } from 'vitest';
import {
  acceptCuriosity,
  curiosityCacheKey,
  curiosityMessages,
  curiosityReviewMessages,
  CURIOSITY_MAX_TOKENS,
  CURIOSITY_REVIEW_MAX_TOKENS,
  parseCuriosity,
  parseCuriosityReview,
  type CuriosityCandidate,
  type RichTextContext,
} from '../src/index';
import type { CiteIndexEntry } from '../src/index';

/** Contexto montado à mão: cada id tem a tabela de origem (é o que o portão lê). */
function ctxOf(entries: Record<string, CiteIndexEntry['table']>): RichTextContext {
  const citeIndex = new Map<string, CiteIndexEntry>();
  for (const [id, table] of Object.entries(entries)) {
    citeIndex.set(id, { label: id, table, sourceTitle: id, tradition: null });
  }
  return { citeIds: new Set(citeIndex.keys()), citeIndex };
}

// NT grego: Fp 2:10 ecoa Is 45:23 (LXX).
const XR_IS = 'xr:openbible:50050210:23045023';
const COM_CALVINO = 'com:calvino:50050210';
const TXT_FP = 'txt:blivre:50050210';
const NT_CTX = ctxOf({ [XR_IS]: 'xref', [COM_CALVINO]: 'commentary', [TXT_FP]: 'verse_text' });

// AT hebraico: Gn 2:18, "ezer".
const TOK_EZER = 'tok:hot:01024018:2';
const TOK_OUTRO = 'tok:hot:01024018:3';
const LEX_EZER = 'lex:strongs-hb:H5828';
const COM_EZER = 'com:keil:01002018';
const AT_CTX = ctxOf({
  [TOK_EZER]: 'token',
  [TOK_OUTRO]: 'token',
  [LEX_EZER]: 'lexicon_entry',
  [COM_EZER]: 'commentary',
});

function candidate(over: Partial<CuriosityCandidate> = {}): CuriosityCandidate {
  return {
    kind: 'eco',
    hook: 'Fp 2:10 ecoa Is 45:23, onde só Deus jura que todo joelho se dobrará',
    listener: 'Os ouvintes conheciam Isaías 45:23 como juramento do Deus de Israel [[xr:openbible:50050210:23045023]]',
    today: 'Hoje o trecho costuma ser lido só como hino cristológico',
    change: 'O hino atribui a Jesus o lugar que Isaías reservava a Deus [[com:calvino:50050210]]',
    evidence: [XR_IS, COM_CALVINO],
    confidence: 'alta',
    raw: '@curiosidade eco',
    ...over,
  };
}

const CANDIDATE_TEXT = [
  '```',
  '@CURIOSIDADE eco',
  'gancho: Fp 2:10 ecoa Is 45:23, onde só Deus jura que todo joelho se dobrará [[xr:openbible:50050210:23045023]]',
  'ouvinte: Os ouvintes conheciam Isaías 45:23 como juramento do Deus de Israel [[xr:openbible:50050210:23045023]]',
  'hoje: Hoje o trecho costuma ser lido só como hino cristológico',
  'muda: O hino atribui a Jesus o lugar que Isaías reservava a Deus [[com:calvino:50050210]]',
  'evidencias: [[xr:openbible:50050210:23045023]] [[com:calvino:50050210]]',
  'confianca: alta',
  '@FIM',
  '```',
].join('\n');

describe('parseCuriosity', () => {
  it('lê um eco completo, com cercas de código, maiúsculas e cite_ids sem repetição', () => {
    const c = parseCuriosity(CANDIDATE_TEXT);
    expect(c).not.toBe('none');
    expect(c).not.toBeNull();
    const cand = c as CuriosityCandidate;
    expect(cand.kind).toBe('eco');
    expect(cand.confidence).toBe('alta');
    expect(cand.hook.startsWith('Fp 2:10 ecoa Is 45:23')).toBe(true);
    expect(cand.hook).toContain('[[xr:openbible:50050210:23045023]]');
    expect(cand.evidence.sort()).toEqual([COM_CALVINO, XR_IS].sort());
    expect(cand.raw.startsWith('@CURIOSIDADE eco')).toBe(true);
    expect(cand.raw.endsWith('@FIM')).toBe(true);
    expect(cand.raw).not.toContain('```');
  });

  it('lê um termo completo (AT hebraico)', () => {
    const text = [
      '@curiosidade termo',
      'gancho: "Auxílio" (ezer) não carrega ideia de inferioridade',
      'ouvinte: A palavra hebraica traz a ideia de socorro que vem de fora [[lex:strongs-hb:H5828]]',
      'hoje: Costuma-se ler "ajudadora" como posição subordinada',
      'muda: A leitura desloca o foco da hierarquia para a necessidade [[tok:hot:01024018:2]] [[com:keil:01002018]]',
      'evidencias: [[tok:hot:01024018:2]] [[lex:strongs-hb:H5828]]',
      'confianca: alta',
      '@fim',
    ].join('\n');
    const c = parseCuriosity(text) as CuriosityCandidate;
    expect(c.kind).toBe('termo');
    expect(new Set(c.evidence)).toEqual(new Set([TOK_EZER, LEX_EZER, COM_EZER]));
    expect(c.evidence).toHaveLength(3);
  });

  it('@nenhuma vira "none"', () => {
    expect(parseCuriosity('@nenhuma\n@fim')).toBe('none');
    expect(parseCuriosity('  **@Nenhuma**  ')).toBe('none');
  });

  it('resposta incompleta (sem @fim) é null', () => {
    const cut = CANDIDATE_TEXT.slice(0, CANDIDATE_TEXT.indexOf('@FIM'));
    expect(parseCuriosity(cut)).toBeNull();
  });

  it('campo faltando, tipo desconhecido ou confiança inválida são null', () => {
    const semMuda = CANDIDATE_TEXT.replace(/muda:.*\n/, '');
    expect(parseCuriosity(semMuda)).toBeNull();
    expect(parseCuriosity(CANDIDATE_TEXT.replace('eco', 'mistério'))).toBeNull();
    expect(parseCuriosity(CANDIDATE_TEXT.replace('confianca: alta', 'confianca: talvez'))).toBeNull();
  });

  it('texto vazio ou sem marcador é null', () => {
    expect(parseCuriosity('')).toBeNull();
    expect(parseCuriosity('Não encontrei nada interessante.')).toBeNull();
  });

  it('campo com valor vazio chega ao portão (não ao parser)', () => {
    const c = parseCuriosity(CANDIDATE_TEXT.replace(/gancho:.*\n/, 'gancho:\n'));
    expect(c).not.toBeNull();
    expect((c as CuriosityCandidate).hook).toBe('');
  });
});

describe('acceptCuriosity', () => {
  it('aprova um eco de NT grego (xref + comentário, duas entradas)', () => {
    expect(acceptCuriosity(candidate(), NT_CTX)).toEqual({ ok: true });
  });

  it('aprova um termo de AT hebraico (token + lexicon_entry)', () => {
    const c = candidate({
      kind: 'termo',
      hook: '"Auxílio" (ezer) não carrega ideia de inferioridade',
      evidence: [TOK_EZER, LEX_EZER],
      listener: 'A palavra traz a ideia de socorro vindo de fora [[lex:strongs-hb:H5828]]',
      change: 'A leitura desloca o foco da hierarquia para a necessidade [[tok:hot:01024018:2]]',
    });
    expect(acceptCuriosity(c, AT_CTX)).toEqual({ ok: true });
  });

  it('reprova confiança média', () => {
    const r = acceptCuriosity(candidate({ confidence: 'media' }), NT_CTX);
    expect(r.ok).toBe(false);
  });

  it('reprova gancho com exclamação ou interrogação', () => {
    expect(acceptCuriosity(candidate({ hook: 'Fp 2:10 ecoa Is 45:23!' }), NT_CTX).ok).toBe(false);
    expect(acceptCuriosity(candidate({ hook: 'Fp 2:10 ecoa Is 45:23?' }), NT_CTX).ok).toBe(false);
    expect(acceptCuriosity(candidate({ hook: '¡Fp 2:10 ecoa Is 45:23' }), NT_CTX).ok).toBe(false);
    expect(acceptCuriosity(candidate({ hook: 'Fp 2:10 ecoa Is 45:23？' }), NT_CTX).ok).toBe(false);
  });

  it('reprova gancho com palavra de exagero (pt e en)', () => {
    const r = acceptCuriosity(candidate({ hook: 'Um eco incrível de Isaías em Filipenses' }), NT_CTX);
    expect(r.ok).toBe(false);
    expect(acceptCuriosity(candidate({ hook: 'A secret echo of Isaiah 45:23' }), NT_CTX).ok).toBe(false);
  });

  it('reprova gancho com mais de 100 caracteres', () => {
    const r = acceptCuriosity(candidate({ hook: 'Fp 2:10 ecoa Is 45:23 '.padEnd(101, 'a') }), NT_CTX);
    expect(r.ok).toBe(false);
  });

  it('reprova campo vazio', () => {
    expect(acceptCuriosity(candidate({ change: '  ' }), NT_CTX).ok).toBe(false);
  });

  it('reprova com só 1 citação distinta', () => {
    const r = acceptCuriosity(candidate({ evidence: [XR_IS] }), NT_CTX);
    expect(r.ok).toBe(false);
    const repetida = candidate({
      evidence: [XR_IS],
      listener: `ouvintes [[${XR_IS}]]`,
      change: `muda [[${XR_IS}]]`,
    });
    expect(acceptCuriosity(repetida, NT_CTX).ok).toBe(false);
  });

  it('reprova citação que não existe no contexto', () => {
    const r = acceptCuriosity(candidate({ evidence: [XR_IS, 'xr:inventada:1'] }), NT_CTX);
    expect(r.ok).toBe(false);
    const naHipotese = candidate({ today: 'Hoje [[com:inventado:9]]' });
    expect(acceptCuriosity(naHipotese, NT_CTX).ok).toBe(false);
  });

  it('reprova eco sem xref, dicionário nem comentário', () => {
    const ctx = ctxOf({ [TXT_FP]: 'verse_text', [TOK_EZER]: 'token' });
    const c = candidate({ evidence: [TXT_FP, TOK_EZER], listener: `[[${TXT_FP}]]`, change: `[[${TOK_EZER}]]` });
    expect(acceptCuriosity(c, ctx).ok).toBe(false);
  });

  it('reprova termo sem token nem léxico', () => {
    const c = candidate({
      kind: 'termo',
      evidence: [COM_CALVINO, COM_EZER],
      listener: `[[${COM_CALVINO}]]`,
      change: `[[${COM_EZER}]]`,
    });
    const ctx = ctxOf({ [COM_CALVINO]: 'commentary', [COM_EZER]: 'commentary' });
    expect(acceptCuriosity(c, ctx).ok).toBe(false);
  });

  it('reprova termo com duas palavras (tokens) mas sem outra fonte do sentido', () => {
    const c = candidate({
      kind: 'termo',
      evidence: [TOK_EZER, TOK_OUTRO],
      listener: `[[${TOK_EZER}]]`,
      change: `[[${TOK_OUTRO}]]`,
    });
    expect(acceptCuriosity(c, AT_CTX).ok).toBe(false);
  });

  it('o motivo da reprovação é uma frase curta em português', () => {
    const r = acceptCuriosity(candidate({ confidence: 'baixa' }), NT_CTX);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.length).toBeGreaterThan(0);
  });
});

describe('parseCuriosityReview', () => {
  it('aprovada e motivo', () => {
    expect(parseCuriosityReview('@veredito aprovada\nmotivo: Fonte confere com o contexto.\n@fim')).toEqual({
      approved: true,
      reason: 'Fonte confere com o contexto.',
    });
  });

  it('reprovada, e qualquer outra coisa também é reprovação', () => {
    expect(parseCuriosityReview('@veredito reprovada\nmotivo: Leitura disputada.\n@fim')?.approved).toBe(false);
    expect(parseCuriosityReview('@veredito talvez\nmotivo: Dúvida.\n@fim')?.approved).toBe(false);
  });

  it('incompleto (sem @fim ou sem @veredito) é null', () => {
    expect(parseCuriosityReview('@veredito aprovada\nmotivo: ok')).toBeNull();
    expect(parseCuriosityReview('motivo: ok\n@fim')).toBeNull();
  });

  it('aceita o veredito na linha seguinte e em cercas de código', () => {
    expect(parseCuriosityReview('```\n@veredito\naprovada\nmotivo: ok\n@fim\n```')?.approved).toBe(true);
  });
});

describe('curiosityMessages e revisor', () => {
  it('inclui o contexto e, sem focus, não traz a nota de foco', () => {
    const msgs = curiosityMessages({ text: 'CONTEXTO-DE-TESTE' });
    expect(msgs[0]!.role).toBe('system');
    expect(msgs[1]!.content).toContain('<contexto>\nCONTEXTO-DE-TESTE\n</contexto>');
    expect(msgs[1]!.content).toContain('@curiosidade eco|termo');
    expect(msgs[1]!.content).not.toContain('Seleção do leitor');
  });

  it('com focus, traz a nota de foco', () => {
    const msgs = curiosityMessages({ text: 'CTX' }, { focus: { start: 50002005, end: 50002008 } });
    expect(msgs[1]!.content).toContain('Seleção do leitor dentro desta unidade');
  });

  it('o revisor recebe contexto e candidato', () => {
    const msgs = curiosityReviewMessages({ text: 'CTX' }, candidate());
    expect(msgs[1]!.content).toContain('<contexto>\nCTX\n</contexto>');
    expect(msgs[1]!.content).toContain('@veredito aprovada|reprovada');
    expect(msgs[1]!.content).toContain(candidate().raw);
  });

  it('chave de cache usa o prefixo curiosity: e os limites são constantes', () => {
    expect(curiosityCacheKey({ start: 50002005, end: 50002008 })).toMatch(/^curiosity:/);
    expect(CURIOSITY_MAX_TOKENS).toBeGreaterThan(0);
    expect(CURIOSITY_REVIEW_MAX_TOKENS).toBeGreaterThan(0);
  });
});

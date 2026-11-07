// O demo reconhece o pedido de aprofundamento pela chave da seção (não pelo rótulo, que é texto de prompt).
import { describe, expect, it } from 'vitest';
import { deepenMessages, SECTION_LABELS, SECTION_KEYS } from '@sensus/core';
import { classifyRequest } from './demo-provider';

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

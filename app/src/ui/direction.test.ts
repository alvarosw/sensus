// Direção da interface: ar e urdu alinham o texto de interface à direita; papéis de conteúdo e textos centralizados
// não mudam. Língua de conteúdo (grego, hebraico, comentário em inglês) não entra aqui: fica com scriptOf no núcleo.
import { describe, expect, it } from 'vitest';
import { APP_LANGS } from '@sensus/core';
import { langIsRtl, uiDirectionStyle } from './direction';

describe('langIsRtl', () => {
  it('só ar e ur são da direita para a esquerda', () => {
    const rtl = APP_LANGS.filter((l) => langIsRtl(l.code)).map((l) => l.code);
    expect(rtl.sort()).toEqual(['ar', 'ur']);
  });
});

describe('uiDirectionStyle', () => {
  it('idioma ltr não recebe estilo', () => {
    expect(uiDirectionStyle({ rtl: false, variant: 'body' })).toEqual({});
  });

  it('texto de interface em rtl: direção e alinhamento à direita', () => {
    expect(uiDirectionStyle({ rtl: true, variant: 'body' })).toEqual({ writingDirection: 'rtl', textAlign: 'right' });
    expect(uiDirectionStyle({ rtl: true })).toEqual({ writingDirection: 'rtl', textAlign: 'right' });
  });

  it('texto centralizado mantém o alinhamento e ganha só a direção', () => {
    expect(uiDirectionStyle({ rtl: true, variant: 'body', center: true })).toEqual({ writingDirection: 'rtl' });
  });

  it('papéis de conteúdo (bíblia, fontes, grego, números) não mudam', () => {
    for (const variant of ['scripture', 'excerpt', 'fullText', 'claim', 'greek', 'lemma', 'lemmaHero', 'mono', 'verseNumber']) {
      expect(uiDirectionStyle({ rtl: true, variant }), variant).toEqual({});
    }
  });

  it('texto marcado como conteúdo não muda, mesmo com papel de interface', () => {
    expect(uiDirectionStyle({ rtl: true, variant: 'body', content: true })).toEqual({});
  });
});

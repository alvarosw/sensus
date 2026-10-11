import { describe, expect, it } from 'vitest';
import { createLoadSequencer, mayAutoScroll, planNavigation } from './nav-sequencing';

describe('planNavigation', () => {
  const win = { lo: 100, hi: 101 };

  it('rola quando o alvo já está na janela, medido e da mesma fonte', () => {
    expect(planNavigation({ targetIdx: 101, win, hasChapter: true, sameSource: true })).toBe('scroll');
  });

  it('carrega a janela quando o alvo é de outro livro (fora da janela)', () => {
    // Atos 16 (janela 100-101) -> Filipenses 2 (idx 1000): não pode só rolar
    expect(planNavigation({ targetIdx: 1000, win, hasChapter: true, sameSource: true })).toBe('load');
  });

  it('carrega quando o capítulo está na janela mas ainda não foi medido', () => {
    expect(planNavigation({ targetIdx: 100, win, hasChapter: false, sameSource: true })).toBe('load');
  });

  it('carrega quando a fonte do texto mudou ou não há janela ainda', () => {
    expect(planNavigation({ targetIdx: 100, win, hasChapter: true, sameSource: false })).toBe('load');
    expect(planNavigation({ targetIdx: 100, win: null, hasChapter: true, sameSource: true })).toBe('load');
  });
});

describe('createLoadSequencer', () => {
  it('descarta a carga antiga quando um pedido mais novo começou', () => {
    const seq = createLoadSequencer();
    const first = seq.begin();
    const second = seq.begin();
    // a primeira termina depois: não pode sobrescrever a janela do segundo pedido
    expect(seq.isCurrent(first)).toBe(false);
    expect(seq.isCurrent(second)).toBe(true);
  });
});

describe('mayAutoScroll', () => {
  const idle = { dragging: false, navPending: false, loadingNav: false, sinceNavMs: 10_000 };

  it('libera quando o leitor está parado', () => {
    expect(mayAutoScroll(idle)).toBe(true);
  });

  it('bloqueia durante uma navegação em carga (o geometria ainda é da lista antiga)', () => {
    expect(mayAutoScroll({ ...idle, loadingNav: true })).toBe(false);
    expect(mayAutoScroll({ ...idle, navPending: true })).toBe(false);
  });

  it('bloqueia durante arraste e logo após uma navegação', () => {
    expect(mayAutoScroll({ ...idle, dragging: true })).toBe(false);
    expect(mayAutoScroll({ ...idle, sinceNavMs: 100 })).toBe(false);
  });
});

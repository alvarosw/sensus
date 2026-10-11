import { describe, expect, it } from 'vitest';
import { backAction, closeTopLayer, openBackLayerCount, registerBackLayer, topBackLayer } from './back-registry';

describe('pilha do voltar', () => {
  it('fecha a camada de maior prioridade primeiro', () => {
    const calls: string[] = [];
    const u1 = registerBackLayer('sheet', 20, () => calls.push('sheet'));
    const u2 = registerBackLayer('chat', 40, () => calls.push('chat'));
    expect(closeTopLayer()).toBe(true);
    expect(calls).toEqual(['chat']);
    u2();
    u1();
    expect(openBackLayerCount()).toBe(0);
  });

  it('em empate de prioridade, fecha a registrada por último', () => {
    const calls: string[] = [];
    const a = registerBackLayer('menu-a', 45, () => calls.push('a'));
    const b = registerBackLayer('answer-text', 45, () => calls.push('b'));
    closeTopLayer();
    expect(calls).toEqual(['b']);
    a();
    b();
  });

  it('remover uma camada não remove outra com o mesmo nome', () => {
    const calls: string[] = [];
    const first = registerBackLayer('menu-x', 45, () => calls.push('first'));
    const second = registerBackLayer('menu-x', 45, () => calls.push('second'));
    first();
    expect(openBackLayerCount()).toBe(1);
    expect(topBackLayer()?.id).toBe('menu-x');
    closeTopLayer();
    expect(calls).toEqual(['second']);
    second();
  });

  it('remover duas vezes é inofensivo', () => {
    const remove = registerBackLayer('chat', 40, () => undefined);
    remove();
    remove();
    expect(openBackLayerCount()).toBe(0);
  });

  it('sem camadas, closeTopLayer devolve false', () => {
    expect(closeTopLayer()).toBe(false);
  });
});

describe('ação do voltar', () => {
  it('com teclado aberto, o primeiro voltar só esconde o teclado (mesmo com chat aberto)', () => {
    expect(backAction(true, true)).toBe('dismiss-keyboard');
    expect(backAction(true, false)).toBe('dismiss-keyboard');
  });

  it('sem teclado, fecha a camada; sem camada, pede a saída', () => {
    expect(backAction(false, true)).toBe('close-layer');
    expect(backAction(false, false)).toBe('confirm-exit');
  });
});

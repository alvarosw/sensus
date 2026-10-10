import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserReturnWatch, RETURN_GRACE_MS } from './browserReturn';

describe('createBrowserReturnWatch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancela depois da folga quando o app volta ao ativo após ir para segundo plano', () => {
    const onCancel = vi.fn();
    const watch = createBrowserReturnWatch({ onCancel });
    watch.appState('background');
    watch.appState('active');
    expect(onCancel).not.toHaveBeenCalled();
    vi.advanceTimersByTime(RETURN_GRACE_MS - 1);
    expect(onCancel).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('não cancela um "active" que nunca passou por segundo plano', () => {
    const onCancel = vi.fn();
    const watch = createBrowserReturnWatch({ onCancel });
    watch.appState('active');
    vi.advanceTimersByTime(RETURN_GRACE_MS * 3);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('o fechamento da aba (cancel ou dismiss) também agenda o cancelamento', () => {
    const cancelled = vi.fn();
    createBrowserReturnWatch({ onCancel: cancelled }).browserClosed('cancel');
    vi.advanceTimersByTime(RETURN_GRACE_MS);
    expect(cancelled).toHaveBeenCalledTimes(1);

    const dismissed = vi.fn();
    createBrowserReturnWatch({ onCancel: dismissed }).browserClosed('dismiss');
    vi.advanceTimersByTime(RETURN_GRACE_MS);
    expect(dismissed).toHaveBeenCalledTimes(1);
  });

  it('resultado de sucesso do navegador, sozinho, não agenda cancelamento', () => {
    const onCancel = vi.fn();
    const watch = createBrowserReturnWatch({ onCancel });
    watch.browserClosed('success');
    vi.advanceTimersByTime(RETURN_GRACE_MS * 2);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('settle antes da folga (código chegou no loopback) impede o cancelamento', () => {
    const onCancel = vi.fn();
    const watch = createBrowserReturnWatch({ onCancel });
    watch.appState('background');
    watch.appState('active');
    watch.settle();
    vi.advanceTimersByTime(RETURN_GRACE_MS * 2);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('eventos repetidos agendam uma única vez e não disparam depois de settle', () => {
    const onCancel = vi.fn();
    const watch = createBrowserReturnWatch({ onCancel });
    watch.appState('background');
    watch.appState('active');
    watch.appState('active');
    watch.browserClosed('cancel');
    vi.advanceTimersByTime(RETURN_GRACE_MS);
    expect(onCancel).toHaveBeenCalledTimes(1);
    watch.settle();
    watch.browserClosed('dismiss');
    vi.advanceTimersByTime(RETURN_GRACE_MS * 2);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('usa os temporizadores injetados e limpa o pendente no settle', () => {
    const pending: Array<() => void> = [];
    const clearTimer = vi.fn();
    const onCancel = vi.fn();
    const watch = createBrowserReturnWatch({
      onCancel,
      setTimer: (fn) => {
        pending.push(fn);
        return pending.length;
      },
      clearTimer,
    });
    watch.browserClosed('cancel');
    watch.settle();
    expect(clearTimer).toHaveBeenCalledWith(1);
    pending.forEach((fn) => fn());
    expect(onCancel).not.toHaveBeenCalled();
  });
});

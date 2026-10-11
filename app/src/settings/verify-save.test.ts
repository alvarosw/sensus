import { describe, expect, it } from 'vitest';
import { LLMError } from '@sensus/core';
import {
  failureOf,
  isSaveBusy,
  isVerifying,
  offersQuickPicks,
  SLOW_AFTER_MS,
  suggestionsFor,
  VERIFY_IDLE,
  VERIFY_TIMEOUT_MS,
  verifyReducer,
  type FailureReason,
  type VerifyEvent,
  type VerifyState,
} from './verify-save';

const T0 = 1_000_000;

function run(events: VerifyEvent[], start: VerifyState = VERIFY_IDLE): VerifyState {
  return events.reduce(verifyReducer, start);
}

const startSave = (id = 1, at = T0): VerifyEvent => ({ type: 'start', id, purpose: 'save', at });
const timeoutFail = { reason: 'timeout' as const, message: 'x' };

describe('verifyReducer: caminho feliz', () => {
  it('verifica, passa e salva sem aviso de lentidão', () => {
    const passed = run([startSave(), { type: 'passed', id: 1, at: T0 + 1_200 }]);
    expect(passed).toEqual({ phase: 'passed', id: 1, purpose: 'save', startedAt: T0, elapsedMs: 1_200, slow: false });
    expect(isSaveBusy(passed)).toBe(true);

    const saved = verifyReducer(passed, { type: 'saved', id: 1 });
    expect(saved).toEqual({ phase: 'saved', id: 1, elapsedMs: 1_200, slow: false });
    expect(isSaveBusy(saved)).toBe(false);
  });

  it('só verificar (purpose check) não entra em estado de gravação', () => {
    const passed = run([{ type: 'start', id: 2, purpose: 'check', at: T0 }, { type: 'passed', id: 2, at: T0 + 300 }]);
    expect(passed.phase).toBe('passed');
    expect(isSaveBusy(passed)).toBe(false);
    // 'saved' só vale para uma gravação, nunca para uma verificação só
    expect(verifyReducer(passed, { type: 'saved', id: 2 })).toBe(passed);
  });
});

describe('verifyReducer: aviso de lentidão', () => {
  it('não avisa antes de SLOW_AFTER_MS e avisa depois', () => {
    const early = run([startSave(), { type: 'tick', at: T0 + SLOW_AFTER_MS - 1 }]);
    expect(early.phase === 'verifying' && early.slow).toBe(false);
    const late = verifyReducer(early, { type: 'tick', at: T0 + SLOW_AFTER_MS });
    expect(late.phase === 'verifying' && late.slow).toBe(true);
    expect(isVerifying(late)).toBe(true);
    expect(offersQuickPicks(late)).toBe(true);
  });

  it('resposta que chega depois do aviso segue válida, marcada como lenta', () => {
    const passed = run([startSave(), { type: 'tick', at: T0 + 9_000 }, { type: 'passed', id: 1, at: T0 + 12_000 }]);
    expect(passed).toMatchObject({ phase: 'passed', slow: true, elapsedMs: 12_000 });
    const saved = verifyReducer(passed, { type: 'saved', id: 1 });
    expect(saved).toMatchObject({ phase: 'saved', slow: true });
    expect(offersQuickPicks(saved)).toBe(true);
  });

  it('resposta depois de 15 s também fica lenta mesmo sem tick intermediário', () => {
    const passed = run([startSave(), { type: 'passed', id: 1, at: T0 + 15_500 }]);
    expect(passed).toMatchObject({ phase: 'passed', slow: true });
  });
});

describe('verifyReducer: falhas e tempo esgotado', () => {
  it('falha na verificação não deixa salvar e registra o motivo', () => {
    const failure = failureOf(new LLMError('x', 'auth', 401), 'm');
    const failed = run([startSave(), { type: 'failed', id: 1, at: T0 + 400, failure }]);
    expect(failed).toEqual({ phase: 'failed', id: 1, purpose: 'save', failure, elapsedMs: 400 });
    expect(isSaveBusy(failed)).toBe(false);
  });

  it('tempo esgotado sem resposta vira falha de timeout, sem gravar', () => {
    const state = run([startSave(), { type: 'tick', at: T0 + VERIFY_TIMEOUT_MS }]);
    expect(state.phase).toBe('failed');
    if (state.phase !== 'failed') throw new Error('esperava falha');
    expect(state.failure.reason).toBe('timeout');
    expect(state.elapsedMs).toBe(VERIFY_TIMEOUT_MS);
  });

  it('resposta que chega depois do tempo esgotado não ressuscita a verificação', () => {
    const timedOut = run([startSave(), { type: 'tick', at: T0 + VERIFY_TIMEOUT_MS }]);
    const late = verifyReducer(timedOut, { type: 'passed', id: 1, at: T0 + VERIFY_TIMEOUT_MS + 5 });
    expect(late).toBe(timedOut);
  });

  it('falha ao gravar (depois de verificar) aparece como falha de salvamento', () => {
    const passed = run([startSave(), { type: 'passed', id: 1, at: T0 + 200 }]);
    const failure = { reason: 'save' as const, message: 'disco cheio' };
    const failed = verifyReducer(passed, { type: 'failed', id: 1, at: T0 + 250, failure });
    expect(failed).toMatchObject({ phase: 'failed', purpose: 'save', failure: { reason: 'save' } });
  });
});

describe('verifyReducer: cancelar, trocar tentativa e ids', () => {
  it('cancelar durante a verificação volta ao início, e o resultado tardio é ignorado', () => {
    const cancelled = run([startSave(), { type: 'cancel' }]);
    expect(cancelled).toEqual(VERIFY_IDLE);
    expect(verifyReducer(cancelled, { type: 'passed', id: 1, at: T0 + 100 })).toEqual(VERIFY_IDLE);
    expect(verifyReducer(cancelled, { type: 'failed', id: 1, at: T0 + 100, failure: timeoutFail })).toEqual(VERIFY_IDLE);
  });

  it('cancelar não mexe em uma gravação em curso nem em estado salvo', () => {
    const passed = run([startSave(), { type: 'passed', id: 1, at: T0 + 100 }]);
    expect(verifyReducer(passed, { type: 'cancel' })).toBe(passed);
    const saved = verifyReducer(passed, { type: 'saved', id: 1 });
    expect(verifyReducer(saved, { type: 'cancel' })).toBe(saved);
  });

  it('resultado de uma tentativa antiga não afeta a nova (troca de modelo no meio)', () => {
    const second = run([startSave(1, T0), startSave(2, T0 + 2_000)]);
    expect(verifyReducer(second, { type: 'passed', id: 1, at: T0 + 2_100 })).toBe(second);
    expect(verifyReducer(second, { type: 'failed', id: 1, at: T0 + 2_100, failure: timeoutFail })).toBe(second);
    const ok = verifyReducer(second, { type: 'passed', id: 2, at: T0 + 2_500 });
    expect(ok).toMatchObject({ phase: 'passed', id: 2, startedAt: T0 + 2_000, elapsedMs: 500, slow: false });
  });

  it('reset limpa qualquer estado', () => {
    const failed = run([startSave(), { type: 'failed', id: 1, at: T0 + 10, failure: timeoutFail }]);
    expect(verifyReducer(failed, { type: 'reset' })).toEqual(VERIFY_IDLE);
  });

  it('tick em estados que não verificam não muda nada', () => {
    expect(verifyReducer(VERIFY_IDLE, { type: 'tick', at: T0 + 99_000 })).toBe(VERIFY_IDLE);
  });
});

describe('falhas: classificação do erro do provedor', () => {
  it('401 vira chave rejeitada, com o status', () => {
    expect(failureOf(new LLMError('x', 'auth', 401), 'm')).toEqual({
      reason: 'auth',
      message: 'Chave de API rejeitada pelo provedor (HTTP 401).',
    });
  });

  it('404 vira modelo indisponível, com a frase da tela', () => {
    const f = failureOf(new LLMError('x', 'not_found', 404), 'acme/chat');
    expect(f.reason).toBe('model_unavailable');
    expect(f.message).toBe('O modelo acme/chat não está disponível para esta conta (HTTP 404).');
  });

  it('timeout, rede, limite, servidor e protocolo têm motivo próprio', () => {
    const cases: Array<[LLMError, FailureReason]> = [
      [new LLMError('x', 'timeout'), 'timeout'],
      [new LLMError('x', 'network'), 'network'],
      [new LLMError('x', 'rate_limit', 429), 'rate_limit'],
      [new LLMError('x', 'server', 503), 'server'],
      [new LLMError('x', 'protocol'), 'protocol'],
    ];
    for (const [err, reason] of cases) expect(failureOf(err, 'm').reason).toBe(reason);
    expect(failureOf(new LLMError('Base URL não definida.', 'config'), 'm')).toEqual({
      reason: 'config',
      message: 'Base URL não definida.',
    });
  });

  it('erro comum (Error, texto ou vazio) vira "outro" com a mensagem', () => {
    expect(failureOf(new Error('quebrou'), 'm')).toEqual({ reason: 'other', message: 'quebrou' });
    expect(failureOf('texto solto', 'm')).toEqual({ reason: 'other', message: 'texto solto' });
    expect(failureOf('', 'm').message).toBe('Falha desconhecida.');
  });

  it('toda falha tem sugestões', () => {
    const reasons: FailureReason[] = ['auth', 'model_unavailable', 'timeout', 'network', 'rate_limit', 'server', 'config', 'protocol', 'save', 'other'];
    for (const r of reasons) expect(suggestionsFor(r).length).toBeGreaterThan(0);
  });

  it('opções rápidas só para lento, sem resposta e modelo indisponível', () => {
    const failedWith = (reason: FailureReason): VerifyState => ({
      phase: 'failed',
      id: 1,
      purpose: 'save',
      failure: { reason, message: '' },
      elapsedMs: 1,
    });
    expect(offersQuickPicks(failedWith('model_unavailable'))).toBe(true);
    expect(offersQuickPicks(failedWith('timeout'))).toBe(true);
    expect(offersQuickPicks(failedWith('auth'))).toBe(false);
    expect(offersQuickPicks(failedWith('network'))).toBe(false);
    expect(offersQuickPicks(VERIFY_IDLE)).toBe(false);
  });
});

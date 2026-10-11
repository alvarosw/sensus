// Máquina de estados do download: caminho feliz, retomada, repetição por sha256, erros e eventos inválidos.
import { describe, expect, it } from 'vitest';
import { IDLE_STATE, MAX_ATTEMPTS, canStart, isActive, reduce, type MachineEvent, type MachineState } from './download-machine';

function run(from: MachineState, events: MachineEvent[]): MachineState {
  return events.reduce(reduce, from);
}

describe('caminho feliz', () => {
  it('idle → checking → downloading → verifying → extracting → installing → done', () => {
    const s = run(IDLE_STATE, [
      { type: 'start' },
      { type: 'manifest' },
      { type: 'bytes', bytes: 10, total: 100 },
      { type: 'downloaded' },
      { type: 'verified' },
      { type: 'extracted' },
      { type: 'installed' },
    ]);
    expect(s.phase).toBe('done');
    expect(s.bytes).toBe(s.total === 0 ? 0 : s.total);
    expect(s.error).toBeUndefined();
  });
});

describe('pausa e retomada', () => {
  it('cancelar durante o download guarda o parcial e a retomada continua dos bytes gravados', () => {
    let s = run(IDLE_STATE, [{ type: 'start' }, { type: 'manifest' }, { type: 'bytes', bytes: 40, total: 100 }]);
    s = reduce(s, { type: 'pause', reason: 'user' });
    expect(s).toMatchObject({ phase: 'paused', pause: 'user', bytes: 40, total: 100 });
    s = reduce(s, { type: 'start' });
    expect(s.phase).toBe('checking');
    expect(s.bytes).toBe(40);
  });

  it('queda de rede pausa com motivo "network"', () => {
    const s = run(IDLE_STATE, [{ type: 'start' }, { type: 'manifest' }, { type: 'pause', reason: 'network' }]);
    expect(s).toMatchObject({ phase: 'paused', pause: 'network' });
  });

  it('interrompido ao abrir o app: idle vira paused com o parcial existente', () => {
    const s = reduce(IDLE_STATE, { type: 'interrupted', bytes: 12, total: 50 });
    expect(s).toMatchObject({ phase: 'paused', pause: 'interrupted', bytes: 12, total: 50 });
  });

  it('pausa não se aplica durante verificação ou instalação', () => {
    const verifying = run(IDLE_STATE, [{ type: 'start' }, { type: 'manifest' }, { type: 'downloaded' }]);
    expect(reduce(verifying, { type: 'pause', reason: 'user' })).toBe(verifying);
  });
});

describe('sha256 divergente', () => {
  it('refaz o download uma vez (tentativa 2) e depois falha com checksum', () => {
    let s = run(IDLE_STATE, [{ type: 'start' }, { type: 'manifest' }, { type: 'downloaded' }]);
    expect(MAX_ATTEMPTS).toBe(2);
    s = reduce(s, { type: 'mismatch' });
    expect(s).toMatchObject({ phase: 'downloading', attempt: 2, bytes: 0 });
    s = run(s, [{ type: 'downloaded' }]);
    s = reduce(s, { type: 'mismatch' });
    expect(s).toMatchObject({ phase: 'error', error: 'checksum' });
  });

  it('um novo start zera a contagem de tentativas', () => {
    const failed = run(IDLE_STATE, [{ type: 'start' }, { type: 'manifest' }, { type: 'downloaded' }, { type: 'mismatch' }, { type: 'downloaded' }, { type: 'mismatch' }]);
    expect(reduce(failed, { type: 'start' }).attempt).toBe(1);
  });
});

describe('erros', () => {
  it('falha em qualquer fase ativa vai para error com o motivo', () => {
    for (const phase of ['checking', 'downloading', 'verifying', 'extracting', 'installing'] as const) {
      const s = reduce({ ...IDLE_STATE, phase }, { type: 'fail', error: 'space' });
      expect(s).toMatchObject({ phase: 'error', error: 'space' });
    }
  });

  it('falha não se aplica fora de fase ativa', () => {
    expect(reduce({ ...IDLE_STATE, phase: 'paused' }, { type: 'fail', error: 'network' }).phase).toBe('paused');
    expect(reduce({ ...IDLE_STATE, phase: 'done' }, { type: 'fail', error: 'network' }).phase).toBe('done');
  });

  it('erro é limpo ao recomeçar', () => {
    const errored = reduce({ ...IDLE_STATE, phase: 'checking' }, { type: 'fail', error: 'manifest' });
    expect(reduce(errored, { type: 'start' })).toMatchObject({ phase: 'checking', error: undefined });
  });
});

describe('eventos fora de hora', () => {
  it('são ignorados e devolvem o mesmo estado', () => {
    const idle = IDLE_STATE;
    expect(reduce(idle, { type: 'downloaded' })).toBe(idle);
    expect(reduce(idle, { type: 'installed' })).toBe(idle);
    expect(reduce(idle, { type: 'bytes', bytes: 1, total: 2 })).toBe(idle);
    expect(reduce(idle, { type: 'interrupted', bytes: 1, total: 2 })).toMatchObject({ phase: 'paused' });
  });

  it('start não reinicia um download em andamento', () => {
    const running = { ...IDLE_STATE, phase: 'downloading' as const, bytes: 5, total: 9 };
    expect(reduce(running, { type: 'start' })).toBe(running);
  });

  it('reset não apaga um download ativo', () => {
    const running = { ...IDLE_STATE, phase: 'installing' as const };
    expect(reduce(running, { type: 'reset' })).toBe(running);
    expect(reduce({ ...IDLE_STATE, phase: 'error', error: 'space' }, { type: 'reset' })).toEqual(IDLE_STATE);
  });
});

describe('predicados', () => {
  it('canStart e isActive são complementares nas fases conhecidas', () => {
    expect(canStart('idle')).toBe(true);
    expect(canStart('paused')).toBe(true);
    expect(canStart('downloading')).toBe(false);
    expect(isActive('extracting')).toBe(true);
    expect(isActive('paused')).toBe(false);
  });
});

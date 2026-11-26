// Regra de início do resumo na folha: espiar espera a seleção parar; meia altura e tela cheia começam já.
// Vale para NT grego (Fp 2:5-8) e AT hebraico (1Rs 15:15): a regra não olha o testamento.
import { describe, expect, it } from 'vitest';
import { PEEK_DWELL_MS, shouldStartSummary, type SummaryStartState } from './summary-start';

const READY: SummaryStartState = { detent: 'peek', dwellMs: PEEK_DWELL_MS, hasProvider: true, ctxReady: true, status: undefined };

describe('shouldStartSummary', () => {
  it('PEEK_DWELL_MS é 700 ms', () => {
    expect(PEEK_DWELL_MS).toBe(700);
  });

  it('espiar: não começa antes de 700 ms parada e começa depois', () => {
    expect(shouldStartSummary({ ...READY, dwellMs: 0 })).toBe(false);
    expect(shouldStartSummary({ ...READY, dwellMs: PEEK_DWELL_MS - 1 })).toBe(false);
    expect(shouldStartSummary({ ...READY, dwellMs: PEEK_DWELL_MS })).toBe(true);
    expect(shouldStartSummary({ ...READY, dwellMs: PEEK_DWELL_MS + 500 })).toBe(true);
  });

  it('meia altura e tela cheia começam na hora, sem esperar', () => {
    expect(shouldStartSummary({ ...READY, detent: 'half', dwellMs: 0 })).toBe(true);
    expect(shouldStartSummary({ ...READY, detent: 'full', dwellMs: 0 })).toBe(true);
  });

  it('folha fechada nunca começa, mesmo com tempo de sobra', () => {
    expect(shouldStartSummary({ ...READY, detent: 'closed', dwellMs: 10_000 })).toBe(false);
  });

  it('sem provedor de IA ou sem contexto pronto, não começa', () => {
    expect(shouldStartSummary({ ...READY, hasProvider: false, detent: 'half' })).toBe(false);
    expect(shouldStartSummary({ ...READY, ctxReady: false, detent: 'half' })).toBe(false);
    expect(shouldStartSummary({ ...READY, ctxReady: false })).toBe(false);
  });

  it('resumo já pronto ou com erro não recomeça, em espiar nem em meia altura', () => {
    for (const status of ['done', 'error'] as const) {
      expect(shouldStartSummary({ ...READY, status })).toBe(false);
      expect(shouldStartSummary({ ...READY, status, detent: 'half' })).toBe(false);
    }
  });

  it('em andamento ou ocioso, a regra segue o detent (a guarda de geração fica no hook)', () => {
    expect(shouldStartSummary({ ...READY, status: 'streaming', detent: 'half' })).toBe(true);
    expect(shouldStartSummary({ ...READY, status: 'idle', dwellMs: 0 })).toBe(false);
  });
});

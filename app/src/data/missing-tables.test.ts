// Tolerância a tabelas ausentes (banco de leitura): só o erro de objeto ausente vira lista vazia.
import { describe, expect, it } from 'vitest';
import type { SqlDriver } from '@sensus/core';
import { missingObjectOf, tolerateMissingTables } from './missing-tables';

function driverThrowing(error: unknown): SqlDriver {
  return {
    all: () => {
      throw error;
    },
  } as unknown as SqlDriver;
}

describe('missingObjectOf', () => {
  it('reconhece tabela e view ausentes', () => {
    expect(missingObjectOf(new Error('no such table: commentary'))).toBe('commentary');
    expect(missingObjectOf(new Error('Error code 1: no such view: verse_t'))).toBe('verse_t');
  });
  it('outros erros não contam', () => {
    expect(missingObjectOf(new Error('syntax error near SELECT'))).toBeNull();
    expect(missingObjectOf('texto qualquer')).toBeNull();
  });
});

describe('tolerateMissingTables', () => {
  it('tabela ausente vira lista vazia', async () => {
    const d = tolerateMissingTables(driverThrowing(new Error('no such table: xref')));
    await expect(d.all('SELECT * FROM xref')).resolves.toEqual([]);
  });

  it('outros erros continuam aparecendo', async () => {
    const d = tolerateMissingTables(driverThrowing(new Error('disk I/O error')));
    await expect(d.all('SELECT 1')).rejects.toThrow('disk I/O error');
  });

  it('consultas que funcionam passam sem alteração', async () => {
    const rows = [{ n: 1 }];
    const d = tolerateMissingTables({ all: async () => rows } as unknown as SqlDriver);
    await expect(d.all('SELECT 1 AS n')).resolves.toBe(rows);
  });
});

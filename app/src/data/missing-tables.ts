// Banco de leitura não tem todas as tabelas de estudo. As consultas do núcleo que tocam uma tabela ausente
// devolvem lista vazia (em vez de erro), e o restante do painel continua. Puro.
import type { SqlDriver, SqlParam } from '@sensus/core';

const MISSING = /no such (?:table|view): ([\w."]+)/i;

/** Nome da tabela/view ausente quando o erro é esse; null para qualquer outro erro. */
export function missingObjectOf(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  const m = MISSING.exec(message);
  return m ? m[1]! : null;
}

export function tolerateMissingTables(driver: SqlDriver): SqlDriver {
  return {
    async all<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]> {
      try {
        return await driver.all<T>(sql, params);
      } catch (e) {
        if (missingObjectOf(e) !== null) return [];
        throw e;
      }
    },
  };
}

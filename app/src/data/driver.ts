// Driver SQLite do app (expo-sqlite). Consultas a tabelas que o banco de leitura não tem devolvem lista vazia
// (ver missing-tables.ts), para o núcleo degradar sem erro.
import * as SQLite from 'expo-sqlite';
import type { SqlDriver, SqlParam } from '@sensus/core';
import { tolerateMissingTables } from './missing-tables';

/** SqlDriver do núcleo implementado sobre expo-sqlite. */
export function createExpoSqlDriver(db: SQLite.SQLiteDatabase): SqlDriver {
  return tolerateMissingTables({
    all<T = Record<string, unknown>>(sql: string, params: SqlParam[] = []): Promise<T[]> {
      return db.getAllAsync<T>(sql, params);
    },
  });
}

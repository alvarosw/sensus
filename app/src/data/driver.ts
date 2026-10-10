import * as SQLite from 'expo-sqlite';
import type { SqlDriver, SqlParam } from '@sensus/core';
import bundledDb from '../../assets/sensus.db';
import bundled from './bundled-db.json';

const DB_NAME = 'sensus.db';

/** SqlDriver do núcleo implementado sobre expo-sqlite. */
export function createExpoSqlDriver(db: SQLite.SQLiteDatabase): SqlDriver {
  return {
    all<T = Record<string, unknown>>(sql: string, params: SqlParam[] = []): Promise<T[]> {
      return db.getAllAsync<T>(sql, params);
    },
  };
}

/** meta.built_at do banco instalado; null se não existir ou estiver corrompido. */
async function installedBuiltAt(): Promise<string | null> {
  let db: SQLite.SQLiteDatabase | null = null;
  try {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM meta WHERE key = 'built_at'",
    );
    return row?.value ?? null;
  } catch {
    return null;
  } finally {
    await db?.closeAsync().catch(() => undefined);
  }
}

/**
 * Abre o banco do app. Copia o banco empacotado (assets/sensus.db) para o
 * diretório do SQLite somente quando o arquivo instalado não existe ou quando
 * seu meta.built_at difere do empacotado (src/data/bundled-db.json, gerado por
 * scripts/sync-db.mjs). Caso contrário, reaproveita a cópia existente.
 */
export async function openSensusDatabase(): Promise<SQLite.SQLiteDatabase> {
  const installed = await installedBuiltAt();
  if (installed !== bundled.builtAt) {
    await SQLite.importDatabaseFromAssetAsync(DB_NAME, {
      assetId: bundledDb,
      forceOverwrite: true,
    });
  }
  return SQLite.openDatabaseAsync(DB_NAME);
}

// Abre o banco do usuário (user.db, na pasta do SQLite do app) e aplica as migrações pendentes. Uma conexão só,
// aberta na primeira vez e reaproveitada. Falha ao abrir: a promessa rejeita e a próxima chamada tenta de novo.
import * as SQLite from 'expo-sqlite';
import { migrateUserDb } from './migrations';

export const USER_DB_NAME = 'user.db';

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

export function openUserDb(): Promise<SQLite.SQLiteDatabase> {
  if (!opening) {
    opening = (async () => {
      const db = await SQLite.openDatabaseAsync(USER_DB_NAME);
      try {
        await migrateUserDb(db);
        return db;
      } catch (e) {
        opening = null;
        await db.closeAsync().catch(() => undefined);
        throw e;
      }
    })();
    opening.catch(() => {
      opening = null;
    });
  }
  return opening;
}

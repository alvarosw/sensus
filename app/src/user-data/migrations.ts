// Esquema do banco do usuário (user.db, no aparelho). Cada migração é numerada e roda uma vez, na ordem, dentro de
// uma transação; a versão aplicada fica em PRAGMA user_version. Nunca editar uma migração já publicada: acrescente
// outra. Este banco é separado do banco de fontes (sensus.db) e das Bíblias (bible-<id>.db).

export interface UserMigration {
  version: number;
  sql: string;
}

export const USER_MIGRATIONS: readonly UserMigration[] = [
  {
    version: 1,
    // Marca = referência (vid inicial e final) + cor (grifo) ou texto (nota). Nunca o texto da Bíblia nem a edição.
    // Exatamente uma das duas: grifo e nota do mesmo trecho são duas linhas (ver marks-model.ts).
    sql: `
      CREATE TABLE marks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_vid INTEGER NOT NULL,
        end_vid INTEGER NOT NULL,
        color TEXT,
        note TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        CHECK (start_vid <= end_vid),
        CHECK ((color IS NULL) <> (note IS NULL))
      );
      CREATE INDEX marks_by_range ON marks (start_vid, end_vid);
    `,
  },
];

/** Versão do esquema depois da última migração. */
export const USER_DB_VERSION = USER_MIGRATIONS[USER_MIGRATIONS.length - 1]!.version;

/** O que a migração usa de um banco (expo-sqlite e o teste implementam). */
export interface MigrationDb {
  getFirstAsync<T>(sql: string): Promise<T | null>;
  execAsync(sql: string): Promise<void>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/** Aplica, na ordem, as migrações maiores que a versão gravada no banco (cada uma numa transação). */
export async function migrateUserDb(db: MigrationDb): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (const m of USER_MIGRATIONS) {
    if (m.version <= current) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(m.sql);
      await db.execAsync(`PRAGMA user_version = ${m.version}`);
    });
  }
}

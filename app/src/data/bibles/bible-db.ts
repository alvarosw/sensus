// Bíblias baixadas: conexões abertas e lista das instaladas. Cada Bíblia é um banco SQLite próprio (bible-<id>.db) na
// pasta do SQLite do app. O Repo pergunta por ela pelo textDriver (active-db.ts); BLivre e KJV ficam no banco
// principal e não têm arquivo aqui.
import * as SQLite from 'expo-sqlite';
import { File } from 'expo-file-system';
import { textSources, type BibleCatalog, type SqlDriver } from '@sensus/core';
import { createExpoSqlDriver } from '../driver';
import { sqliteDirectory } from '../sqlite-paths';
import { bibleFileName, bibleIdOfFile, installedBibleIds } from './bible-model';

interface OpenBible {
  db: SQLite.SQLiteDatabase;
  driver: SqlDriver;
}

const open = new Map<string, OpenBible>();

/** Nomes dos arquivos da pasta do SQLite (vazio se a pasta não existe ou não pode ser lida). */
function sqliteFileNames(): string[] {
  try {
    const dir = sqliteDirectory();
    if (!dir.exists) return [];
    return dir.list().filter((e): e is File => e instanceof File).map((f) => f.name);
  } catch {
    return [];
  }
}

/** Ids instalados agora (síncrono, sem abrir nada): as do banco principal e as baixadas. */
export function installedIds(catalog: BibleCatalog | null): string[] {
  return installedBibleIds(sqliteFileNames(), textSources(), catalog);
}

/** Driver de uma Bíblia baixada que está aberta. Null para as do banco principal (ver Repo, textDriver). */
export function bibleDriver(id: string): SqlDriver | null {
  return open.get(id)?.driver ?? null;
}

/** Abre a Bíblia baixada se o arquivo existir. Chamar de novo com a conexão aberta não faz nada. */
export async function openBible(id: string): Promise<void> {
  if (open.has(id)) return;
  const name = bibleFileName(id);
  if (!new File(sqliteDirectory(), name).exists) return;
  const db = await SQLite.openDatabaseAsync(name);
  open.set(id, { db, driver: createExpoSqlDriver(db) });
}

/** Versão do banco instalado (meta.version), ou null se a Bíblia não está instalada ou não abre. */
export async function installedBibleVersion(id: string): Promise<string | null> {
  try {
    await openBible(id);
    const handle = open.get(id);
    if (!handle) return null;
    const row = await handle.db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = 'version'");
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function closeBible(id: string): Promise<void> {
  const handle = open.get(id);
  if (!handle) return;
  open.delete(id);
  await handle.db.closeAsync().catch(() => undefined);
}

/** Abre todas as Bíblias baixadas da pasta (ao abrir o app, antes do banco principal). Falha de uma não impede as outras. */
export async function openInstalledBibles(): Promise<void> {
  for (const name of sqliteFileNames()) {
    const id = bibleIdOfFile(name);
    if (id) await openBible(id).catch(() => undefined);
  }
}

/**
 * Apaga um arquivo do SQLite com os auxiliares (WAL, memória compartilhada, diário). Com `withMain` false, mantém o
 * próprio arquivo (usado na troca, que substitui o arquivo de uma vez).
 */
export function deleteSqliteFile(name: string, withMain = true): void {
  const names = withMain ? [name, `${name}-wal`, `${name}-shm`, `${name}-journal`] : [`${name}-wal`, `${name}-shm`, `${name}-journal`];
  for (const n of names) {
    try {
      const f = new File(sqliteDirectory(), n);
      if (f.exists) f.delete();
    } catch {
      // arquivo ausente ou em uso: a instalação seguinte confere de novo
    }
  }
}

/** Remove uma Bíblia baixada: fecha a conexão e apaga o arquivo. */
export async function removeBibleFile(id: string): Promise<void> {
  await closeBible(id);
  deleteSqliteFile(bibleFileName(id));
}

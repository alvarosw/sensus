// Banco ativo do app: qual arquivo SQLite está aberto e em qual edição.
//  - 'sensus.db': o banco empacotado (edição leitor, ou completa em builds de desenvolvimento). Copiado de
//    assets/sensus.db quando o built_at difere de src/data/bundled-db.json (scripts/sync-db.mjs).
//  - 'sensus-full.db': a edição completa baixada (ver download-engine.ts). Quando existe e é válida, tem prioridade.
// A troca é atômica do ponto de vista do app: o novo arquivo é validado antes e só depois a conexão é trocada.
import * as SQLite from 'expo-sqlite';
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { Repo } from '@sensus/core';
import bundledDb from '../../assets/sensus.db';
import bundled from './bundled-db.json';
import { checkFullDatabase, editionOf, type Edition } from './edition';
import { createExpoSqlDriver } from './driver';

export const READER_DB_NAME = 'sensus.db';
export const FULL_DB_NAME = 'sensus-full.db';
/** Nome provisório usado enquanto o banco baixado é validado. */
export const STAGED_DB_NAME = 'sensus-full.db.new';

export interface ActiveDb {
  edition: Edition;
  name: string;
  meta: Readonly<Record<string, string>>;
  db: SQLite.SQLiteDatabase;
  repo: Repo;
}

type Listener = (active: ActiveDb) => void;

let current: ActiveDb | null = null;
const listeners = new Set<Listener>();

export function currentActive(): ActiveDb | null {
  return current;
}

export function subscribeActive(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Pasta do SQLite (a mesma que o expo-sqlite usa por padrão: <files>/SQLite). */
export function sqliteDirectory(): Directory {
  return new Directory(Paths.document, 'SQLite');
}

export function fullDbFile(name: string = FULL_DB_NAME): File {
  return new File(sqliteDirectory(), name);
}

/** Arquivos auxiliares do SQLite (WAL, memória compartilhada, diário) de um banco. */
function sidecarsOf(name: string): File[] {
  return ['-wal', '-shm', '-journal'].map((suffix) => fullDbFile(name + suffix));
}

export async function readMeta(db: SQLite.SQLiteDatabase): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM meta');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function openNamed(name: string): Promise<{ db: SQLite.SQLiteDatabase; meta: Record<string, string> }> {
  const db = await SQLite.openDatabaseAsync(name);
  try {
    return { db, meta: await readMeta(db) };
  } catch (e) {
    await db.closeAsync().catch(() => undefined);
    throw e;
  }
}

/** Abre o banco empacotado, copiando-o antes se a versão instalada não for a empacotada. */
async function openReader(): Promise<{ db: SQLite.SQLiteDatabase; meta: Record<string, string> }> {
  const installed = await installedBuiltAt();
  if (installed !== bundled.builtAt) {
    await SQLite.importDatabaseFromAssetAsync(READER_DB_NAME, { assetId: bundledDb, forceOverwrite: true });
  }
  return openNamed(READER_DB_NAME);
}

async function installedBuiltAt(): Promise<string | null> {
  let db: SQLite.SQLiteDatabase | null = null;
  try {
    db = await SQLite.openDatabaseAsync(READER_DB_NAME);
    const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = 'built_at'");
    return row?.value ?? null;
  } catch {
    return null;
  } finally {
    await db?.closeAsync().catch(() => undefined);
  }
}

function fullFileExists(): boolean {
  try {
    return fullDbFile().exists;
  } catch {
    return false;
  }
}

/** Abre o banco completo instalado, se existir e estiver válido. Null se for inválido (o arquivo é descartado). */
async function openInstalledFull(): Promise<{ db: SQLite.SQLiteDatabase; meta: Record<string, string> } | null> {
  if (!fullFileExists()) return null;
  try {
    const opened = await openNamed(FULL_DB_NAME);
    if (checkFullDatabase(opened.meta) === 'ok') return opened;
    await opened.db.closeAsync().catch(() => undefined);
  } catch {
    // arquivo ilegível: cai para o banco de leitura abaixo
  }
  return null;
}

function publish(next: { db: SQLite.SQLiteDatabase; meta: Record<string, string>; name: string }): ActiveDb {
  const active: ActiveDb = {
    edition: editionOf(next.meta),
    name: next.name,
    meta: next.meta,
    db: next.db,
    repo: new Repo(createExpoSqlDriver(next.db)),
  };
  const previous = current;
  current = active;
  // A conexão anterior fecha depois de um instante: consultas em voo ainda podem terminar nela.
  if (previous && previous.db !== next.db) {
    setTimeout(() => void previous.db.closeAsync().catch(() => undefined), 3000);
  }
  for (const listener of listeners) listener(active);
  return active;
}

/** Abre o banco que deve estar ativo: o completo instalado, se houver; senão o de leitura. */
export async function openActiveDatabase(): Promise<ActiveDb> {
  const full = await openInstalledFull();
  if (full) return publish({ ...full, name: FULL_DB_NAME });
  return publish({ ...(await openReader()), name: READER_DB_NAME });
}

/**
 * Troca para o completo recém-instalado (o arquivo já está em FULL_DB_NAME e foi validado pelo motivo).
 * Lança se não abrir como completo; nesse caso o banco de leitura continua ativo.
 */
export async function activateFullDatabase(): Promise<ActiveDb> {
  const opened = await openNamed(FULL_DB_NAME);
  if (checkFullDatabase(opened.meta) !== 'ok') {
    await opened.db.closeAsync().catch(() => undefined);
    throw new Error('banco completo não confere');
  }
  return publish({ ...opened, name: FULL_DB_NAME });
}

/** Valida um banco extraído (em STAGED_DB_NAME) sem torná-lo ativo. Lança se não for um banco completo válido. */
export async function probeStagedFullDatabase(): Promise<Record<string, string>> {
  const { db, meta } = await openNamed(STAGED_DB_NAME);
  await db.closeAsync().catch(() => undefined);
  const verdict = checkFullDatabase(meta);
  if (verdict !== 'ok') throw new StagedDatabaseError(verdict);
  return meta;
}

export class StagedDatabaseError extends Error {
  constructor(readonly verdict: 'corrupt' | 'schema' | 'edition') {
    super(`banco baixado: ${verdict}`);
    this.name = 'StagedDatabaseError';
  }
}

/** Remove o banco completo (e auxiliares) e volta para o de leitura. */
export async function removeFullDatabase(): Promise<ActiveDb> {
  if (current && current.name === FULL_DB_NAME) {
    await current.db.closeAsync().catch(() => undefined);
    current = null;
  }
  for (const f of [fullDbFile(), ...sidecarsOf(FULL_DB_NAME)]) {
    if (f.exists) f.delete();
  }
  return publish({ ...(await openReader()), name: READER_DB_NAME });
}

/** Apaga os arquivos auxiliares e o banco provisório, se houver. */
export function discardStagedDatabase(): void {
  for (const f of [fullDbFile(STAGED_DB_NAME), ...sidecarsOf(STAGED_DB_NAME)]) {
    if (f.exists) f.delete();
  }
}

/** Prepara o SQLite para receber um novo arquivo de banco completo: remove auxiliares antigos. */
export function clearSidecars(name: string = FULL_DB_NAME): void {
  for (const f of sidecarsOf(name)) {
    if (f.exists) f.delete();
  }
}

// Instalação de uma Bíblia baixada: download do ZIP para arquivo temporário, conferência (sha256 e tamanho),
// descompactação, validação da meta do banco e troca para SQLite/bible-<id>.db. Usa a mesma máquina de estados do
// banco completo (download-machine.ts) e os auxiliares do motor (download-engine.ts). IO; as regras estão em
// bible-model.ts.
import * as SQLite from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';
import type { BibleEntry, BiblePackage } from '@sensus/core';
import { hasSpace, spaceNeeded } from '../plan';
import { MAX_ATTEMPTS, type MachineEvent } from '../download-machine';
import { abortError, isAbortError, localFailure, sleep, StepFailure } from '../download-engine';
import { sameDigest } from '../sha256';
import { sha256OfFile } from '../file-sha256';
import { readMeta } from '../active-db';
import { sqliteDirectory } from '../sqlite-paths';
import { bibleFileName, bibleStagedFileName, checkBibleMeta } from './bible-model';
import { closeBible, deleteSqliteFile, openBible, removeBibleFile } from './bible-db';

const RETRY_DELAY_MS = 1500;
/** Repetições de uma queda de rede antes de desistir (o ZIP é pequeno: baixa de novo do zero). */
const NETWORK_RETRIES = 1;
const PROGRESS_EVERY_MS = 200;

export interface BibleInstallContext {
  signal: AbortSignal;
  dispatch: (e: MachineEvent) => void;
}

/** Pasta temporária da Bíblia (ZIP e banco extraído). Apagada ao terminar, com sucesso ou não. */
function stagingDir(id: string): Directory {
  return new Directory(Paths.cache, 'sensus-bibles', id);
}

function deleteFile(f: File): void {
  try {
    if (f.exists) f.delete();
  } catch {
    // já removido
  }
}

/**
 * Instala uma Bíblia do catálogo. O último evento é 'installed' (sucesso), 'pause' (cancelado pelo usuário) ou
 * 'fail' (motivo). Nunca lança: o chamador só acompanha os eventos.
 */
export async function installBible(entry: BibleEntry, ctx: BibleInstallContext): Promise<void> {
  const { dispatch, signal } = ctx;
  const pkg = entry.package;
  const zip = new File(stagingDir(entry.id), `${entry.id}.zip`);
  try {
    if (!pkg) throw new StepFailure('unsupported');
    if (!hasSpace(Paths.availableDiskSpace, spaceNeeded(pkg.size, pkg.uncompressed_size))) throw new StepFailure('space');
    dispatch({ type: 'manifest' });
    await downloadVerified(zip, pkg, ctx);
    dispatch({ type: 'verified' });
    const staged = await extract(entry, pkg, zip);
    dispatch({ type: 'extracted' });
    await swap(entry.id, staged);
    dispatch({ type: 'installed' });
  } catch (e) {
    if (isAbortError(e) || signal.aborted) dispatch({ type: 'pause', reason: 'user' });
    else if (e instanceof StepFailure) dispatch({ type: 'fail', error: e.code });
    else dispatch({ type: 'fail', error: 'install' });
  } finally {
    cleanup(entry.id);
  }
}

/** Baixa e confere; refaz o download uma vez se o sha256 ou o tamanho não baterem. */
async function downloadVerified(zip: File, pkg: BiblePackage, ctx: BibleInstallContext): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    await download(zip, pkg, ctx);
    ctx.dispatch({ type: 'downloaded' });
    if (zip.exists && zip.size === pkg.size && sameDigest(await sha256OfFile(zip), pkg.sha256)) return;
    deleteFile(zip);
    if (attempt >= MAX_ATTEMPTS) throw new StepFailure('checksum');
    ctx.dispatch({ type: 'mismatch' });
  }
}

/** Baixa o ZIP inteiro para `dest`, com repetições em caso de queda de rede. */
async function download(dest: File, pkg: BiblePackage, ctx: BibleInstallContext): Promise<void> {
  deleteFile(dest);
  dest.parentDirectory.create({ intermediates: true, idempotent: true });
  for (let tries = 0; ; tries++) {
    let last = 0;
    const task = File.createDownloadTask(pkg.url, dest, {
      signal: ctx.signal,
      onProgress: ({ bytesWritten, totalBytes }) => {
        const now = Date.now();
        if (now - last < PROGRESS_EVERY_MS) return;
        last = now;
        ctx.dispatch({ type: 'bytes', bytes: bytesWritten, total: totalBytes > 0 ? totalBytes : pkg.size });
      },
    });
    try {
      const file = await task.downloadAsync();
      if (!file) throw new Error('download sem arquivo');
      return;
    } catch (e) {
      if (ctx.signal.aborted || isAbortError(e)) throw abortError();
      if (tries >= NETWORK_RETRIES) throw new StepFailure('network');
      deleteFile(dest);
      await sleep(RETRY_DELAY_MS, ctx.signal);
    }
  }
}

/** Descompacta o ZIP (uma entrada: o .db), confere o tamanho e valida a meta. Devolve o arquivo provisório no SQLite. */
async function extract(entry: BibleEntry, pkg: BiblePackage, zip: File): Promise<File> {
  const dir = stagingDir(entry.id);
  if (dir.exists) dir.delete();
  dir.create({ intermediates: true, idempotent: true });

  // Carregado sob demanda, como no download do banco completo (módulo nativo).
  const { unzip } = await import('react-native-zip-archive');
  try {
    await unzip(zip.uri, dir.uri);
  } catch {
    throw new StepFailure('corrupt');
  }

  const dbs = dir.list().filter((e): e is File => e instanceof File && e.name.endsWith('.db'));
  const extracted = dbs.length === 1 ? dbs[0] : undefined;
  if (!extracted || extracted.size !== pkg.uncompressed_size) throw new StepFailure('corrupt');

  const stagedName = bibleStagedFileName(entry.id);
  deleteSqliteFile(stagedName);
  const staged = new File(sqliteDirectory(), stagedName);
  try {
    await extracted.move(staged);
  } catch (e) {
    throw localFailure(e);
  }

  const verdict = checkBibleMeta(await readStagedMeta(stagedName), { id: entry.id, version: entry.version });
  if (verdict !== 'ok') {
    deleteSqliteFile(stagedName);
    throw new StepFailure(verdict === 'schema' ? 'schema' : 'corrupt');
  }
  return staged;
}

async function readStagedMeta(name: string): Promise<Record<string, string>> {
  let db: SQLite.SQLiteDatabase | null = null;
  try {
    db = await SQLite.openDatabaseAsync(name);
    return await readMeta(db);
  } catch {
    return {};
  } finally {
    await db?.closeAsync().catch(() => undefined);
  }
}

/**
 * Troca o banco provisório pelo definitivo. A conexão antiga (se houver) fecha antes; o rename substitui o arquivo de
 * uma vez. Se a reabertura falhar, a Bíblia é removida (a lista não mostra uma instalação quebrada).
 */
async function swap(id: string, staged: File): Promise<void> {
  const name = bibleFileName(id);
  await closeBible(id);
  deleteSqliteFile(name, false);
  try {
    await staged.move(new File(sqliteDirectory(), name), { overwrite: true });
  } catch (e) {
    deleteSqliteFile(bibleStagedFileName(id));
    throw localFailure(e);
  }
  try {
    await openBible(id);
  } catch {
    await removeBibleFile(id);
    throw new StepFailure('install');
  }
}

function cleanup(id: string): void {
  try {
    const dir = stagingDir(id);
    if (dir.exists) dir.delete();
  } catch {
    // pasta temporária: não impede nada
  }
  deleteSqliteFile(bibleStagedFileName(id));
}

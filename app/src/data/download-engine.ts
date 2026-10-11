// Motor do download e instalação do banco completo. IO: rede, arquivos e SQLite. As regras estão em
// download-machine.ts (fases) e plan.ts (faixas, espaço); este módulo só executa e reporta eventos.
//
// Fluxo: manifesto → checagens (versão do app, esquema, espaço) → ZIP em faixas Range para o parcial
// (retomável: o parcial sobrevive a fechar o app) → conferência (md5 nativo; sha256 em blocos só se faltar) → descompactar (react-native-zip-archive)
// → validar o banco extraído → trocar em SQLite/sensus-full.db → reabrir. Em qualquer falha antes da troca,
// o banco de leitura continua ativo e só o parcial fica (se for queda de rede ou cancelamento).
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { appMeetsMinimum, parseManifest, type DataManifest } from './manifest';
import { SUPPORTED_SCHEMA_VERSION } from './edition';
import { chunkRanges, hasSpace, rangeHeader, spaceNeeded, type ByteRange } from './plan';
import { MAX_ATTEMPTS, type DataError, type MachineEvent } from './download-machine';
import { createSha256Stream, sameDigest } from './sha256';
import { activateFullDatabase, clearSidecars, discardStagedDatabase, fullDbFile, probeStagedFullDatabase, removeFullDatabase, STAGED_DB_NAME, FULL_DB_NAME, StagedDatabaseError } from './active-db';
import { readDataState, writeDataState } from './data-state';

const MANIFEST_TIMEOUT_MS = 15_000;
/** Esperas entre tentativas de uma faixa (3 tentativas no total) antes de pausar por rede. */
const RETRY_DELAYS_MS = [1500, 4000];
const PARTIAL_NAME = 'sensus-full.zip.part';
const HASH_BLOCK = 1024 * 1024;
const PROGRESS_EVERY_MS = 200;

export interface EngineContext {
  signal: AbortSignal;
  dispatch: (e: MachineEvent) => void;
}

/** Falha com motivo de erro da máquina (ex.: 'space', 'schema'). */
export class StepFailure extends Error {
  constructor(readonly code: DataError) {
    super(`falha: ${code}`);
    this.name = 'StepFailure';
  }
}

/** Queda de rede depois das repetições: o parcial fica para retomar. */
export class NetworkFailure extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : 'rede');
    this.name = 'NetworkFailure';
  }
}

export function isAbortError(e: unknown): boolean {
  return (e instanceof Error && e.name === 'AbortError') || (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'AbortError');
}

// ---- diretórios e arquivos -------------------------------------------------------------------------

function downloadDir(): Directory {
  const d = new Directory(Paths.document, 'sensus-data', 'download');
  if (!d.exists) d.create({ intermediates: true });
  return d;
}

function installDir(): Directory {
  return new Directory(Paths.document, 'sensus-data', 'install');
}

function partialFile(): File {
  return new File(downloadDir(), PARTIAL_NAME);
}

export function partialSize(): number {
  const f = partialFile();
  return f.exists ? f.size : 0;
}

/** Remove o parcial e as faixas temporárias (download de outra versão, sha256 divergente, ou ao remover). */
export function discardPartial(): void {
  const f = partialFile();
  if (f.exists) f.delete();
  const d = downloadDir();
  for (const entry of d.list()) {
    if (entry instanceof File && entry.exists) entry.delete();
  }
}

function appendPartial(bytes: Uint8Array): void {
  const f = partialFile();
  if (!f.exists) f.create({ intermediates: true });
  const h = f.open(FileMode.Append);
  try {
    h.writeBytes(bytes);
  } finally {
    h.close();
  }
}

function replacePartial(bytes: Uint8Array): void {
  const f = partialFile();
  if (f.exists) f.delete();
  f.create({ intermediates: true });
  const h = f.open(FileMode.Append);
  try {
    h.writeBytes(bytes);
  } finally {
    h.close();
  }
}

/** md5 nativo do arquivo (expo-file-system), ou null se a plataforma não o fornecer. */
function nativeMd5(file: File): string | null {
  try {
    const v = file.md5;
    return typeof v === 'string' && /^[0-9a-f]{32}$/i.test(v) ? v.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * O parcial confere com o manifesto? Usa o md5 nativo quando o manifesto o traz e a plataforma o fornece
 * (rápido: o hash é feito em código nativo). Sem md5, ou sem md5 nativo, cai no sha256 em JavaScript.
 */
async function partialMatches(m: DataManifest): Promise<boolean> {
  if (m.full.md5) {
    const native = nativeMd5(partialFile());
    if (native !== null) return native === m.full.md5;
  }
  return sameDigest(await hashPartial(), m.full.sha256);
}

/** sha256 do parcial em blocos, cedendo a thread entre eles (a UI segue responsiva). */
async function hashPartial(): Promise<string> {
  const f = partialFile();
  const h = f.open(FileMode.ReadOnly);
  try {
    h.offset = 0;
    const stream = createSha256Stream();
    for (;;) {
      const block = h.readBytes(HASH_BLOCK);
      if (block.byteLength === 0) break;
      stream.update(block);
      await new Promise<void>((r) => setTimeout(r, 0));
    }
    return stream.hexDigest();
  } finally {
    h.close();
  }
}

// ---- manifesto ---------------------------------------------------------------------------------------

/** Busca e valida o manifesto. Qualquer falha (rede, HTTP, JSON inválido) vira ManifestError. */
export async function fetchManifest(url: string, signal?: AbortSignal): Promise<DataManifest> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), MANIFEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseManifest(await res.json());
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

// ---- download em faixas ------------------------------------------------------------------------------

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function abortError(): Error {
  const e = new Error('cancelado');
  e.name = 'AbortError';
  return e;
}

/** Uma faixa: baixa para um arquivo temporário e acrescenta ao parcial. 'full' = o servidor ignorou Range. */
async function fetchRangeOnce(url: string, range: ByteRange, total: number, ctx: EngineContext): Promise<'appended' | 'full'> {
  const tmp = new File(downloadDir(), `faixa-${range.start}.bin`);
  if (tmp.exists) tmp.delete();
  let last = 0;
  const task = File.createDownloadTask(url, tmp, {
    headers: { Range: rangeHeader(range) },
    signal: ctx.signal,
    onProgress: ({ bytesWritten }) => {
      const now = Date.now();
      if (now - last < PROGRESS_EVERY_MS) return;
      last = now;
      ctx.dispatch({ type: 'bytes', bytes: range.start + bytesWritten, total });
    },
  });
  const file = await task.downloadAsync();
  if (!file) throw new Error('download sem arquivo');
  const body = await tmp.bytes();
  const expected = range.end - range.start + 1;
  // Servidor sem suporte a Range: veio o arquivo inteiro. Usa-o e refaz o parcial a partir do zero.
  const whole = body.byteLength === total && expected !== total;
  // Tamanho inesperado é problema da resposta (repete a faixa), não do armazenamento local.
  if (!whole && body.byteLength !== expected) throw new Error(`faixa com ${body.byteLength} bytes, esperado ${expected}`);
  try {
    if (whole) replacePartial(body);
    else appendPartial(body);
  } catch (e) {
    throw localFailure(e);
  } finally {
    if (tmp.exists) tmp.delete();
  }
  return whole ? 'full' : 'appended';
}

/** Erro de escrita local: sem espaço vira 'space'; outros, 'install'. */
function localFailure(e: unknown): StepFailure {
  const msg = e instanceof Error ? e.message.toLowerCase() : '';
  return new StepFailure(msg.includes('space') || msg.includes('enospc') ? 'space' : 'install');
}

async function fetchRangeWithRetry(url: string, range: ByteRange, total: number, ctx: EngineContext): Promise<'appended' | 'full'> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchRangeOnce(url, range, total, ctx);
    } catch (e) {
      if (ctx.signal.aborted || isAbortError(e)) throw abortError();
      if (e instanceof StepFailure) throw e;
      if (attempt >= RETRY_DELAYS_MS.length) throw new NetworkFailure(e);
      await sleep(RETRY_DELAYS_MS[attempt]!, ctx.signal);
    }
  }
}

/** Baixa o que falta do ZIP, a partir do tamanho do parcial. */
async function fetchRemaining(m: DataManifest, ctx: EngineContext): Promise<void> {
  const total = m.full.size;
  ctx.dispatch({ type: 'bytes', bytes: partialSize(), total });
  for (const range of chunkRanges(partialSize(), total)) {
    const result = await fetchRangeWithRetry(m.full.url, range, total, ctx);
    if (result === 'full') break;
    ctx.dispatch({ type: 'bytes', bytes: range.end + 1, total });
  }
  if (partialSize() !== total) throw new StepFailure('corrupt');
}

// ---- passos do pipeline -------------------------------------------------------------------------------

/** Baixa (retomando se houver parcial da mesma versão) e confere o sha256; repete uma vez se não bater. */
async function downloadAndVerify(m: DataManifest, ctx: EngineContext): Promise<void> {
  const state = readDataState();
  const same = state.plan && state.plan.url === m.full.url && state.plan.sha256 === m.full.sha256 && state.plan.size === m.full.size;
  if (!same) discardPartial();
  writeDataState({
    ...state,
    plan: { url: m.full.url, sha256: m.full.sha256, size: m.full.size, uncompressedSize: m.full.uncompressed_size, dataVersion: m.data_version },
  });

  const remaining = m.full.size - partialSize();
  if (!hasSpace(Paths.availableDiskSpace, spaceNeeded(remaining, m.full.uncompressed_size))) throw new StepFailure('space');

  ctx.dispatch({ type: 'manifest' });
  for (let attempt = 1; ; attempt++) {
    await fetchRemaining(m, ctx);
    ctx.dispatch({ type: 'downloaded' });
    if (await partialMatches(m)) return;
    discardPartial();
    if (attempt >= MAX_ATTEMPTS) throw new StepFailure('checksum');
    ctx.dispatch({ type: 'mismatch' });
  }
}

/**
 * Descompacta o ZIP (entrada única sensus.db), move o banco para o nome provisório e o valida.
 * Devolve a meta do banco validado (usada no registro da instalação).
 */
async function extractAndStage(m: DataManifest): Promise<Record<string, string>> {
  const dir = installDir();
  if (dir.exists) dir.delete();
  dir.create({ intermediates: true });

  // Carregado sob demanda: o módulo nativo só existe em builds nativos (não na web).
  const { unzip } = await import('react-native-zip-archive');
  try {
    await unzip(partialFile().uri, dir.uri);
  } catch {
    throw new StepFailure('corrupt');
  }

  const extracted = new File(dir, 'sensus.db');
  if (!extracted.exists || extracted.size !== m.full.uncompressed_size) throw new StepFailure('corrupt');

  discardStagedDatabase();
  try {
    await extracted.move(fullDbFile(STAGED_DB_NAME));
  } catch (e) {
    throw localFailure(e);
  }
  try {
    return await probeStagedFullDatabase();
  } catch (e) {
    if (e instanceof StagedDatabaseError && e.verdict === 'schema') throw new StepFailure('schema');
    throw new StepFailure('corrupt');
  }
}

/**
 * Troca o arquivo validado em SQLite/sensus-full.db, grava o registro da instalação e reabre o banco completo.
 * Se a reabertura falhar, o registro e o arquivo são desfeitos e o banco de leitura continua ativo.
 */
async function swapIn(m: DataManifest, meta: Record<string, string>): Promise<void> {
  const state = readDataState();
  clearSidecars(FULL_DB_NAME);
  try {
    await fullDbFile(STAGED_DB_NAME).move(fullDbFile(FULL_DB_NAME), { overwrite: true });
  } catch (e) {
    discardStagedDatabase();
    throw localFailure(e);
  }
  clearSidecars(STAGED_DB_NAME);
  writeDataState({
    install: {
      dataVersion: m.data_version,
      sha256: m.full.sha256,
      size: m.full.size,
      installedAt: new Date().toISOString(),
      builtAt: meta.built_at ?? null,
    },
    plan: null,
    deferredVersion: state.deferredVersion,
  });
  try {
    await activateFullDatabase();
  } catch {
    writeDataState({ ...state, install: null, plan: null });
    await removeFullDatabase().catch(() => undefined);
    throw new StepFailure('install');
  }
}

function cleanup(): void {
  const dir = installDir();
  try {
    if (dir.exists) dir.delete();
  } catch {
    // resto de pasta temporária: não impede a instalação
  }
  const f = partialFile();
  try {
    if (f.exists) f.delete();
  } catch {
    // idem
  }
}

/**
 * Executa o download e a instalação. Os eventos da máquina são enviados por ctx.dispatch; ao terminar, o
 * último evento é 'installed' (sucesso), 'pause' (cancelado ou sem rede) ou 'fail' (erro).
 */
export async function runInstall(opts: { manifestUrl: string; appVersion: string } & EngineContext): Promise<void> {
  const { dispatch, signal } = opts;
  try {
    const manifest = await fetchManifest(opts.manifestUrl, signal).catch((e: unknown) => {
      if (isAbortError(e) || signal.aborted) throw abortError();
      throw new StepFailure('manifest');
    });
    if (!appMeetsMinimum(opts.appVersion, manifest.min_app_version)) throw new StepFailure('app-too-old');
    if (manifest.schema_version !== SUPPORTED_SCHEMA_VERSION) throw new StepFailure('schema');

    await downloadAndVerify(manifest, { signal, dispatch });
    dispatch({ type: 'verified' });
    const meta = await extractAndStage(manifest);
    dispatch({ type: 'extracted' });
    await swapIn(manifest, meta);
    cleanup();
    dispatch({ type: 'installed' });
  } catch (e) {
    if (isAbortError(e) || signal.aborted) {
      dispatch({ type: 'pause', reason: 'user' });
    } else if (e instanceof NetworkFailure) {
      dispatch({ type: 'pause', reason: 'network' });
    } else if (e instanceof StepFailure) {
      dispatch({ type: 'fail', error: e.code });
    } else {
      dispatch({ type: 'fail', error: 'install' });
    }
  }
}

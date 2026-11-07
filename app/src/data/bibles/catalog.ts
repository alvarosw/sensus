// Catálogo das Bíblias baixáveis (bibles-manifest.json, na raiz do repositório): busca na rede e cache local do último
// catálogo válido. A validação é do núcleo (parseBibleCatalog); aqui só IO.
import { File, Paths } from 'expo-file-system';
import { parseBibleCatalog, type BibleCatalog } from '@sensus/core';

export const DEFAULT_BIBLE_CATALOG_URL = 'https://raw.githubusercontent.com/alvarosw/sensus/main/bibles-manifest.json';

const CACHE_NAME = 'sensus-bibles-catalog.json';
const TIMEOUT_MS = 15_000;

function cacheFile(): File {
  return new File(Paths.document, CACHE_NAME);
}

/** Último catálogo válido gravado no aparelho; null sem arquivo ou se o arquivo não passa na validação. */
export function readCachedCatalog(): BibleCatalog | null {
  try {
    const f = cacheFile();
    if (!f.exists) return null;
    return parseBibleCatalog(JSON.parse(f.textSync()));
  } catch {
    return null;
  }
}

function writeCachedCatalog(body: string): void {
  try {
    const f = cacheFile();
    if (!f.exists) f.create();
    f.write(body);
  } catch {
    // sem escrita: a lista vale até fechar o app
  }
}

/** Busca o catálogo e grava o cache só depois de validá-lo. Lança se a rede, o HTTP ou a validação falharem. */
export async function fetchBibleCatalog(url: string): Promise<BibleCatalog> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.text();
    const catalog = parseBibleCatalog(JSON.parse(body));
    writeCachedCatalog(body);
    return catalog;
  } finally {
    clearTimeout(timer);
  }
}

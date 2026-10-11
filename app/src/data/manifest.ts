// Manifesto dos dados de estudo e comparações de versão. Puro: sem rede nem React Native (testável no Node).
// Contrato com o pipeline (data-manifest.json na raiz do repositório):
//   { data_version, schema_version, full: { url, sha256, size, uncompressed_size }, min_app_version }
// `full.url` aponta para um ZIP com uma única entrada, 'sensus.db'. sha256 e size são do ZIP.

export const DEFAULT_MANIFEST_URL = 'https://raw.githubusercontent.com/alvarosw/sensus/main/data-manifest.json';

export interface FullDataEntry {
  url: string;
  /** Hash do ZIP para conferência no aparelho (nativo, rápido). Opcional; sem ele, a conferência usa sha256. */
  md5?: string;
  /** SHA-256 do ZIP (obrigatório; para pessoas e outras ferramentas). */
  sha256: string;
  /** Tamanho do ZIP em bytes. */
  size: number;
  /** Tamanho do sensus.db descompactado, em bytes. */
  uncompressed_size: number;
}

export interface DataManifest {
  data_version: string;
  schema_version: number;
  full: FullDataEntry;
  min_app_version: string;
}

export class ManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManifestError';
  }
}

const SHA256_HEX = /^[0-9a-f]{64}$/i;
const MD5_HEX = /^[0-9a-f]{32}$/i;
const DOTTED_VERSION = /^\d+(\.\d+)*$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function positiveInt(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v <= 0) {
    throw new ManifestError(`${field} deve ser um inteiro positivo`);
  }
  return v;
}

/** Valida o JSON do manifesto. Lança ManifestError com a causa; não aceita campos ausentes ou de tipo errado. */
export function parseManifest(input: unknown): DataManifest {
  if (!isRecord(input)) throw new ManifestError('manifesto não é um objeto');
  const { data_version, schema_version, full, min_app_version } = input;
  if (typeof data_version !== 'string' || data_version.trim() === '') {
    throw new ManifestError('data_version ausente');
  }
  const schema = positiveInt(schema_version, 'schema_version');
  if (typeof min_app_version !== 'string' || !DOTTED_VERSION.test(min_app_version)) {
    throw new ManifestError('min_app_version inválido');
  }
  if (!isRecord(full)) throw new ManifestError('full ausente');
  if (typeof full.url !== 'string' || !/^https?:\/\//.test(full.url)) {
    throw new ManifestError('full.url inválida');
  }
  if (typeof full.sha256 !== 'string' || !SHA256_HEX.test(full.sha256)) {
    throw new ManifestError('full.sha256 inválido');
  }
  if (full.md5 !== undefined && (typeof full.md5 !== 'string' || !MD5_HEX.test(full.md5))) {
    throw new ManifestError('full.md5 inválido');
  }
  return {
    data_version: data_version.trim(),
    schema_version: schema,
    min_app_version,
    full: {
      url: full.url,
      ...(typeof full.md5 === 'string' ? { md5: full.md5.toLowerCase() } : {}),
      sha256: full.sha256.toLowerCase(),
      size: positiveInt(full.size, 'full.size'),
      uncompressed_size: positiveInt(full.uncompressed_size, 'full.uncompressed_size'),
    },
  };
}

/**
 * Compara versões de dados. Versões pontuadas ou com datas ("2026.10.11", "2026.10.11-2",
 * "2026-10-11T05:59:35") são comparadas pelos números, em ordem. Sem números, compara o texto.
 * Retorna -1, 0 ou 1.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const na = a.match(/\d+/g)?.map(Number) ?? [];
  const nb = b.match(/\d+/g)?.map(Number) ?? [];
  if (na.length === 0 || nb.length === 0) return a < b ? -1 : a > b ? 1 : 0;
  const n = Math.max(na.length, nb.length);
  for (let i = 0; i < n; i++) {
    const x = na[i] ?? 0;
    const y = nb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/** O app atende ao mínimo exigido pelo manifesto (versão pontuada). */
export function appMeetsMinimum(appVersion: string, minAppVersion: string): boolean {
  return compareVersions(appVersion, minAppVersion) >= 0;
}

/** Situação da atualização: 'none' (sem dados completos ou sem manifesto), 'available' (instalado é mais antigo),
 *  'current' (igual ou mais novo), 'unknown' (instalado sem versão conhecida). */
export type UpdateState = 'none' | 'available' | 'current' | 'unknown';

export function updateState(installedVersion: string | null, fullInstalled: boolean, manifest: DataManifest | null): UpdateState {
  if (!manifest) return 'none';
  if (!fullInstalled) return 'available';
  if (installedVersion === null) return 'unknown';
  return compareVersions(installedVersion, manifest.data_version) < 0 ? 'available' : 'current';
}

// Regras de planejamento do download: faixas de Range, espaço necessário e quando oferecer os dados. Puro.
import { updateState, type DataManifest } from './manifest';
import type { Edition } from './edition';

/** Tamanho de cada requisição Range. Pequeno o bastante para não pesar na memória; cada faixa vai ao disco. */
export const CHUNK_BYTES = 4 * 1024 * 1024;

/** Folga de espaço livre além do ZIP e do banco descompactado. */
export const SPACE_MARGIN_BYTES = 64 * 1024 * 1024;

export interface ByteRange {
  /** Primeiro byte (inclusive). */
  start: number;
  /** Último byte (inclusive), como no cabeçalho Range. */
  end: number;
}

/** Faixas que cobrem [from, total). Vazio se não falta nada. */
export function chunkRanges(from: number, total: number, chunk: number = CHUNK_BYTES): ByteRange[] {
  const out: ByteRange[] = [];
  for (let start = Math.max(0, from); start < total; start += chunk) {
    out.push({ start, end: Math.min(total, start + chunk) - 1 });
  }
  return out;
}

export function rangeHeader(r: ByteRange): string {
  return `bytes=${r.start}-${r.end}`;
}

/** Espaço livre exigido para baixar o que falta do ZIP e descompactar o banco. */
export function spaceNeeded(remainingZipBytes: number, uncompressedBytes: number): number {
  return Math.max(0, remainingZipBytes) + uncompressedBytes + SPACE_MARGIN_BYTES;
}

export function hasSpace(freeBytes: number, neededBytes: number): boolean {
  return freeBytes >= neededBytes;
}

/**
 * Oferecer os dados na abertura (tela de primeira vez)? Sim quando a edição ativa não é completa e o manifesto
 * existe, ou quando o instalado é mais antigo; sem versão conhecida não incomoda. "Depois" grava a versão
 * (deferredVersion) e a oferta só volta quando sair uma versão nova.
 */
export function shouldPromptFirstRun(input: {
  activeEdition: Edition;
  installedVersion: string | null;
  manifest: DataManifest | null;
  deferredVersion: string | null;
}): boolean {
  const { manifest } = input;
  if (!manifest) return false;
  if (input.deferredVersion === manifest.data_version) return false;
  const state = updateState(input.installedVersion, input.activeEdition === 'full', manifest);
  return state === 'available';
}

/** Bytes em MB (base 10, como o Android mostra), com vírgula decimal: "24,5 MB", "72,4 MB", "150 MB". */
export function formatMB(bytes: number): string {
  const mb = bytes / 1_000_000;
  const text = mb >= 100 ? String(Math.round(mb)) : String(Math.round(mb * 10) / 10);
  return `${text.replace('.', ',')} MB`;
}

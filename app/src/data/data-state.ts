// Estado persistido dos dados de estudo (JSON no diretório de documentos, sem segredos):
//  - install: versão e sha256 do banco completo instalado;
//  - plan: o download em andamento (URL, sha256, tamanho), para retomar o parcial depois de reabrir o app;
//  - deferredVersion: versão que o usuário dispensou com "Depois" (a oferta não volta para ela).
import { File, Paths } from 'expo-file-system';

export interface InstallRecord {
  dataVersion: string;
  sha256: string;
  size: number;
  installedAt: string;
  builtAt: string | null;
}

export interface DownloadPlan {
  url: string;
  sha256: string;
  size: number;
  uncompressedSize: number;
  dataVersion: string;
}

export interface StoredDataState {
  install: InstallRecord | null;
  plan: DownloadPlan | null;
  deferredVersion: string | null;
}

const EMPTY: StoredDataState = { install: null, plan: null, deferredVersion: null };
const FILE_NAME = 'sensus-data-state.json';

function stateFile(): File {
  return new File(Paths.document, FILE_NAME);
}

export function readDataState(): StoredDataState {
  try {
    const file = stateFile();
    if (!file.exists) return { ...EMPTY };
    const parsed: unknown = JSON.parse(file.textSync());
    if (typeof parsed !== 'object' || parsed === null) return { ...EMPTY };
    const p = parsed as Partial<StoredDataState>;
    return {
      install: isInstall(p.install) ? p.install : null,
      plan: isPlan(p.plan) ? p.plan : null,
      deferredVersion: typeof p.deferredVersion === 'string' ? p.deferredVersion : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function writeDataState(state: StoredDataState): void {
  try {
    const file = stateFile();
    if (!file.exists) file.create();
    file.write(JSON.stringify(state));
  } catch {
    // sem escrita (armazenamento cheio ou indisponível): o estado vale até fechar o app
  }
}

function isInstall(v: unknown): v is InstallRecord {
  const o = v as InstallRecord | null;
  return !!o && typeof o === 'object' && typeof o.dataVersion === 'string' && typeof o.sha256 === 'string' && typeof o.size === 'number';
}

function isPlan(v: unknown): v is DownloadPlan {
  const o = v as DownloadPlan | null;
  return (
    !!o &&
    typeof o === 'object' &&
    typeof o.url === 'string' &&
    typeof o.sha256 === 'string' &&
    typeof o.size === 'number' &&
    typeof o.uncompressedSize === 'number' &&
    typeof o.dataVersion === 'string'
  );
}

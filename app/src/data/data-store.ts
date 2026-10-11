// Estado dos dados de estudo para a interface: edição ativa, instalado, manifesto e a máquina do download.
// As ações (iniciar, cancelar, remover, "Depois") ficam aqui; o IO fica em download-engine.ts e active-db.ts.
import { create } from 'zustand';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { File } from 'expo-file-system';
import { canStart, IDLE_STATE, isActive, reduce, type MachineEvent, type MachineState } from './download-machine';
import { DEFAULT_MANIFEST_URL, updateState, type DataManifest, type UpdateState } from './manifest';
import { currentActive, FULL_DB_NAME, removeFullDatabase, sqliteDirectory, subscribeActive, type ActiveDb } from './active-db';
import type { Edition } from './edition';
import { discardPartial, fetchManifest, partialSize, runInstall } from './download-engine';
import { readDataState, writeDataState } from './data-state';

export interface InstalledInfo {
  /** true quando o banco completo veio do download (pode ser removido); false se está empacotado (dev). */
  downloaded: boolean;
  dataVersion: string | null;
  builtAt: string | null;
  installedAt: string | null;
  sizeBytes: number;
}

interface DataStoreState {
  machine: MachineState;
  /** Edição do banco ativo; null até o banco abrir. */
  edition: Edition | null;
  /** Banco completo instalado (null com o banco de leitura). */
  installed: InstalledInfo | null;
  manifest: DataManifest | null;
  checking: boolean;
  manifestError: boolean;
  deferredVersion: string | null;
  load(): void;
  refreshManifest(): Promise<DataManifest | null>;
  start(): void;
  cancel(): void;
  remove(): Promise<void>;
  /** Descarta o download parcial (o banco instalado, se houver, fica). */
  discardDownload(): void;
  /** "Depois": não oferecer de novo esta versão. */
  deferOffer(): void;
}

function manifestUrl(): string {
  const extra = Constants.expoConfig?.extra as { dataManifestUrl?: unknown } | undefined;
  return typeof extra?.dataManifestUrl === 'string' && extra.dataManifestUrl ? extra.dataManifestUrl : DEFAULT_MANIFEST_URL;
}

function appVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

function installedFrom(active: ActiveDb): InstalledInfo | null {
  if (active.edition !== 'full') return null;
  const state = readDataState();
  let sizeBytes = 0;
  try {
    sizeBytes = new File(sqliteDirectory(), active.name).size;
  } catch {
    // tamanho indisponível: a tela mostra sem o número
  }
  return {
    downloaded: active.name === FULL_DB_NAME,
    dataVersion: state.install?.dataVersion ?? active.meta.data_version ?? null,
    builtAt: active.meta.built_at ?? state.install?.builtAt ?? null,
    installedAt: state.install?.installedAt ?? null,
    sizeBytes,
  };
}

let controller: AbortController | null = null;
let loaded = false;

export const useDataStore = create<DataStoreState>()((set, get) => {
  const dispatch = (e: MachineEvent) => set((s) => ({ machine: reduce(s.machine, e) }));

  const sync = (active: ActiveDb) => set({ edition: active.edition, installed: installedFrom(active) });
  subscribeActive(sync);

  return {
    machine: IDLE_STATE,
    edition: null,
    installed: null,
    manifest: null,
    checking: false,
    manifestError: false,
    deferredVersion: null,

    load: () => {
      if (loaded || Platform.OS === 'web') return;
      loaded = true;
      const active = currentActive();
      if (active) sync(active);
      const state = readDataState();
      set({ deferredVersion: state.deferredVersion });
      // Parcial sem plano (ou plano sem parcial) não serve para nada: limpa.
      const bytes = partialSize();
      if (state.plan && bytes > 0) {
        dispatch({ type: 'interrupted', bytes, total: state.plan.size });
      } else if (!state.plan && bytes > 0) {
        discardPartial();
      }
    },

    refreshManifest: async () => {
      if (Platform.OS === 'web') return null;
      set({ checking: true });
      try {
        const manifest = await fetchManifest(manifestUrl());
        set({ manifest, manifestError: false });
        return manifest;
      } catch {
        set({ manifestError: true });
        return null;
      } finally {
        set({ checking: false });
      }
    },

    start: () => {
      if (!canStart(get().machine.phase)) return;
      dispatch({ type: 'start' });
      if (Platform.OS === 'web') {
        dispatch({ type: 'fail', error: 'unsupported' });
        return;
      }
      const ctl = new AbortController();
      controller = ctl;
      void runInstall({ manifestUrl: manifestUrl(), appVersion: appVersion(), signal: ctl.signal, dispatch }).finally(() => {
        if (controller === ctl) controller = null;
        // Garantia: nenhuma saída deixa a máquina presa numa fase ativa.
        if (isActive(get().machine.phase)) dispatch({ type: 'fail', error: 'install' });
      });
    },

    cancel: () => {
      controller?.abort();
    },

    remove: async () => {
      if (isActive(get().machine.phase)) return;
      if (get().installed?.downloaded) await removeFullDatabase();
      discardPartial();
      const state = readDataState();
      writeDataState({ ...state, install: null, plan: null });
      set({ machine: { ...IDLE_STATE } });
    },

    discardDownload: () => {
      if (isActive(get().machine.phase)) return;
      discardPartial();
      writeDataState({ ...readDataState(), plan: null });
      set({ machine: { ...IDLE_STATE } });
    },

    deferOffer: () => {
      const version = get().manifest?.data_version;
      if (!version) return;
      const state = readDataState();
      writeDataState({ ...state, deferredVersion: version });
      set({ deferredVersion: version });
    },
  };
});

/** Situação da atualização para a interface (ver manifest.ts). */
export function useUpdateState(): UpdateState {
  return useDataStore((s) => updateState(s.installed?.dataVersion ?? null, s.edition === 'full', s.manifest));
}


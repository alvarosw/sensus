// Estado das Bíblias para a interface: catálogo (cache e rede), instaladas e a máquina de cada instalação. As ações
// de IO ficam em install.ts, catalog.ts e bible-db.ts; a preferência do texto padrão fica em settings/app-prefs.ts.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { findBible, textSources, type BibleCatalog } from '@sensus/core';
import { canStart, IDLE_STATE, isActive, reduce, type MachineEvent, type MachineState } from '../download-machine';
import { DEFAULT_BIBLE_CATALOG_URL, fetchBibleCatalog, readCachedCatalog } from './catalog';
import { installedBibleVersion, installedIds, removeBibleFile } from './bible-db';
import { installBible } from './install';
import { create } from 'zustand';

interface BiblesState {
  loaded: boolean;
  /** Último catálogo válido (do cache no início, depois da rede). Null antes de haver nenhum. */
  catalog: BibleCatalog | null;
  /** A última tentativa de atualizar falhou. O catálogo do cache, se houver, continua na tela. */
  catalogError: boolean;
  checking: boolean;
  /** Ids instalados: banco principal e baixadas, na ordem da lista. */
  installed: string[];
  /** Máquina de cada instalação em andamento ou com erro (ausente = ociosa). */
  machines: Record<string, MachineState>;
  /** Versão de cada Bíblia baixada instalada (meta.version do banco); ausente se não souber ler. */
  versions: Record<string, string>;
  load(): void;
  /** Atualiza o catálogo pela rede. Devolve false se falhou (o cache continua valendo). */
  refreshCatalog(): Promise<boolean>;
  install(id: string): void;
  cancel(id: string): void;
  remove(id: string): Promise<void>;
}

const controllers = new Map<string, AbortController>();

function catalogUrl(): string {
  const extra = Constants.expoConfig?.extra as { bibleCatalogUrl?: unknown } | undefined;
  return typeof extra?.bibleCatalogUrl === 'string' && extra.bibleCatalogUrl ? extra.bibleCatalogUrl : DEFAULT_BIBLE_CATALOG_URL;
}

export const useBibles = create<BiblesState>()((set, get) => {
  const refreshInstalled = () => {
    set({ installed: installedIds(get().catalog) });
    void refreshVersions();
  };
  // Só as baixadas (com pacote no catálogo) têm versão a conferir; BLivre e KJV vêm com o app.
  const refreshVersions = async () => {
    const catalog = get().catalog;
    const ids = get().installed.filter((id) => findBible(catalog, id)?.package);
    const pairs = await Promise.all(ids.map(async (id) => [id, await installedBibleVersion(id)] as const));
    set({ versions: Object.fromEntries(pairs.filter((p): p is readonly [string, string] => p[1] !== null)) });
  };
  const dispatch = (id: string, e: MachineEvent) =>
    set((s) => ({ machines: { ...s.machines, [id]: reduce(s.machines[id] ?? IDLE_STATE, e) } }));

  return {
    loaded: false,
    catalog: null,
    catalogError: false,
    checking: false,
    installed: [],
    machines: {},
    versions: {},

    load: () => {
      if (get().loaded) return;
      set({ loaded: true, catalog: readCachedCatalog() });
      refreshInstalled();
    },

    refreshCatalog: async () => {
      if (Platform.OS === 'web') return false;
      set({ checking: true });
      try {
        const catalog = await fetchBibleCatalog(catalogUrl());
        set({ catalog, catalogError: false });
        refreshInstalled();
        return true;
      } catch {
        set({ catalogError: true });
        return false;
      } finally {
        set({ checking: false });
      }
    },

    install: (id) => {
      const entry = findBible(get().catalog, id);
      const current = get().machines[id] ?? IDLE_STATE;
      if (!entry?.package || !canStart(current.phase)) return;
      dispatch(id, { type: 'start' });
      if (Platform.OS === 'web') {
        dispatch(id, { type: 'fail', error: 'unsupported' });
        return;
      }
      const ctl = new AbortController();
      controllers.set(id, ctl);
      void installBible(entry, { signal: ctl.signal, dispatch: (e) => dispatch(id, e) }).finally(() => {
        if (controllers.get(id) === ctl) controllers.delete(id);
        // Garantia: nenhuma saída deixa a máquina presa numa fase ativa.
        const phase = get().machines[id]?.phase;
        if (phase && isActive(phase)) dispatch(id, { type: 'fail', error: 'install' });
        refreshInstalled();
      });
    },

    cancel: (id) => {
      controllers.get(id)?.abort();
    },

    remove: async (id) => {
      // BLivre e KJV vêm com o app: não são removidas.
      if (textSources().includes(id) || !get().installed.includes(id)) return;
      if (isActive((get().machines[id] ?? IDLE_STATE).phase)) return;
      await removeBibleFile(id);
      set((s) => ({ machines: { ...s.machines, [id]: { ...IDLE_STATE } } }));
      refreshInstalled();
    },
  };
});

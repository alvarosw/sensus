// Índice de busca por palavra (FTS5) de cada Bíblia baixada, no próprio arquivo dela (bible-<id>.db).
// Por que no mesmo arquivo: a atualização troca o arquivo inteiro e o índice velho sai junto; remover a Bíblia apaga
// os dois; a busca junta o índice com verse_text numa consulta só, na conexão que o leitor já tem aberta.
// Montado em segundo plano depois de instalar ou atualizar (bibles-store) e, ao abrir o app, para as Bíblias que
// ainda não têm o índice da versão instalada. Em lotes, para dar progresso. Sem FTS5 no SQLite (web, ou build com
// expo.sqlite.enableFTS=false), a busca lê todos os versículos e filtra com as mesmas regras (textMatches).
// Medida (BLivre e KJV, 31.102 versículos, node:sqlite 3.51 num servidor): +4,9 MB no arquivo (6,7 → 11,6 MB) e
// ~0,2 s para montar; consultas de 0,2 a 30 ms. No celular, o tempo deve ser algumas vezes maior.
import { create } from 'zustand';
import type { Vid } from '@sensus/core';
import { bibleDatabase } from './bible-db';
import { ftsMatch, indexChunks, indexIsCurrent, indexStamp, textMatches } from './search-model';
import { SEARCH_SQL, versesByVidsSql } from './search-sql';

/** missing: sem índice ainda; building: montando (progress 0..1); ready: FTS5 pronto; scan: sem FTS5, lê tudo. */
export type IndexPhase = 'missing' | 'building' | 'ready' | 'scan' | 'error';

export interface IndexStatus {
  phase: IndexPhase;
  progress: number;
}

interface SearchIndexState {
  byId: Record<string, IndexStatus>;
  /** Garante o índice da Bíblia (fila serial: uma montagem por vez). Não lança. */
  ensure(id: string): Promise<void>;
  /** Esquece o estado (Bíblia removida). */
  forget(id: string): void;
}

const MISSING: IndexStatus = { phase: 'missing', progress: 0 };
let queue: Promise<void> = Promise.resolve();

export const useSearchIndex = create<SearchIndexState>()((set, get) => {
  const setStatus = (id: string, status: IndexStatus) => set((s) => ({ byId: { ...s.byId, [id]: status } }));

  const build = async (id: string): Promise<void> => {
    const db = bibleDatabase(id);
    if (!db) return setStatus(id, MISSING);
    const version = (await db.getFirstAsync<{ value: string }>(SEARCH_SQL.version))?.value ?? '';
    const stamp = (await db.getFirstAsync<{ value: string }>(SEARCH_SQL.readStamp).catch(() => null))?.value ?? null;
    if (indexIsCurrent(stamp, version)) return setStatus(id, { phase: 'ready', progress: 1 });
    setStatus(id, { phase: 'building', progress: 0 });
    try {
      await db.runAsync(SEARCH_SQL.clearStamp);
      await db.execAsync(SEARCH_SQL.drop);
      await db.execAsync(SEARCH_SQL.create);
    } catch {
      // SQLite sem FTS5: a busca segue sem índice.
      return setStatus(id, { phase: 'scan', progress: 1 });
    }
    const max = (await db.getFirstAsync<{ n: number | null }>(SEARCH_SQL.maxRowid))?.n ?? 0;
    const chunks = indexChunks(max);
    for (let i = 0; i < chunks.length; i++) {
      const [from, to] = chunks[i]!;
      await db.runAsync(SEARCH_SQL.insertChunk, [from, to]);
      setStatus(id, { phase: 'building', progress: (i + 1) / (chunks.length + 1) });
    }
    await db.execAsync(SEARCH_SQL.optimize);
    await db.runAsync(SEARCH_SQL.writeStamp, [indexStamp(version)]);
    setStatus(id, { phase: 'ready', progress: 1 });
  };

  return {
    byId: {},
    ensure: (id) => {
      const cur = get().byId[id]?.phase;
      if (cur === 'ready' || cur === 'scan' || cur === 'building') return queue;
      setStatus(id, { phase: 'building', progress: 0 });
      queue = queue.then(() => build(id)).catch(() => setStatus(id, { phase: 'error', progress: 0 }));
      return queue;
    },
    forget: (id) =>
      set((s) => {
        const { [id]: _gone, ...rest } = s.byId;
        return { byId: rest };
      }),
  };
});

/** A Bíblia está aberta (baixada) e pode ser buscada? */
export function searchAvailable(id: string): boolean {
  return bibleDatabase(id) !== null;
}

/** vids que casam com os termos, em ordem canônica; null se a Bíblia não está aberta ou o índice não está pronto. */
export async function searchVids(id: string, terms: readonly string[], prefix: boolean): Promise<Vid[] | null> {
  const db = bibleDatabase(id);
  const phase = useSearchIndex.getState().byId[id]?.phase;
  if (!db || terms.length === 0) return null;
  if (phase === 'ready') {
    const rows = await db.getAllAsync<{ vid: number }>(SEARCH_SQL.search, [ftsMatch(terms, prefix)]);
    return rows.map((r) => r.vid);
  }
  if (phase === 'scan') {
    const rows = await db.getAllAsync<{ vid: number; text: string }>(SEARCH_SQL.scan);
    return rows.filter((r) => textMatches(r.text, terms, prefix)).map((r) => r.vid);
  }
  return null;
}

/** Texto dos versículos pedidos (os que a lista mostra), por vid. */
export async function versesByVids(id: string, vids: readonly Vid[]): Promise<Map<Vid, string>> {
  const db = bibleDatabase(id);
  const out = new Map<Vid, string>();
  if (!db || vids.length === 0) return out;
  const rows = await db.getAllAsync<{ vid: number; text: string }>(versesByVidsSql(vids.length), [...vids]);
  for (const r of rows) out.set(r.vid, r.text);
  return out;
}

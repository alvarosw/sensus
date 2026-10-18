// Nomes em português das entidades (tabela entity_name, ver pipeline/schema.sql). Banco baixado antes da tabela
// existir não quebra: a presença é lida uma vez por driver (sqlite_master) e, sem ela, nenhuma consulta de nome pt
// roda; todo nome fica null e vale o nome da fonte. Ver domain/names.ts para a escolha do nome a mostrar.
import { ENTITY_NAME_LANG } from '../domain/names';
import { all, chunks, type Db, placeholders } from './sql';

/** Uma leitura de sqlite_master por driver (o driver muda quando o banco muda). */
const probes = new WeakMap<Db, Promise<boolean>>();

/** A tabela entity_name existe neste banco? */
export function hasEntityNames(db: Db): Promise<boolean> {
  let probe = probes.get(db);
  if (!probe) {
    probe = all<{ n: number }>(db, "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'entity_name'").then(
      (rows) => (rows[0]?.n ?? 0) > 0,
    );
    probes.set(db, probe);
  }
  return probe;
}

/** Nome pt de cada cite_id dado (só os que têm linha). Sem a tabela, mapa vazio. */
export async function ptNames(db: Db, citeIds: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(citeIds)];
  if (ids.length === 0 || !(await hasEntityNames(db))) return out;
  for (const part of chunks(ids, 400)) {
    const rows = await all<{ cite_id: string; name: string }>(
      db,
      `SELECT cite_id, name FROM entity_name WHERE lang = ? AND cite_id IN (${placeholders(part.length)})`,
      [ENTITY_NAME_LANG, ...part],
    );
    for (const r of rows) out.set(r.cite_id, r.name);
  }
  return out;
}

/** Acrescenta `namePt` (nome pt ou null) a cada item, pelo id que `idOf` devolve. */
export async function attachNames<T>(
  db: Db,
  items: readonly T[],
  idOf: (item: T) => string,
): Promise<Array<T & { namePt: string | null }>> {
  const names = await ptNames(db, items.map(idOf));
  return items.map((item) => ({ ...item, namePt: names.get(idOf(item)) ?? null }));
}

/** Acrescenta `namePt` aos participantes de cada evento (chave: o cite_id do participante). */
export async function attachParticipantNames<E extends { participants: Array<{ cite_id: string }> }>(
  db: Db,
  events: readonly E[],
): Promise<E[]> {
  const names = await ptNames(db, events.flatMap((e) => e.participants.map((p) => p.cite_id)));
  return events.map((e) => ({
    ...e,
    participants: e.participants.map((p) => ({ ...p, namePt: names.get(p.cite_id) ?? null })),
  }));
}

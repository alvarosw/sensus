// Nomes em português das entidades (tabela entity_name, ver pipeline/schema.sql). Banco baixado antes da tabela
// existir não quebra: a presença é lida uma vez por driver (sqlite_master) e, sem ela, nenhuma consulta de nome pt
// roda; todo nome fica null e vale o nome da fonte. Ver domain/names.ts para a escolha do nome a mostrar.
import type { AppLang } from '../domain/locale';
import { ENTITY_NAME_LANG } from '../domain/names';
import { matchesSearchName } from '../timeline';
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

/**
 * Nome em `lang` de cada cite_id dado (só os que têm linha nesse idioma). Sem a tabela, ou sem linhas no idioma pedido,
 * mapa vazio: quem chama mostra o nome da fonte.
 */
export async function ptNames(db: Db, citeIds: readonly string[], lang: AppLang = ENTITY_NAME_LANG): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(citeIds)];
  if (ids.length === 0 || !(await hasEntityNames(db))) return out;
  for (const part of chunks(ids, 400)) {
    const rows = await all<{ cite_id: string; name: string }>(
      db,
      `SELECT cite_id, name FROM entity_name WHERE lang = ? AND cite_id IN (${placeholders(part.length)})`,
      [lang, ...part],
    );
    for (const r of rows) out.set(r.cite_id, r.name);
  }
  return out;
}

/**
 * Acrescenta `namePt` (nome no idioma `lang`, ou null) a cada item, pelo id que `idOf` devolve. O campo mantém o nome
 * de antes; o idioma é o do app (padrão pt, ver Repo.setNameLang).
 */
export async function attachNames<T>(
  db: Db,
  items: readonly T[],
  idOf: (item: T) => string,
  lang: AppLang = ENTITY_NAME_LANG,
): Promise<Array<T & { namePt: string | null }>> {
  const names = await ptNames(db, items.map(idOf), lang);
  return items.map((item) => ({ ...item, namePt: names.get(idOf(item)) ?? null }));
}

/**
 * Linhas de todas as entidades no idioma `lang` (cite_id, nome), lidas uma vez por driver e idioma: a busca casa o
 * nome sem acento, o que o SQL não faz. Sem a tabela, ou sem linhas no idioma, lista vazia.
 */
const ptRows = new WeakMap<Db, Map<AppLang, Promise<Array<{ cite_id: string; name: string }>>>>();

/** cite_ids (pessoas, lugares e eventos) cujo nome no idioma casa com a busca (ver matchesSearchName). */
export async function ptNameIds(db: Db, query: string, lang: AppLang = ENTITY_NAME_LANG): Promise<string[]> {
  let byLang = ptRows.get(db);
  if (!byLang) {
    byLang = new Map();
    ptRows.set(db, byLang);
  }
  let rows = byLang.get(lang);
  if (!rows) {
    rows = hasEntityNames(db).then((has) =>
      has ? all<{ cite_id: string; name: string }>(db, 'SELECT cite_id, name FROM entity_name WHERE lang = ?', [lang]) : [],
    );
    byLang.set(lang, rows);
  }
  return (await rows).filter((r) => matchesSearchName(r.name, query)).map((r) => r.cite_id);
}

/**
 * Acrescenta `namePt` ao evento (título pt) e a cada participante (pelo cite_id dele). Um só lookup para os dois.
 * Devolve na mesma ordem.
 */
export async function attachEventNames<E extends { cite_id: string; participants: Array<{ cite_id: string }> }>(
  db: Db,
  events: readonly E[],
  lang: AppLang = ENTITY_NAME_LANG,
): Promise<Array<E & { namePt: string | null }>> {
  const names = await ptNames(db, events.flatMap((e) => [e.cite_id, ...e.participants.map((p) => p.cite_id)]), lang);
  return events.map((e) => ({
    ...e,
    namePt: names.get(e.cite_id) ?? null,
    participants: e.participants.map((p) => ({ ...p, namePt: names.get(p.cite_id) ?? null })),
  }));
}

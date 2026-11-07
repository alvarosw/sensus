// Descrições em português das entidades (tabela entity_text, ver pipeline/schema.sql). Banco baixado antes da tabela
// existir não quebra: a presença é lida uma vez por driver (sqlite_master) e, sem ela, nenhuma descrição pt é lida;
// todo descriptionPt fica null e vale a descrição da fonte. Ver domain/names.ts (shownDescription) para a escolha.
import type { AppLang } from '../domain/locale';
import { ENTITY_TEXT_LANG } from '../domain/names';
import { all, chunks, type Db, placeholders } from './sql';

/** Uma leitura de sqlite_master por driver (o driver muda quando o banco muda). */
const probes = new WeakMap<Db, Promise<boolean>>();

/** A tabela entity_text existe neste banco? */
export function hasEntityText(db: Db): Promise<boolean> {
  let probe = probes.get(db);
  if (!probe) {
    probe = all<{ n: number }>(db, "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'entity_text'").then(
      (rows) => (rows[0]?.n ?? 0) > 0,
    );
    probes.set(db, probe);
  }
  return probe;
}

/** Descrição no idioma `lang` de cada cite_id dado (só os que têm linha nesse idioma). Sem a tabela, mapa vazio. */
async function ptDescriptions(db: Db, citeIds: readonly string[], lang: AppLang = ENTITY_TEXT_LANG): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(citeIds)];
  if (ids.length === 0 || !(await hasEntityText(db))) return out;
  for (const part of chunks(ids, 400)) {
    const rows = await all<{ cite_id: string; description: string }>(
      db,
      `SELECT cite_id, description FROM entity_text WHERE lang = ? AND cite_id IN (${placeholders(part.length)})`,
      [lang, ...part],
    );
    for (const r of rows) out.set(r.cite_id, r.description);
  }
  return out;
}

/** Acrescenta `descriptionPt` (descrição pt ou null) a cada item, pelo id que `idOf` devolve. */
export async function attachDescriptions<T>(
  db: Db,
  items: readonly T[],
  idOf: (item: T) => string,
  lang: AppLang = ENTITY_TEXT_LANG,
): Promise<Array<T & { descriptionPt: string | null }>> {
  const texts = await ptDescriptions(db, items.map(idOf), lang);
  return items.map((item) => ({ ...item, descriptionPt: texts.get(idOf(item)) ?? null }));
}

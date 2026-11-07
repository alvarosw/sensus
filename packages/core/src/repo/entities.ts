// Pessoas, lugares e grupos ligados a versículos (ver repo/index.ts).
import type { Entity, VerseRange } from '../types';
import { all, type Db } from './sql';
import type { AppLang } from '../domain/locale';
import { attachNames } from './names';
import { attachDescriptions } from './entity-text';

/** Entidade com o número total de versículos em que aparece (genericidade). */
export type EntityHit = Entity & { total_refs: number };
/** Lugar com coordenadas e o versículo onde aparece (ver Repo.placesInRange). */
export type PlaceVerseHit = Entity & { lat: number; lon: number; vid: number };

/**
 * Pessoas, lugares e grupos ligados a versículos do intervalo, com o total de referências de cada um, o nome em
 * português (`namePt`) e a descrição em português (`descriptionPt`), ver domain/names.ts.
 */
export async function entities(db: Db, range: VerseRange, lang: AppLang): Promise<EntityHit[]> {
  const rows = await all<EntityHit>(
    db,
    `SELECT DISTINCT e.cite_id, e.source_id, e.type, e.name, e.description, e.lat, e.lon, e.data,
            (SELECT COUNT(*) FROM entity_ref x WHERE x.entity_cite_id = e.cite_id) AS total_refs
     FROM entity_ref r JOIN entity e ON e.cite_id = r.entity_cite_id
     WHERE r.vid BETWEEN ? AND ?
     ORDER BY e.name, e.cite_id`,
    [range.start, range.end],
  );
  return attachDescriptions(db, await attachNames(db, rows, (r) => r.cite_id, lang), (r) => r.cite_id, lang);
}

/**
 * Lugares com coordenadas ligados a versículos do intervalo: uma linha por (lugar, versículo).
 * Usado pelos mapas (passagem, selecao, perícope, livro). `data` traz a identificação da fonte.
 */
export async function placesInRange(db: Db, range: VerseRange, lang: AppLang): Promise<PlaceVerseHit[]> {
  const rows = await all<PlaceVerseHit>(
    db,
    `SELECT DISTINCT e.cite_id, e.source_id, e.type, e.name, e.description, e.lat, e.lon, e.data, r.vid AS vid
     FROM entity_ref r JOIN entity e ON e.cite_id = r.entity_cite_id
     WHERE e.type = 'place' AND e.lat IS NOT NULL AND e.lon IS NOT NULL AND r.vid BETWEEN ? AND ?
     ORDER BY e.name, e.cite_id, r.vid`,
    [range.start, range.end],
  );
  return attachDescriptions(db, await attachNames(db, rows, (r) => r.cite_id, lang), (r) => r.cite_id, lang);
}

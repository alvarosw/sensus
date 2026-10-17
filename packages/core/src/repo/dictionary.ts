// Dicionários e índices temáticos ligados a versículos (ver repo/index.ts).
import type { Book, DictionaryEntry, SqlParam, VerseRange } from '../types';
import { all, type Db, placeholders } from './sql';

export type DictionaryKind = 'dictionary' | 'topical';
/**
 * Verbete de dicionário ou índice temático, com o tipo da fonte.
 * ref_span: menor amplitude (vid final - vid inicial) entre as referências do verbete que tocam o intervalo.
 * total_refs: número total de referências do verbete (especificidade).
 */
export type DictionaryHit = DictionaryEntry & { kind: DictionaryKind; ref_span: number; total_refs: number };

/** Verbetes cujas referências (entry_ref) se sobrepõem ao intervalo, com o tipo da fonte. */
export async function dictionaryEntries(
  db: Db,
  range: VerseRange,
  kinds: readonly DictionaryKind[] = ['dictionary', 'topical'],
): Promise<DictionaryHit[]> {
  const allowed = kinds.filter((k): k is DictionaryKind => k === 'dictionary' || k === 'topical');
  if (allowed.length === 0) return [];
  return all<DictionaryHit>(
    db,
    `SELECT d.cite_id, d.source_id, d.headword, d.text, s.kind AS kind,
            MIN(r.end_vid - r.start_vid) AS ref_span,
            (SELECT COUNT(*) FROM entry_ref x WHERE x.entry_cite_id = d.cite_id) AS total_refs
     FROM entry_ref r
     CROSS JOIN dictionary_entry d CROSS JOIN source s
     WHERE d.cite_id = r.entry_cite_id AND s.id = d.source_id
       AND r.start_vid <= ? AND r.end_vid >= ? AND s.kind IN (${placeholders(allowed.length)})
     GROUP BY d.cite_id, s.kind
     ORDER BY s.kind, d.headword, d.cite_id`,
    [range.end, range.start, ...allowed],
  );
}

/** Verbetes de dicionário do livro (ex.: "Philippians, Epistle to the" ou "Philippians"). */
export function bookIntro(db: Db, book: Pick<Book, 'name_en' | 'name_pt'>): Promise<DictionaryEntry[]> {
  const names = [...new Set([book.name_en, book.name_pt])];
  const conds = [
    ...names.map(() => 'lower(d.headword) = lower(?)'),
    ...names.map(() => 'lower(d.headword) LIKE lower(?)'),
  ];
  const params: SqlParam[] = [...names, ...names.map((n) => `${n},%`)];
  return all<DictionaryEntry>(
    db,
    `SELECT d.cite_id, d.source_id, d.headword, d.text FROM dictionary_entry d
     JOIN source s ON s.id = d.source_id
     WHERE s.kind = 'dictionary' AND (${conds.join(' OR ')})
     ORDER BY d.headword, d.cite_id`,
    params,
  );
}

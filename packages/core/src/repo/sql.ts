// Helpers e colunas comuns às consultas do Repo (ver repo/index.ts). Cada módulo recebe o driver e usa estas
// funções; aqui não há regra de domínio, só SQL de apoio e listas de colunas.
import type { SqlDriver, SqlParam } from '../types';

/** O que as consultas precisam do banco: o driver mínimo (ver SqlDriver). */
export type Db = SqlDriver;

/** Linha de `SELECT COUNT(...) AS n`. */
export interface CountRow {
  n: number;
}

export function all<T>(db: Db, sql: string, params: SqlParam[] = []): Promise<T[]> {
  return db.all<T>(sql, params);
}

export async function first<T>(db: Db, sql: string, params: SqlParam[] = []): Promise<T | null> {
  const rows = await all<T>(db, sql, params);
  return rows[0] ?? null;
}

export const placeholders = (n: number): string => Array.from({ length: n }, () => '?').join(', ');

/** Chunks para IN (...): o SQLite aceita poucos parâmetros por consulta. */
export function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const VERSE_COLS = 'cite_id, source_id, vid, text';
export const TOKEN_COLS =
  'cite_id, source_id, corpus, vid, pos, surface, translit, lemma, strong, strong_base, morph, morph_desc, gloss_en, editions, variant_note, alt_ref';
export const LEXICON_COLS = 'cite_id, source_id, key, strong_base, lemma, translit, gloss, definition, lang';
export const COMMENTARY_COLS = 'cite_id, source_id, start_vid, end_vid, text';
export const DICTIONARY_COLS = 'cite_id, source_id, headword, text';
export const XREF_COLS = 'cite_id, source_id, from_vid, to_start_vid, to_end_vid, weight';
export const ENTITY_COLS = 'cite_id, source_id, type, name, description, lat, lon, data';

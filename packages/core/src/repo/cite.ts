// Resolve um cite_id ao registro de origem (ver repo/index.ts).
import type { CitableRecord, Commentary, DictionaryEntry, Entity, LexiconEntry, Token, VerseText, XRef } from '../types';
import { type Db, first, COMMENTARY_COLS, DICTIONARY_COLS, ENTITY_COLS, LEXICON_COLS, TOKEN_COLS, VERSE_COLS, XREF_COLS } from './sql';
import { attachNames } from './names';

/** Resolve um cite_id ao registro de origem. Retorna null se o prefixo ou o id não existir. */
export async function resolveCite(db: Db, citeId: string): Promise<CitableRecord | null> {
  const colon = citeId.indexOf(':');
  if (colon <= 0) return null;
  switch (citeId.slice(0, colon)) {
    // txt/tok: cite_id é derivado nas views (pipeline/schema_physical.sql), então a busca vai pela chave
    // (source/vid, vid/pos) e o cite_id só confirma o registro. Sem isso, a view varreria a tabela.
    case 'txt': {
      const m = /^txt:(.+):(\d+)$/.exec(citeId);
      if (!m) return null;
      const record = await first<VerseText>(
        db,
        `SELECT ${VERSE_COLS} FROM verse_text WHERE source_id = ? AND vid = ? AND cite_id = ?`,
        [m[1]!, Number(m[2]), citeId],
      );
      return record ? { table: 'verse_text', record } : null;
    }
    case 'tok': {
      const m = /^tok:(?:gnt|hot):(\d+):(\d+)$/.exec(citeId);
      if (!m) return null;
      const record = await first<Token>(
        db,
        `SELECT ${TOKEN_COLS} FROM token WHERE vid = ? AND pos = ? AND cite_id = ?`,
        [Number(m[1]), Number(m[2]), citeId],
      );
      return record ? { table: 'token', record } : null;
    }
    case 'lex': {
      const record = await first<LexiconEntry>(db, `SELECT ${LEXICON_COLS} FROM lexicon_entry WHERE cite_id = ?`, [citeId]);
      return record ? { table: 'lexicon_entry', record } : null;
    }
    case 'com': {
      const record = await first<Commentary>(db, `SELECT ${COMMENTARY_COLS} FROM commentary WHERE cite_id = ?`, [citeId]);
      return record ? { table: 'commentary', record } : null;
    }
    case 'dic': {
      const record = await first<DictionaryEntry>(db, `SELECT ${DICTIONARY_COLS} FROM dictionary_entry WHERE cite_id = ?`, [citeId]);
      return record ? { table: 'dictionary_entry', record } : null;
    }
    // xr: cite_id é derivado na view (pipeline/schema_physical.sql); a busca vai pela chave da tabela.
    case 'xr': {
      const m = /^xr:([^:]+):(\d+):(\d+)-(\d+)$/.exec(citeId);
      if (!m) return null;
      const record = await first<XRef>(
        db,
        `SELECT ${XREF_COLS} FROM xref WHERE from_vid = ? AND source_id = ? AND to_start_vid = ? AND to_end_vid = ? AND cite_id = ?`,
        [Number(m[2]), m[1]!, Number(m[3]), Number(m[4]), citeId],
      );
      return record ? { table: 'xref', record } : null;
    }
    case 'ent': {
      const row = await first<Entity>(db, `SELECT ${ENTITY_COLS} FROM entity WHERE cite_id = ?`, [citeId]);
      if (!row) return null;
      const [record] = await attachNames(db, [row], (r) => r.cite_id);
      return { table: 'entity', record: record! };
    }
    default:
      return null;
  }
}

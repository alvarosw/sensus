// Consultas tipadas ao banco (SQLite, esquema em pipeline/schema.sql). Só SQL parametrizado.
import type {
  Book,
  CitableRecord,
  Commentary,
  DictionaryEntry,
  Entity,
  LexiconEntry,
  SqlDriver,
  SqlParam,
  Source,
  TextDivision,
  TimelineEvent,
  TimelineLine,
  TimelineLineEvent,
  TimelineLineRef,
  TimelineSearchResult,
  TimelineSummary,
  Token,
  VerseRange,
  VerseText,
  Vid,
  XRef,
} from './types';
import { LAST_VERSE, makeVid, splitVid } from './refs';
import { eraSummaries, normalizeSearch, searchTerms } from './timeline';

/** Fonte de texto usada por padrão para contexto literário e alvos de referências cruzadas. */
export const DEFAULT_TEXT_SOURCE = 'blivre';

const MAX_INTRO_VIDS = 200;
const MAX_XREF_TARGET_VERSES = 12;
/** Primeiro livro do NT na ordem protestante (1-39 são do AT). */
const FIRST_NT_BOOK = 40;

const VERSE_COLS = 'cite_id, source_id, vid, text';
const TOKEN_COLS =
  'cite_id, source_id, corpus, vid, pos, surface, translit, lemma, strong, strong_base, morph, morph_desc, gloss_en, editions, variant_note, alt_ref';
const LEXICON_COLS = 'cite_id, source_id, key, strong_base, lemma, translit, gloss, definition, lang';
const COMMENTARY_COLS = 'cite_id, source_id, start_vid, end_vid, text';
const DICTIONARY_COLS = 'cite_id, source_id, headword, text';
const XREF_COLS = 'cite_id, source_id, from_vid, to_start_vid, to_end_vid, weight';
const ENTITY_COLS = 'cite_id, source_id, type, name, description, lat, lon, data';
/** Evento com o primeiro e o último versículo do evento inteiro (todos os entity_ref dele). */
const EVENT_SELECT = `SELECT e.cite_id, e.source_id, e.name, e.data,
  (SELECT MIN(x.vid) FROM entity_ref x WHERE x.entity_cite_id = e.cite_id) AS first_vid,
  (SELECT MAX(x.vid) FROM entity_ref x WHERE x.entity_cite_id = e.cite_id) AS last_vid
  FROM entity e`;
/** Quantos eventos de contexto entram antes e depois do trecho na linha do tempo. */
const TIMELINE_CONTEXT = 2;

export type DictionaryKind = 'dictionary' | 'topical';
/**
 * Verbete de dicionário ou índice temático, com o tipo da fonte.
 * ref_span: menor amplitude (vid final - vid inicial) entre as referências do verbete que tocam o intervalo.
 * total_refs: número total de referências do verbete (especificidade).
 */
export type DictionaryHit = DictionaryEntry & { kind: DictionaryKind; ref_span: number; total_refs: number };
/** Entidade com o número total de versículos em que aparece (genericidade). */
export type EntityHit = Entity & { total_refs: number };
/** Lugar com coordenadas e o versículo onde aparece (ver Repo.placesInRange). */
export type PlaceVerseHit = Entity & { lat: number; lon: number; vid: number };
export type XRefWithTexts = XRef & { texts: VerseText[] };
export interface Concordance {
  /** Total de versículos distintos com o strong_base no corpus original. */
  count: number;
  samples: VerseText[];
}

interface CountRow {
  n: number;
}

const placeholders = (n: number): string => Array.from({ length: n }, () => '?').join(', ');

/** Capítulos de introdução (vid(b,c,0)) e de livro (vid(b,0,0)) tocados pelo intervalo. */
function introVids(range: VerseRange): number[] {
  const s = splitVid(range.start);
  const e = splitVid(range.end);
  const out: number[] = [];
  for (let book = s.book; book <= e.book && out.length < MAX_INTRO_VIDS; book++) {
    out.push(makeVid(book, 0, 0));
    const first = book === s.book ? s.chapter : 1;
    const last = book === e.book ? e.chapter : LAST_VERSE;
    for (let ch = Math.max(first, 1); ch <= last && out.length < MAX_INTRO_VIDS; ch++) {
      out.push(makeVid(book, ch, 0));
    }
  }
  return out;
}

interface EventRow {
  cite_id: string;
  source_id: string;
  name: string;
  data: string | null;
  first_vid: Vid | null;
  last_vid: Vid | null;
}

/** Converte a linha de um evento; null se faltar a posição cronológica ou os versículos (dado incompleto). */
function timelineEventOf(row: EventRow): TimelineLineEvent | null {
  if (row.first_vid == null || row.last_vid == null) return null;
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(row.data ?? '{}') as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof j.sortKey !== 'number') return null;
  const participants = Array.isArray(j.participants) ? j.participants : [];
  return {
    cite_id: row.cite_id,
    source_id: row.source_id,
    title: typeof j.title === 'string' && j.title ? j.title : row.name,
    startDate: typeof j.startDate === 'string' ? j.startDate : null,
    sortKey: j.sortKey,
    participants: participants
      .filter((p): p is { cite_id: string; name: string } => typeof p?.cite_id === 'string')
      .map((p) => ({ cite_id: p.cite_id, name: String(p.name ?? '') })),
    first_vid: row.first_vid,
    last_vid: row.last_vid,
  };
}

/**
 * Pares linha → evento, para as três origens de linha do tempo (ver TimelineLine). Cada uma é um CTE `memb`.
 * Com termos, o filtro pelo nome da linha entra em cada origem antes do json_each: a busca não lê a cronologia
 * inteira. Os parâmetros vêm na ordem do SQL (um conjunto por origem).
 */
function timelineMembers(nameTerms: readonly string[] = []): { sql: string; params: string[] } {
  const named = (col: string) =>
    nameTerms.length > 0 ? ` AND (${nameTerms.map(() => `instr(lower(${col}), ?) > 0`).join(' OR ')})` : '';
  const sql = `WITH memb(kind, line_id, line_name, event_id) AS (
  SELECT 'person', p.cite_id, p.name, json_extract(j.value, '$.cite_id')
    FROM entity p, json_each(json_extract(p.data, '$.timeline')) j
   WHERE p.type = 'person' AND p.source_id = 'theographic' AND json_valid(p.data)${named('p.name')}
  UNION ALL
  SELECT 'place', p.cite_id, p.name, json_extract(j.value, '$.cite_id')
    FROM entity p, json_each(json_extract(p.data, '$.eventsHere')) j
   WHERE p.type = 'place' AND p.source_id = 'theographic' AND json_valid(p.data)${named('p.name')}
  UNION ALL
  SELECT 'period', json_extract(j.value, '$.cite_id'), json_extract(j.value, '$.name'), e.cite_id
    FROM entity e, json_each(json_extract(e.data, '$.partOf')) j
   WHERE e.type = 'event' AND json_valid(e.data)${named("json_extract(j.value, '$.name')")}
)`;
  return { sql, params: [...nameTerms, ...nameTerms, ...nameTerms] };
}
/** Posição cronológica do evento (guardada antes do json_extract, que falha em JSON inválido). */
const TIMELINE_KEY = `CASE WHEN json_valid(e.data) THEN json_extract(e.data, '$.sortKey') END`;
/** Título do evento: o do JSON, ou o nome do registro. */
const TIMELINE_TITLE = `COALESCE(CASE WHEN json_valid(e.data) THEN json_extract(e.data, '$.title') END, e.name)`;

interface MemberRow {
  kind: TimelineLine['kind'];
  id: string;
  name: string;
  n: number;
  lo: number;
  hi: number;
}

/** Linha do tempo de uma pessoa, lugar ou período, com a contagem de eventos e a faixa de anos (ver TimelineLine). */
function lineOf(row: MemberRow): TimelineLine {
  return { id: row.id, kind: row.kind, name: row.name, count: row.n, from: Math.round(row.lo), to: Math.round(row.hi) };
}

/** Ordem cronológica (sortKey) e, em empate, pelo cite_id. */
function bySortKey<T extends TimelineLineEvent>(a: T, b: T): number {
  return a.sortKey - b.sortKey || (a.cite_id < b.cite_id ? -1 : a.cite_id > b.cite_id ? 1 : 0);
}

/** Chunks para IN (...): o SQLite aceita poucos parâmetros por consulta. */
function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export class Repo {
  constructor(private readonly driver: SqlDriver) {}

  private all<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    return this.driver.all<T>(sql, params);
  }

  private async first<T>(sql: string, params: SqlParam[] = []): Promise<T | null> {
    const rows = await this.all<T>(sql, params);
    return rows[0] ?? null;
  }

  books(): Promise<Book[]> {
    return this.all<Book>('SELECT num, osis, name_pt, name_en, testament, chapters FROM book ORDER BY num');
  }

  sources(): Promise<Source[]> {
    return this.all<Source>('SELECT * FROM source ORDER BY kind, id');
  }

  source(id: string): Promise<Source | null> {
    return this.first<Source>('SELECT * FROM source WHERE id = ?', [id]);
  }

  /** Versículos de uma fonte de texto dentro do intervalo, em ordem. */
  verseTexts(sourceId: string, range: VerseRange, limit?: number): Promise<VerseText[]> {
    const params: SqlParam[] = [sourceId, range.start, range.end];
    let sql = `SELECT ${VERSE_COLS} FROM verse_text WHERE source_id = ? AND vid BETWEEN ? AND ? ORDER BY vid`;
    if (limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(limit);
    }
    return this.all<VerseText>(sql, params);
  }

  chapter(sourceId: string, book: number, chapter: number): Promise<VerseText[]> {
    return this.verseTexts(sourceId, { start: makeVid(book, chapter, 0), end: makeVid(book, chapter, LAST_VERSE) });
  }

  /**
   * Versículos antes e depois do intervalo, sem sair do livro: `count` versículos em cada lado.
   * Se `unit` for dado, também inclui os versículos da unidade literária (até 40 por lado),
   * para que a divisão que contém o trecho apareça inteira.
   */
  async neighbors(
    sourceId: string,
    range: VerseRange,
    count: number,
    unit?: VerseRange,
  ): Promise<{ before: VerseText[]; after: VerseText[] }> {
    const UNIT_CAP = 40;
    const book = splitVid(range.start).book;
    const bookStart = book * 1_000_000;
    const bookEnd = (book + 1) * 1_000_000;
    const unitStart = unit ? Math.max(unit.start, bookStart) : range.start;
    const unitEnd = unit ? Math.min(unit.end, bookEnd - 1) : range.end;
    const [beforeDesc, afterAsc, unitBefore, unitAfter] = await Promise.all([
      count > 0
        ? this.all<VerseText>(
            `SELECT ${VERSE_COLS} FROM verse_text WHERE source_id = ? AND vid < ? AND vid >= ? ORDER BY vid DESC LIMIT ?`,
            [sourceId, range.start, bookStart, count],
          )
        : Promise.resolve([]),
      count > 0
        ? this.all<VerseText>(
            `SELECT ${VERSE_COLS} FROM verse_text WHERE source_id = ? AND vid > ? AND vid < ? ORDER BY vid LIMIT ?`,
            [sourceId, range.end, bookEnd, count],
          )
        : Promise.resolve([]),
      unit && unitStart < range.start
        ? this.all<VerseText>(
            `SELECT ${VERSE_COLS} FROM verse_text WHERE source_id = ? AND vid >= ? AND vid < ? ORDER BY vid DESC LIMIT ?`,
            [sourceId, unitStart, range.start, UNIT_CAP],
          )
        : Promise.resolve([]),
      unit && unitEnd > range.end
        ? this.all<VerseText>(
            `SELECT ${VERSE_COLS} FROM verse_text WHERE source_id = ? AND vid > ? AND vid <= ? ORDER BY vid LIMIT ?`,
            [sourceId, range.end, unitEnd, UNIT_CAP],
          )
        : Promise.resolve([]),
    ]);
    const before = new Map<number, VerseText>();
    for (const v of [...beforeDesc, ...unitBefore]) before.set(v.vid, v);
    const after = new Map<number, VerseText>();
    for (const v of [...afterAsc, ...unitAfter]) after.set(v.vid, v);
    return {
      before: [...before.values()].sort((a, b) => a.vid - b.vid),
      after: [...after.values()].sort((a, b) => a.vid - b.vid),
    };
  }

  /**
   * Divisões relevantes para o intervalo: a última que começa antes dele (lead), as que começam
   * dentro dele e a primeira depois do fim (next). Assim a unidade literária fica delimitada.
   */
  async divisions(sourceId: string, range: VerseRange): Promise<TextDivision[]> {
    const bookStart = splitVid(range.start).book * 1_000_000;
    const bookEnd = (splitVid(range.start).book + 1) * 1_000_000;
    const [lead, inside, next] = await Promise.all([
      this.all<TextDivision>(
        `SELECT source_id, vid, kind, title FROM text_division
         WHERE source_id = ? AND vid >= ? AND vid < ? ORDER BY vid DESC, kind LIMIT 1`,
        [sourceId, bookStart, range.start],
      ),
      this.all<TextDivision>(
        'SELECT source_id, vid, kind, title FROM text_division WHERE source_id = ? AND vid BETWEEN ? AND ? ORDER BY vid, kind',
        [sourceId, range.start, range.end],
      ),
      this.all<TextDivision>(
        `SELECT source_id, vid, kind, title FROM text_division
         WHERE source_id = ? AND vid > ? AND vid < ? ORDER BY vid, kind LIMIT 1`,
        [sourceId, range.end, bookEnd],
      ),
    ]);
    return [...lead, ...inside, ...next];
  }

  /**
   * Fonte das divisões que delimitam a unidade literária do livro: os parágrafos do original
   * ('tagnt' no NT, 'tahot' no AT), se houver parágrafos para o livro; senão a fonte de texto dada.
   * As divisões de tradução costumam ter um só parágrafo por capítulo, por isso o original tem prioridade.
   */
  private async unitDivisionSource(book: number, textSourceId: string): Promise<{ id: string; paragraphsOnly: boolean }> {
    const preferred = book >= FIRST_NT_BOOK ? 'tagnt' : 'tahot';
    const hit = await this.first<{ vid: number }>(
      `SELECT vid FROM text_division WHERE source_id = ? AND kind = 'paragraph' AND vid >= ? AND vid < ? LIMIT 1`,
      [preferred, book * 1_000_000, (book + 1) * 1_000_000],
    );
    return hit ? { id: preferred, paragraphsOnly: true } : { id: textSourceId, paragraphsOnly: false };
  }

  /**
   * Unidade literária que contém o intervalo (ver PanelData.layers.literary.unit).
   * Divisões: parágrafos do original (ver unitDivisionSource), ou da fonte de texto na falta deles.
   * Início: última divisão em/antes de range.start (ou início do livro). Fim: o versículo antes da
   * primeira divisão depois de range.end (ou último versículo do livro), e nunca antes de range.end.
   * Assim, uma seleção que cruza parágrafos gera uma unidade que os abrange todos.
   */
  async literaryUnit(sourceId: string, range: VerseRange): Promise<VerseRange> {
    const book = splitVid(range.start).book;
    const bookStart = book * 1_000_000;
    const bookEnd = (book + 1) * 1_000_000;
    const div = await this.unitDivisionSource(book, sourceId);
    const kindClause = div.paragraphsOnly ? " AND kind = 'paragraph'" : '';
    const lead = await this.first<{ vid: number }>(
      `SELECT vid FROM text_division WHERE source_id = ?${kindClause} AND vid <= ? AND vid >= ? ORDER BY vid DESC LIMIT 1`,
      [div.id, range.start, bookStart],
    );
    const next = await this.first<{ vid: number }>(
      `SELECT vid FROM text_division WHERE source_id = ?${kindClause} AND vid > ? AND vid < ? ORDER BY vid LIMIT 1`,
      [div.id, range.end, bookEnd],
    );
    const limit = next ? next.vid : bookEnd;
    const last = await this.first<{ vid: number | null }>(
      `SELECT MAX(vid) AS vid FROM verse_text WHERE source_id = ? AND vid >= ? AND vid < ?`,
      [sourceId, range.end, limit],
    );
    return {
      start: lead ? lead.vid : bookStart,
      end: Math.max(range.end, last?.vid ?? range.end),
    };
  }

  /** Palavras do texto original no intervalo (corpus 'gnt' ou 'hot' opcional). */
  tokens(range: VerseRange, corpus?: Token['corpus']): Promise<Token[]> {
    const params: SqlParam[] = [range.start, range.end];
    let sql = `SELECT ${TOKEN_COLS} FROM token WHERE vid BETWEEN ? AND ?`;
    if (corpus) {
      sql += ' AND corpus = ?';
      params.push(corpus);
    }
    sql += ' ORDER BY vid, pos';
    return this.all<Token>(sql, params);
  }

  /** Verbetes de léxico para os strong_base dados; mantém a ordem da entrada. */
  async lexicon(strongBases: readonly string[]): Promise<LexiconEntry[]> {
    const bases = [...new Set(strongBases.filter(Boolean))];
    const out: LexiconEntry[] = [];
    for (let i = 0; i < bases.length; i += 200) {
      const chunk = bases.slice(i, i + 200);
      const rows = await this.all<LexiconEntry>(
        `SELECT ${LEXICON_COLS} FROM lexicon_entry WHERE strong_base IN (${placeholders(chunk.length)})
         ORDER BY strong_base, source_id, cite_id`,
        chunk,
      );
      out.push(...rows);
    }
    const rank = new Map(bases.map((b, i) => [b, i] as const));
    return out.sort((a, b) => (rank.get(a.strong_base ?? '') ?? 0) - (rank.get(b.strong_base ?? '') ?? 0));
  }

  /**
   * Concordância de um strong_base: total de versículos com a palavra e até `limit` exemplos
   * do texto `textSourceId`. `exclude` (ex.: o próprio intervalo) não entra nos exemplos, mas não altera o total.
   */
  async concordance(strongBase: string, textSourceId: string, limit: number, exclude?: VerseRange): Promise<Concordance> {
    const countRow = await this.first<CountRow>('SELECT COUNT(DISTINCT vid) AS n FROM token_strong WHERE strong_base = ?', [strongBase]);
    const count = countRow?.n ?? 0;
    if (limit <= 0 || count === 0) return { count, samples: [] };

    const params: SqlParam[] = [textSourceId, strongBase];
    let excl = '';
    if (exclude) {
      excl = ' AND NOT (vid BETWEEN ? AND ?)';
      params.push(exclude.start, exclude.end);
    }
    params.push(limit);
    const samples = await this.all<VerseText>(
      `SELECT v.cite_id, v.source_id, v.vid, v.text FROM verse_text v
       WHERE v.source_id = ? AND v.vid IN (SELECT DISTINCT vid FROM token_strong WHERE strong_base = ?${excl})
       ORDER BY v.vid LIMIT ?`,
      params,
    );
    return { count, samples };
  }

  /** Comentários que se sobrepõem ao intervalo, mais os de introdução do(s) capítulo(s) e livro(s). */
  async commentaries(range: VerseRange): Promise<Commentary[]> {
    const intros = introVids(range);
    // Duas consultas separadas para que o índice idx_com_range seja usado em ambas.
    const [overlap, introRows] = await Promise.all([
      this.all<Commentary>(
        `SELECT ${COMMENTARY_COLS} FROM commentary WHERE start_vid <= ? AND end_vid >= ?`,
        [range.end, range.start],
      ),
      this.all<Commentary>(
        `SELECT ${COMMENTARY_COLS} FROM commentary WHERE start_vid IN (${placeholders(intros.length)})`,
        intros,
      ),
    ]);
    const byId = new Map<string, Commentary>();
    for (const row of [...overlap, ...introRows]) byId.set(row.cite_id, row);
    const cmp = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);
    return [...byId.values()].sort(
      (a, b) => a.start_vid - b.start_vid || cmp(a.source_id, b.source_id) || cmp(a.cite_id, b.cite_id),
    );
  }

  /** Verbetes cujas referências (entry_ref) se sobrepõem ao intervalo, com o tipo da fonte. */
  async dictionaryEntries(range: VerseRange, kinds: readonly DictionaryKind[] = ['dictionary', 'topical']): Promise<DictionaryHit[]> {
    const allowed = kinds.filter((k): k is DictionaryKind => k === 'dictionary' || k === 'topical');
    if (allowed.length === 0) return [];
    return this.all<DictionaryHit>(
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
  bookIntro(book: Pick<Book, 'name_en' | 'name_pt'>): Promise<DictionaryEntry[]> {
    const names = [...new Set([book.name_en, book.name_pt])];
    const conds = [
      ...names.map(() => 'lower(d.headword) = lower(?)'),
      ...names.map(() => 'lower(d.headword) LIKE lower(?)'),
    ];
    const params: SqlParam[] = [...names, ...names.map((n) => `${n},%`)];
    return this.all<DictionaryEntry>(
      `SELECT d.cite_id, d.source_id, d.headword, d.text FROM dictionary_entry d
       JOIN source s ON s.id = d.source_id
       WHERE s.kind = 'dictionary' AND (${conds.join(' OR ')})
       ORDER BY d.headword, d.cite_id`,
      params,
    );
  }

  /** Referências cruzadas com origem no intervalo, por peso decrescente, com o texto dos alvos. */
  async xrefs(range: VerseRange, limit: number, textSourceId: string = DEFAULT_TEXT_SOURCE): Promise<XRefWithTexts[]> {
    if (limit <= 0) return [];
    const rows = await this.all<XRef>(
      `SELECT ${XREF_COLS} FROM xref WHERE from_vid BETWEEN ? AND ?
       ORDER BY (weight IS NULL), weight DESC, cite_id LIMIT ?`,
      [range.start, range.end, limit],
    );
    return Promise.all(
      rows.map(async (x) => ({
        ...x,
        texts: await this.verseTexts(
          textSourceId,
          { start: x.to_start_vid, end: x.to_end_vid },
          MAX_XREF_TARGET_VERSES,
        ),
      })),
    );
  }

  /** Pessoas, lugares e grupos ligados a versículos do intervalo, com o total de referências de cada um. */
  entities(range: VerseRange): Promise<EntityHit[]> {
    return this.all<EntityHit>(
      `SELECT DISTINCT e.cite_id, e.source_id, e.type, e.name, e.description, e.lat, e.lon, e.data,
              (SELECT COUNT(*) FROM entity_ref x WHERE x.entity_cite_id = e.cite_id) AS total_refs
       FROM entity_ref r JOIN entity e ON e.cite_id = r.entity_cite_id
       WHERE r.vid BETWEEN ? AND ?
       ORDER BY e.name, e.cite_id`,
      [range.start, range.end],
    );
  }

  /**
   * Lugares com coordenadas ligados a versículos do intervalo: uma linha por (lugar, versículo).
   * Usado pelos mapas (passagem, selecao, perícope, livro). `data` traz a identificação da fonte.
   */
  placesInRange(range: VerseRange): Promise<PlaceVerseHit[]> {
    return this.all<PlaceVerseHit>(
      `SELECT DISTINCT e.cite_id, e.source_id, e.type, e.name, e.description, e.lat, e.lon, e.data, r.vid AS vid
       FROM entity_ref r JOIN entity e ON e.cite_id = r.entity_cite_id
       WHERE e.type = 'place' AND e.lat IS NOT NULL AND e.lon IS NOT NULL AND r.vid BETWEEN ? AND ?
       ORDER BY e.name, e.cite_id, r.vid`,
      [range.start, range.end],
    );
  }

  /**
   * Linha do tempo: eventos (entity.type='event') com algum versículo no intervalo, em ordem cronológica (sortKey),
   * mais até 2 eventos de contexto antes e 2 depois na cronologia global (inRange=false), para situar o trecho.
   * Sem eventos no intervalo, devolve lista vazia (sem contexto). Banco sem eventos (ex.: o leitor) também dá vazia.
   */
  async timelineEvents(range: VerseRange): Promise<TimelineEvent[]> {
    const inRange = await this.all<EventRow>(
      `${EVENT_SELECT} WHERE e.type = 'event'
         AND e.cite_id IN (SELECT entity_cite_id FROM entity_ref WHERE vid BETWEEN ? AND ?)`,
      [range.start, range.end],
    );
    const events = inRange
      .map((row) => timelineEventOf(row))
      .filter((e): e is TimelineLineEvent => e !== null)
      .map((e) => ({ ...e, inRange: true }));
    if (events.length === 0) return [];

    const lo = Math.min(...events.map((e) => e.sortKey));
    const hi = Math.max(...events.map((e) => e.sortKey));
    // CASE (e não AND) porque json_extract falha em JSON inválido: a guarda precisa ser avaliada antes.
    const key = TIMELINE_KEY;
    const [before, after] = await Promise.all([
      this.all<EventRow>(
        `${EVENT_SELECT} WHERE e.type = 'event' AND ${key} < ? ORDER BY ${key} DESC, e.cite_id DESC LIMIT ?`,
        [lo, TIMELINE_CONTEXT],
      ),
      this.all<EventRow>(
        `${EVENT_SELECT} WHERE e.type = 'event' AND ${key} > ? ORDER BY ${key}, e.cite_id LIMIT ?`,
        [hi, TIMELINE_CONTEXT],
      ),
    ]);
    const context = [...before, ...after]
      .map((row) => timelineEventOf(row))
      .filter((e): e is TimelineLineEvent => e !== null)
      .map((e) => ({ ...e, inRange: false }));
    return [...events, ...context].sort(bySortKey);
  }

  /** Linhas do tempo da cronologia completa: períodos, pessoas e lugares com ao menos um evento, mais frequentes primeiro. */
  timelineLines(): Promise<TimelineLine[]> {
    return this.timelineLinesWhere([]).then((rows) => rows.map(lineOf));
  }

  /** Agregado das linhas (ver timelineLines), com filtro opcional pelo nome: a base da lista e da busca. */
  private timelineLinesWhere(nameTerms: readonly string[]): Promise<MemberRow[]> {
    const m = timelineMembers(nameTerms);
    return this.all<MemberRow>(
      `${m.sql},
       ev AS (SELECT e.cite_id, ${TIMELINE_KEY} AS sk FROM entity e WHERE e.type = 'event')
       SELECT m.kind, m.line_id AS id, MAX(m.line_name) AS name, COUNT(DISTINCT m.event_id) AS n, MIN(ev.sk) AS lo, MAX(ev.sk) AS hi
         FROM memb m JOIN ev ON ev.cite_id = m.event_id AND ev.sk IS NOT NULL
        GROUP BY m.kind, m.line_id
        ORDER BY n DESC, name, m.line_id`,
      m.params,
    );
  }

  /**
   * Eventos de uma linha do tempo (id = TimelineLine.id), em ordem de sortKey, com participantes e o primeiro e o
   * último versículo do evento. Linha inexistente devolve lista vazia.
   */
  async timelineLineEvents(lineId: string): Promise<TimelineLineEvent[]> {
    const m = timelineMembers();
    const rows = await this.all<EventRow>(
      `${m.sql} ${EVENT_SELECT}
        WHERE e.type = 'event' AND e.cite_id IN (SELECT event_id FROM memb WHERE line_id = ?)`,
      [...m.params, lineId],
    );
    return rows
      .map((row) => timelineEventOf(row))
      .filter((e): e is TimelineLineEvent => e !== null)
      .sort(bySortKey);
  }

  /** Um evento pelo cite_id (ex.: o evento do trecho, para abrir a cronologia nele). Null se não for evento válido. */
  async timelineEvent(citeId: string): Promise<TimelineLineEvent | null> {
    const row = await this.first<EventRow>(`${EVENT_SELECT} WHERE e.type = 'event' AND e.cite_id = ?`, [citeId]);
    return row ? timelineEventOf(row) : null;
  }

  /**
   * Linhas do tempo em que cada evento aparece (chave: cite_id do evento). Eventos sem linha não entram no mapa.
   * Usado na prévia ("Também em") e na busca.
   */
  async timelineMemberships(eventIds: readonly string[]): Promise<Map<string, TimelineLineRef[]>> {
    const out = new Map<string, TimelineLineRef[]>();
    for (const part of chunks([...new Set(eventIds)], 400)) {
      const m = timelineMembers();
      const rows = await this.all<{ event_id: string; kind: TimelineLine['kind']; id: string; name: string }>(
        `${m.sql}
         SELECT DISTINCT m.event_id, m.kind, m.line_id AS id, m.line_name AS name
           FROM memb m WHERE m.event_id IN (${part.map(() => '?').join(', ')})
          ORDER BY m.kind, m.line_name`,
        [...m.params, ...part],
      );
      for (const r of rows) {
        const list = out.get(r.event_id) ?? [];
        list.push({ id: r.id, kind: r.kind, name: r.name });
        out.set(r.event_id, list);
      }
    }
    return out;
  }

  /**
   * Busca na cronologia completa. Linhas: nome da linha casa com um termo (ver searchTerms). Eventos: título casa
   * com um termo. Termos em português viram os termos em inglês da fonte. Busca vazia devolve nada.
   */
  async timelineSearch(query: string): Promise<TimelineSearchResult> {
    const terms = searchTerms(query);
    if (terms.length === 0) return { lines: [], events: [] };
    const lines = (await this.timelineLinesWhere(terms)).map(lineOf);
    const match = terms.map(() => `instr(lower(${TIMELINE_TITLE}), ?) > 0`).join(' OR ');
    const rows = await this.all<EventRow>(`${EVENT_SELECT} WHERE e.type = 'event' AND (${match})`, terms);
    const events = rows.map((row) => timelineEventOf(row)).filter((e): e is TimelineLineEvent => e !== null).sort(bySortKey);
    const memberships = await this.timelineMemberships(events.map((e) => e.cite_id));
    return {
      lines,
      events: events.map((e) => ({ ...e, lines: memberships.get(e.cite_id) ?? [] })),
    };
  }

  /**
   * Linhas do tempo para o seletor "+ Linha": nome da linha casa com um termo (ver searchTerms), no máximo `limit`.
   * Ordem: nome que começa com a busca primeiro, depois mais eventos. O filtro roda no banco (a cronologia tem
   * milhares de linhas); só o recorte volta. Busca vazia devolve lista vazia.
   */
  async timelineSearchLines(query: string, limit = 30): Promise<TimelineLine[]> {
    const terms = searchTerms(query);
    if (terms.length === 0) return [];
    // Relevância pelo melhor termo (o texto digitado ou o equivalente em inglês): igual, começa com, palavra começa com.
    const rankOf = (name: string, q: string): number => {
      const n = normalizeSearch(name);
      if (n === q) return 0;
      if (n.startsWith(q)) return 1;
      if (n.split(/[\s(,-]+/).some((w) => w.startsWith(q))) return 2;
      return 3;
    };
    const rows = await this.timelineLinesWhere(terms);
    return rows
      .map((row) => ({ line: lineOf(row), rank: Math.min(...terms.map((t) => rankOf(row.name, t))) }))
      .sort((a, b) => a.rank - b.rank || b.line.count - a.line.count || (a.line.name < b.line.name ? -1 : a.line.name > b.line.name ? 1 : 0))
      .slice(0, Math.max(0, limit))
      .map((r) => r.line);
  }

  /** Posições cronológicas (sortKey) de todos os eventos; base da densidade do paralelo. */
  async timelineSortKeys(): Promise<number[]> {
    const rows = await this.all<{ sk: number | null }>(`SELECT ${TIMELINE_KEY} AS sk FROM entity e WHERE e.type = 'event'`);
    return rows.map((r) => r.sk).filter((k): k is number => typeof k === 'number');
  }

  /** Resumo da Bíblia inteira por era: contagem de eventos e histograma de densidade (ver TIMELINE_ERAS). */
  async timelineSummary(): Promise<TimelineSummary> {
    const keys = await this.timelineSortKeys();
    return { total: keys.length, eras: eraSummaries(keys) };
  }

  /** Resolve um cite_id ao registro de origem. Retorna null se o prefixo ou o id não existir. */
  async resolveCite(citeId: string): Promise<CitableRecord | null> {
    const colon = citeId.indexOf(':');
    if (colon <= 0) return null;
    switch (citeId.slice(0, colon)) {
      // txt/tok: cite_id é derivado nas views (pipeline/schema_physical.sql), então a busca vai pela chave
      // (source/vid, vid/pos) e o cite_id só confirma o registro. Sem isso, a view varreria a tabela.
      case 'txt': {
        const m = /^txt:(.+):(\d+)$/.exec(citeId);
        if (!m) return null;
        const record = await this.first<VerseText>(
          `SELECT ${VERSE_COLS} FROM verse_text WHERE source_id = ? AND vid = ? AND cite_id = ?`,
          [m[1]!, Number(m[2]), citeId],
        );
        return record ? { table: 'verse_text', record } : null;
      }
      case 'tok': {
        const m = /^tok:(?:gnt|hot):(\d+):(\d+)$/.exec(citeId);
        if (!m) return null;
        const record = await this.first<Token>(
          `SELECT ${TOKEN_COLS} FROM token WHERE vid = ? AND pos = ? AND cite_id = ?`,
          [Number(m[1]), Number(m[2]), citeId],
        );
        return record ? { table: 'token', record } : null;
      }
      case 'lex': {
        const record = await this.first<LexiconEntry>(`SELECT ${LEXICON_COLS} FROM lexicon_entry WHERE cite_id = ?`, [citeId]);
        return record ? { table: 'lexicon_entry', record } : null;
      }
      case 'com': {
        const record = await this.first<Commentary>(`SELECT ${COMMENTARY_COLS} FROM commentary WHERE cite_id = ?`, [citeId]);
        return record ? { table: 'commentary', record } : null;
      }
      case 'dic': {
        const record = await this.first<DictionaryEntry>(`SELECT ${DICTIONARY_COLS} FROM dictionary_entry WHERE cite_id = ?`, [citeId]);
        return record ? { table: 'dictionary_entry', record } : null;
      }
      // xr: cite_id é derivado na view (pipeline/schema_physical.sql); a busca vai pela chave da tabela.
      case 'xr': {
        const m = /^xr:([^:]+):(\d+):(\d+)-(\d+)$/.exec(citeId);
        if (!m) return null;
        const record = await this.first<XRef>(
          `SELECT ${XREF_COLS} FROM xref WHERE from_vid = ? AND source_id = ? AND to_start_vid = ? AND to_end_vid = ? AND cite_id = ?`,
          [Number(m[2]), m[1]!, Number(m[3]), Number(m[4]), citeId],
        );
        return record ? { table: 'xref', record } : null;
      }
      case 'ent': {
        const record = await this.first<Entity>(`SELECT ${ENTITY_COLS} FROM entity WHERE cite_id = ?`, [citeId]);
        return record ? { table: 'entity', record } : null;
      }
      default:
        return null;
    }
  }
}

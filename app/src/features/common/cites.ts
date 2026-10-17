// Resolução de cite_ids para prévias e painéis: registro + fonte + rótulos, com cache por Repo.
// Usa só a API pública do Repo (resolveCite, lexicon, concordance, entities, verseTexts).
import {
  commentatorOf,
  DEFAULT_TEXT_SOURCE,
  formatShortRef,
  sourceShort,
  splitVid,
  titleCaseHeadword,
  LAST_VERSE,
  type Book,
  type CitableRecord,
  type LexiconEntry,
  type Repo,
  type Source,
  type VerseText,
  type Vid,
} from '@sensus/core';
import { sourceTypeOf, type SourceTypeColors } from '@/design';
import { loadSources } from '@/data/sources';
import { serial } from '@/data/serial';
import { SRC } from './strings';

export type CiteKind = keyof SourceTypeColors;

export interface CiteDetail {
  citeId: string;
  record: CitableRecord;
  source: Source | undefined;
  kind: CiteKind;
  /** Rótulo da marca de tipo ("Comentário", "Índice temático"...). */
  typeLabel: string;
  /** Nome curto ("Calvino Fp 1:30", "Bíblia Livre Fp 1:30", "Filipos"). Para tokens, a palavra grega. */
  label: string;
  /** Complemento do rótulo de token ("Fp 1:1"), vazio nos demais. */
  labelRef: string;
  /** Texto do registro (versículo, comentário, verbete, definição, descrição). */
  text: string;
  /** Versículo a mostrar no texto do leitor (null: o tipo não tem versículo). */
  vid: Vid | null;
  /** Referências para chips (versículos/intervalos citados pelo registro). */
  ranges: { start: Vid; end: Vid }[];
}

// A fila de consultas e o registro de fontes moraram aqui; agora são da camada de dados. Reexportados para
// quem já importa daqui.
export { serial } from '@/data/serial';
export { loadSources } from '@/data/sources';

// ---- caches por repo ---------------------------------------------------------------------

interface RepoCache {
  books?: Promise<Book[]>;
  cites: Map<string, Promise<CiteDetail | null>>;
  lexicon: Map<string, Promise<LexiconEntry[]>>;
  concordance: Map<string, Promise<{ count: number; vids: Vid[] }>>;
  passages: Map<string, Promise<Vid[]>>;
}
const caches = new WeakMap<Repo, RepoCache>();
function cacheOf(repo: Repo): RepoCache {
  let c = caches.get(repo);
  if (!c) {
    c = { cites: new Map(), lexicon: new Map(), concordance: new Map(), passages: new Map() };
    caches.set(repo, c);
  }
  return c;
}

export function loadBooks(repo: Repo): Promise<Book[]> {
  const c = cacheOf(repo);
  return (c.books ??= serial(() => repo.books()));
}

function wordOf(surface: string): string {
  return surface.normalize('NFC').replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '');
}

function build(record: CitableRecord, citeId: string, source: Source | undefined, books: Book[]): CiteDetail {
  const kind = sourceTypeOf(citeId);
  const base = { citeId, record, source, kind, labelRef: '', ranges: [] as CiteDetail['ranges'] };
  switch (record.table) {
    case 'verse_text': {
      const r = record.record;
      return {
        ...base,
        typeLabel: SRC.typeLabels.txt,
        label: `${sourceShort(r.source_id, source?.title)} ${formatShortRef(r.vid, r.vid, books, true)}`,
        text: r.text,
        vid: r.vid,
        ranges: [{ start: r.vid, end: r.vid }],
      };
    }
    case 'token': {
      const r = record.record;
      return {
        ...base,
        typeLabel: SRC.typeLabels.tok,
        label: wordOf(r.surface),
        labelRef: formatShortRef(r.vid, r.vid, books, true),
        text: r.surface,
        vid: r.vid,
        ranges: [{ start: r.vid, end: r.vid }],
      };
    }
    case 'lexicon_entry': {
      const r = record.record;
      return {
        ...base,
        typeLabel: SRC.typeLabels.lex,
        label: `${sourceShort(r.source_id, source?.title)} ${r.lemma ?? r.key}`,
        text: [r.gloss, r.definition].filter(Boolean).join(' — '),
        vid: null,
      };
    }
    case 'commentary': {
      const r = record.record;
      const ref = formatShortRef(r.start_vid, r.end_vid, books, true);
      const intro = splitVid(r.start_vid).verse === 0;
      return {
        ...base,
        typeLabel: SRC.typeLabels.com,
        label: `${commentatorOf(source, r)} ${ref}`,
        text: r.text,
        vid: intro ? null : r.start_vid,
        ranges: [{ start: r.start_vid, end: r.end_vid }],
      };
    }
    case 'dictionary_entry': {
      const r = record.record;
      return {
        ...base,
        typeLabel: source?.kind === 'topical' ? SRC.typeLabels.topic : SRC.typeLabels.dic,
        label: titleCaseHeadword(r.headword),
        text: r.text,
        vid: null,
      };
    }
    case 'xref': {
      const r = record.record;
      return {
        ...base,
        typeLabel: SRC.typeLabels.xr,
        label: formatShortRef(r.to_start_vid, r.to_end_vid, books, true),
        text: '',
        vid: r.from_vid,
        ranges: [
          { start: r.from_vid, end: r.from_vid },
          { start: r.to_start_vid, end: r.to_end_vid },
        ],
      };
    }
    case 'entity': {
      const r = record.record;
      return {
        ...base,
        typeLabel: SRC.entityTypes[r.type] ?? SRC.typeLabels.ent,
        label: r.name,
        text: r.description ?? '',
        vid: null,
      };
    }
  }
}

/** Registro, fonte e rótulos de um cite_id; null se o id não existe no banco (citação inválida). */
export function loadCite(repo: Repo, citeId: string): Promise<CiteDetail | null> {
  const c = cacheOf(repo);
  let p = c.cites.get(citeId);
  if (!p) {
    p = (async () => {
      const [record, sources, books] = await Promise.all([serial(() => repo.resolveCite(citeId)), loadSources(repo), loadBooks(repo)]);
      if (!record) return null;
      return build(record, citeId, sources.get(record.record.source_id), books);
    })();
    // Falha de leitura não fica em cache.
    p.catch(() => c.cites.delete(citeId));
    c.cites.set(citeId, p);
  }
  return p;
}

/** Verbetes do léxico de um strong_base (TBESG + LSJ, uma linha por variante de sentido). */
export function loadLexicon(repo: Repo, strongBase: string): Promise<LexiconEntry[]> {
  const c = cacheOf(repo);
  let p = c.lexicon.get(strongBase);
  if (!p) {
    p = serial(() => repo.lexicon([strongBase]));
    p.catch(() => c.lexicon.delete(strongBase));
    c.lexicon.set(strongBase, p);
  }
  return p;
}

export { pickLexicon, type LexiconPair } from './lexicon-pick';

const CONCORDANCE_LIMIT = 80;

/** Total de versículos com a palavra (NT para G…, AT para H…) e até 80 deles (ordem do texto). */
export function loadConcordance(repo: Repo, strongBase: string): Promise<{ count: number; vids: Vid[] }> {
  const c = cacheOf(repo);
  let p = c.concordance.get(strongBase);
  if (!p) {
    p = serial(() => repo.concordance(strongBase, DEFAULT_TEXT_SOURCE, CONCORDANCE_LIMIT))
      .then((r) => ({ count: r.count, vids: r.samples.map((s) => s.vid) }));
    p.catch(() => c.concordance.delete(strongBase));
    c.concordance.set(strongBase, p);
  }
  return p;
}

/** Texto do destino de uma referência cruzada (até 12 versículos, juntos). */
export async function loadXrefText(repo: Repo, start: Vid, end: Vid): Promise<VerseText[]> {
  return serial(() => repo.verseTexts(DEFAULT_TEXT_SOURCE, { start, end }, 12));
}

/**
 * Passagens em que uma entidade aparece (entity_ref). O Repo não expõe essa consulta, então varre por
 * intervalos com repo.entities: livros → capítulos → versículos, descendo só onde há ocorrência.
 */
export function loadEntityPassages(repo: Repo, citeId: string): Promise<Vid[]> {
  const c = cacheOf(repo);
  let p = c.passages.get(citeId);
  if (!p) {
    p = scanEntity(repo, citeId);
    p.catch(() => c.passages.delete(citeId));
    c.passages.set(citeId, p);
  }
  return p;
}

async function scanEntity(repo: Repo, citeId: string): Promise<Vid[]> {
  const has = async (start: Vid, end: Vid): Promise<boolean> =>
    (await serial(() => repo.entities({ start, end }))).some((e) => e.cite_id === citeId);
  // Bisseção: desce só nas metades que ainda contêm a entidade.
  const bisect = async (lo: Vid, hi: Vid, out: Vid[]): Promise<void> => {
    if (lo === hi) {
      out.push(lo);
      return;
    }
    const mid = Math.floor((lo + hi) / 2);
    if (await has(lo, mid)) await bisect(lo, mid, out);
    if (await has(mid + 1, hi)) await bisect(mid + 1, hi, out);
  };
  const books = await loadBooks(repo);
  const out: Vid[] = [];
  for (const b of books) {
    const base = b.num * 1_000_000;
    if (!(await has(base, base + 999_999))) continue;
    for (let ch = 1; ch <= b.chapters; ch++) {
      const start = base + ch * 1000;
      if (await has(start, start + LAST_VERSE)) await bisect(start, start + LAST_VERSE, out);
    }
  }
  return out.sort((a, b) => a - b);
}

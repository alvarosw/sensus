// Ids de versículo (vid), nomes de livros e referências bíblicas em pt-BR.
import { LAST_VERSE, MAX_BOOK, packVid, unpackVid } from './domain/vid';
import type { Book, Vid, VerseRange } from './types';

/** Último número de versículo ("capítulo inteiro", ex.: makeVid(b, c, LAST_VERSE)) e último livro: valores no domínio. */
export { LAST_VERSE, MAX_BOOK };

/** Livros por número (mapa) ou em lista (ex.: resultado de `repo.books()`). */
export type BookSource = ReadonlyMap<number, Book> | readonly Book[];

type BookRow = readonly [number, string, string, string, 'OT' | 'NT', number, string];

// Espelha pipeline/sensus/refs.py: num, osis, nome pt, nome en, testamento, capítulos, abreviações extras.
const BOOK_ROWS: readonly BookRow[] = [
  [1, 'Gen', 'Gênesis', 'Genesis', 'OT', 50, 'GEN Gn Ge'],
  [2, 'Exod', 'Êxodo', 'Exodus', 'OT', 40, 'EXO Exo Ex'],
  [3, 'Lev', 'Levítico', 'Leviticus', 'OT', 27, 'LEV Lv Le'],
  [4, 'Num', 'Números', 'Numbers', 'OT', 36, 'NUM Nm Nu'],
  [5, 'Deut', 'Deuteronômio', 'Deuteronomy', 'OT', 34, 'DEU Dt De'],
  [6, 'Josh', 'Josué', 'Joshua', 'OT', 24, 'JOS Js'],
  [7, 'Judg', 'Juízes', 'Judges', 'OT', 21, 'JDG Jdg Jz Jg'],
  [8, 'Ruth', 'Rute', 'Ruth', 'OT', 4, 'RUT Rt Ru'],
  [9, '1Sam', '1 Samuel', '1 Samuel', 'OT', 31, '1SA 1Sm 1S'],
  [10, '2Sam', '2 Samuel', '2 Samuel', 'OT', 24, '2SA 2Sm 2S'],
  [11, '1Kgs', '1 Reis', '1 Kings', 'OT', 22, '1KI 1Rs 1Ki 1Kg'],
  [12, '2Kgs', '2 Reis', '2 Kings', 'OT', 25, '2KI 2Rs 2Ki 2Kg'],
  [13, '1Chr', '1 Crônicas', '1 Chronicles', 'OT', 29, '1CH 1Cr 1Ch'],
  [14, '2Chr', '2 Crônicas', '2 Chronicles', 'OT', 36, '2CH 2Cr 2Ch'],
  [15, 'Ezra', 'Esdras', 'Ezra', 'OT', 10, 'EZR Ed Ezr'],
  [16, 'Neh', 'Neemias', 'Nehemiah', 'OT', 13, 'NEH Ne'],
  [17, 'Esth', 'Ester', 'Esther', 'OT', 10, 'EST Et Es'],
  [18, 'Job', 'Jó', 'Job', 'OT', 42, 'JOB Jb'],
  [19, 'Ps', 'Salmos', 'Psalms', 'OT', 150, 'PSA Sl Psalm Pss'],
  [20, 'Prov', 'Provérbios', 'Proverbs', 'OT', 31, 'PRO Pv Pr Prv'],
  [21, 'Eccl', 'Eclesiastes', 'Ecclesiastes', 'OT', 12, 'ECC Ec Ecc Qoh'],
  [22, 'Song', 'Cantares', 'Song of Solomon', 'OT', 8, 'SNG Ct Sng Sol SoS Cant CantaresdeSalomao SongofSongs'],
  [23, 'Isa', 'Isaías', 'Isaiah', 'OT', 66, 'ISA Is'],
  [24, 'Jer', 'Jeremias', 'Jeremiah', 'OT', 52, 'JER Jr'],
  [25, 'Lam', 'Lamentações', 'Lamentations', 'OT', 5, 'LAM Lm La'],
  [26, 'Ezek', 'Ezequiel', 'Ezekiel', 'OT', 48, 'EZK Ez Eze Ezk'],
  [27, 'Dan', 'Daniel', 'Daniel', 'OT', 12, 'DAN Dn Da'],
  [28, 'Hos', 'Oseias', 'Hosea', 'OT', 14, 'HOS Os Ho Oséias'],
  [29, 'Joel', 'Joel', 'Joel', 'OT', 3, 'JOL Jl Jol'],
  [30, 'Amos', 'Amós', 'Amos', 'OT', 9, 'AMO Am'],
  [31, 'Obad', 'Obadias', 'Obadiah', 'OT', 1, 'OBA Ob Obd Abdias'],
  [32, 'Jonah', 'Jonas', 'Jonah', 'OT', 4, 'JON Jnh'],
  [33, 'Mic', 'Miqueias', 'Micah', 'OT', 7, 'MIC Mq Mi Miquéias'],
  [34, 'Nah', 'Naum', 'Nahum', 'OT', 3, 'NAM Na Nam'],
  [35, 'Hab', 'Habacuque', 'Habakkuk', 'OT', 3, 'HAB Hc'],
  [36, 'Zeph', 'Sofonias', 'Zephaniah', 'OT', 3, 'ZEP Sf Zep'],
  [37, 'Hag', 'Ageu', 'Haggai', 'OT', 2, 'HAG Ag'],
  [38, 'Zech', 'Zacarias', 'Zechariah', 'OT', 14, 'ZEC Zc Zec'],
  [39, 'Mal', 'Malaquias', 'Malachi', 'OT', 4, 'MAL Ml'],
  [40, 'Matt', 'Mateus', 'Matthew', 'NT', 28, 'MAT Mt'],
  [41, 'Mark', 'Marcos', 'Mark', 'NT', 16, 'MRK Mc Mk Mrk Mar'],
  [42, 'Luke', 'Lucas', 'Luke', 'NT', 24, 'LUK Lc Lk Luk'],
  [43, 'John', 'João', 'John', 'NT', 21, 'JHN Jhn Joh Jn'],
  [44, 'Acts', 'Atos', 'Acts', 'NT', 28, 'ACT At Ac Act'],
  [45, 'Rom', 'Romanos', 'Romans', 'NT', 16, 'ROM Rm Ro'],
  [46, '1Cor', '1 Coríntios', '1 Corinthians', 'NT', 16, '1CO 1Co'],
  [47, '2Cor', '2 Coríntios', '2 Corinthians', 'NT', 13, '2CO 2Co'],
  [48, 'Gal', 'Gálatas', 'Galatians', 'NT', 6, 'GAL Gl Ga'],
  [49, 'Eph', 'Efésios', 'Ephesians', 'NT', 6, 'EPH Ef'],
  [50, 'Phil', 'Filipenses', 'Philippians', 'NT', 4, 'PHP Fp Php Phl Flp'],
  [51, 'Col', 'Colossenses', 'Colossians', 'NT', 4, 'COL Cl'],
  [52, '1Thess', '1 Tessalonicenses', '1 Thessalonians', 'NT', 5, '1TH 1Ts 1Th'],
  [53, '2Thess', '2 Tessalonicenses', '2 Thessalonians', 'NT', 3, '2TH 2Ts 2Th'],
  [54, '1Tim', '1 Timóteo', '1 Timothy', 'NT', 6, '1TI 1Tm 1Ti'],
  [55, '2Tim', '2 Timóteo', '2 Timothy', 'NT', 4, '2TI 2Tm 2Ti'],
  [56, 'Titus', 'Tito', 'Titus', 'NT', 3, 'TIT Tt Tit'],
  [57, 'Phlm', 'Filemom', 'Philemon', 'NT', 1, 'PHM Fm Phm Flm'],
  [58, 'Heb', 'Hebreus', 'Hebrews', 'NT', 13, 'HEB Hb'],
  [59, 'Jas', 'Tiago', 'James', 'NT', 5, 'JAS Tg Jm'],
  [60, '1Pet', '1 Pedro', '1 Peter', 'NT', 5, '1PE 1Pe 1Pd'],
  [61, '2Pet', '2 Pedro', '2 Peter', 'NT', 3, '2PE 2Pe 2Pd'],
  [62, '1John', '1 João', '1 John', 'NT', 5, '1JN 1Jo 1Jn'],
  [63, '2John', '2 João', '2 John', 'NT', 1, '2JN 2Jo 2Jn'],
  [64, '3John', '3 João', '3 John', 'NT', 1, '3JN 3Jo 3Jn'],
  [65, 'Jude', 'Judas', 'Jude', 'NT', 1, 'JUD Jd Jud'],
  [66, 'Rev', 'Apocalipse', 'Revelation', 'NT', 22, 'REV Ap Re Rv Revelationofjohn'],
];

/** Tabela de livros embutida (mesmos dados de schema `book`), usada como padrão. */
export const BOOK_TABLE: readonly Book[] = BOOK_ROWS.map(([num, osis, name_pt, name_en, testament, chapters]) => ({
  num,
  osis,
  name_pt,
  name_en,
  testament,
  chapters,
}));

const EXTRA_ALIASES: ReadonlyMap<number, readonly string[]> = new Map(
  BOOK_ROWS.map((row): [number, string[]] => [row[0], row[6].split(' ')]),
);

// ---- vid -----------------------------------------------------------------------

export interface VidParts {
  book: number;
  chapter: number;
  verse: number;
}

/** Livro, capítulo e versículo num vid (aritmética em domain/vid.ts). Versículo 0 = introdução do capítulo/livro. */
export function makeVid(book: number, chapter: number, verse: number): Vid {
  return packVid(book, chapter, verse);
}

export function splitVid(vid: Vid): VidParts {
  return unpackVid(vid);
}

export function chapterRange(book: number, chapter: number): VerseRange {
  return { start: makeVid(book, chapter, 1), end: makeVid(book, chapter, LAST_VERSE) };
}

export function bookRange(book: number, books: BookSource = BOOK_TABLE): VerseRange {
  const info = bookMap(books).get(book);
  if (!info) throw new RangeError(`livro desconhecido: ${book}`);
  return { start: makeVid(book, 1, 1), end: makeVid(book, info.chapters, LAST_VERSE) };
}

// ---- nomes ---------------------------------------------------------------------

function bookMap(books: BookSource): ReadonlyMap<number, Book> {
  if (books instanceof Map) return books as ReadonlyMap<number, Book>;
  return new Map((books as readonly Book[]).map((b) => [b.num, b] as const));
}

/** Chave de comparação: sem acentos, minúsculas, numerais romanos viram arábicos, só [a-z0-9]. */
export function normalizeKey(text: string): string {
  let s = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  s = s.replace(/^iii\s+/, '3').replace(/^ii\s+/, '2').replace(/^i\s+/, '1');
  s = s.replace(/^first\s+/, '1').replace(/^second\s+/, '2').replace(/^third\s+/, '3');
  return s.replace(/[^a-z0-9]/g, '');
}

function bookKeys(b: Book): string[] {
  return [b.osis, b.name_pt, b.name_en, ...(EXTRA_ALIASES.get(b.num) ?? [])].map(normalizeKey);
}

/** Resolve "Phil", "Filipenses", "1 João", "I Jo", "Fp"... para o livro. Prefixo único (>= 3 letras) também vale. */
export function resolveBook(name: string, books: BookSource = BOOK_TABLE): Book | null {
  const key = normalizeKey(name);
  if (!key) return null;
  const list = [...bookMap(books).values()];
  const exact = list.find((b) => bookKeys(b).includes(key));
  if (exact) return exact;
  if (key.length < 3) return null;
  const hits = list.filter((b) => [b.name_pt, b.name_en].some((n) => normalizeKey(n).startsWith(key)));
  return hits.length === 1 ? (hits[0] ?? null) : null;
}

function pointLabel(p: VidParts, name: string): string {
  return p.verse === 0 ? `${name} ${p.chapter}` : `${name} ${p.chapter}:${p.verse}`;
}

/**
 * Formata um intervalo em pt-BR: "Filipenses 2:5-8", "Filipenses 2:5-3:1", "Filipenses 2",
 * "Filipenses 2-3", "Filipenses" (livro inteiro), "Filipenses 2:5 - Colossenses 1:1".
 */
export function formatReference(range: VerseRange, books: BookSource = BOOK_TABLE): string {
  const map = bookMap(books);
  const nameOf = (num: number): string => map.get(num)?.name_pt ?? `Livro ${num}`;
  const s = splitVid(range.start);
  const e = splitVid(range.end);

  if (s.book !== e.book) {
    return `${pointLabel(s, nameOf(s.book))} - ${pointLabel(e, nameOf(e.book))}`;
  }

  const name = nameOf(s.book);
  const lastChapter = map.get(s.book)?.chapters ?? LAST_VERSE;
  const wholeStart = s.verse <= 1;
  const wholeEnd = e.verse >= LAST_VERSE;

  if (s.chapter === 1 && wholeStart && wholeEnd && e.chapter >= lastChapter) return name;

  if (s.chapter === e.chapter) {
    if (s.verse === 0 && e.verse === 0) return `${name} ${s.chapter} (introdução)`;
    if (wholeStart && wholeEnd) return `${name} ${s.chapter}`;
    if (s.verse === e.verse) return `${name} ${s.chapter}:${s.verse}`;
    return `${name} ${s.chapter}:${Math.max(s.verse, 1)}-${e.verse}`;
  }

  if (wholeStart && wholeEnd) return `${name} ${s.chapter}-${e.chapter}`;
  const endPart = wholeEnd ? `${e.chapter}` : `${e.chapter}:${e.verse}`;
  return `${name} ${s.chapter}:${Math.max(s.verse, 1)}-${endPart}`;
}

/** Um único versículo: "Filipenses 2:5". */
export function formatVerse(vid: Vid, books: BookSource = BOOK_TABLE): string {
  return formatReference({ start: vid, end: vid }, books);
}

// ---- parsing -------------------------------------------------------------------

// Aceita "Phil 2:5-8", "Fp 2.5", "Phil 2", "Phil 2-3", "Phil 2:5-3:1", "1 João 3:16".
const REF_RE = /^\s*(.*?[^\d\s.,:-])\s*[.,]?\s*(\d{1,3})(?:\s*[:.]\s*(\d{1,3}))?(?:\s*[-–—]\s*(?:(\d{1,3})\s*[:.]\s*)?(\d{1,3}))?\s*$/u;

/** Converte texto de referência em intervalo. Retorna null se não reconhecer o livro ou o intervalo. */
export function parseRef(input: string, books: BookSource = BOOK_TABLE): VerseRange | null {
  const m = REF_RE.exec(input);
  if (!m) return null;
  const book = resolveBook(m[1] ?? '', books);
  if (!book) return null;

  const chapter = Number(m[2]);
  if (chapter < 1 || chapter > book.chapters) return null;
  const verse = m[3] === undefined ? undefined : Number(m[3]);
  const hasDash = m[5] !== undefined;

  if (!hasDash) {
    if (verse === undefined) return chapterRange(book.num, chapter);
    const v = makeVid(book.num, chapter, verse);
    return { start: v, end: v };
  }

  const endNum = Number(m[5]);
  let endChapter: number;
  let endVerse: number;
  if (m[4] !== undefined) {
    endChapter = Number(m[4]);
    endVerse = endNum;
  } else if (verse !== undefined) {
    endChapter = chapter;
    endVerse = endNum;
  } else {
    endChapter = endNum;
    endVerse = LAST_VERSE;
  }
  if (endChapter < chapter || endChapter > book.chapters) return null;

  const start = makeVid(book.num, chapter, verse ?? 1);
  const end = makeVid(book.num, endChapter, endVerse);
  return end < start ? null : { start, end };
}

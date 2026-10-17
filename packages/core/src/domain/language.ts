// Língua, corpus e testamento: a fonte única para "grego ou hebraico?" e "NT ou AT?".
// Só importa de ../types e ../refs (regra de camadas, tests/architecture.test.ts).
import { BOOK_TABLE, splitVid } from '../refs';
import type { Token, VerseRange, Vid } from '../types';
import { LAST_VERSE, bookStartVid, packVid } from './vid';

export type Lang = 'grc' | 'hbo' | 'arc';
export type Corpus = 'gnt' | 'hot';
export type Testament = 'OT' | 'NT';

export interface CorpusSpec {
  testament: Testament;
  /** Línguas em que o corpus está escrito. */
  langs: readonly Lang[];
  /** Ingestor que gera a tabela de tokens (morfologia). */
  tokensSource: 'tagnt' | 'tahot';
  /** Edições-base do texto original. Mais de uma edição-base = há variantes textuais entre elas. */
  baseEditions: readonly string[];
  /** Edição que define o texto-base da passagem (palavra fora dela não entra). null = o corpus inteiro é texto-base. */
  textEdition: string | null;
  /** Id da fonte de texto interlinear do leitor. */
  interlinearText: string;
}

export const CORPUS: Record<Corpus, CorpusSpec> = {
  gnt: {
    testament: 'NT',
    langs: ['grc'],
    tokensSource: 'tagnt',
    baseEditions: ['TR', 'BYZ', 'NA'],
    textEdition: 'TR',
    interlinearText: 'grc-tr',
  },
  hot: {
    testament: 'OT',
    langs: ['hbo', 'arc'],
    tokensSource: 'tahot',
    baseEditions: ['L'],
    textEdition: null,
    interlinearText: 'hbo-wlc',
  },
};

/** Edições de uma palavra (campo `editions`, separado por vírgula). */
export function editionsOf(token: Pick<Token, 'editions'>): Set<string> {
  return new Set(token.editions.split(',').map((e) => e.trim()).filter(Boolean));
}

/** Corpus com variantes textuais entre edições-base (o grego: TR, BYZ, NA). */
export function hasEditionVariants(corpus: Corpus): boolean {
  return CORPUS[corpus].baseEditions.length > 1;
}

/**
 * Palavra do texto-base do seu corpus: no grego, a que está na edição TR (as outras são variantes, que aparecem
 * nas leituras alinhadas); no hebraico, todas.
 */
export function isBaseTextToken(token: Pick<Token, 'corpus' | 'editions'>): boolean {
  const edition = CORPUS[token.corpus].textEdition;
  return edition === null || editionsOf(token).has(edition);
}

/** Testamento de um livro (1 a 66), pela tabela de livros. */
export function testamentOfBook(book: number): Testament {
  const info = BOOK_TABLE.find((b) => b.num === book);
  if (!info) throw new RangeError(`livro desconhecido: ${book}`);
  return info.testament;
}

export function testamentOfVid(vid: Vid): Testament {
  return testamentOfBook(splitVid(vid).book);
}

export function testamentOfCorpus(corpus: Corpus): Testament {
  return CORPUS[corpus].testament;
}

/**
 * Língua de um token. No grego é sempre grc. No TAHOT, o aramaico tem morfologia que começa com "A"
 * (ex.: Dn 2:4, "ANcbsd/Ta"); o hebraico começa com "H". O Strong não distingue os dois.
 */
export function langOfToken(token: Pick<Token, 'corpus' | 'morph'>): Lang {
  if (token.corpus === 'gnt') return 'grc';
  return token.morph?.startsWith('A') ? 'arc' : 'hbo';
}

/** Corpus do testamento: o NT é o grego (gnt); o AT, o hebraico e o aramaico (hot). */
export function corpusOfTestament(testament: Testament): Corpus {
  const found = (Object.keys(CORPUS) as Corpus[]).find((c) => CORPUS[c].testament === testament);
  if (!found) throw new RangeError(`sem corpus para o testamento ${testament}`);
  return found;
}

/** Corpus do texto original de um versículo, pelo testamento do livro. */
export function corpusOfVid(vid: Vid): Corpus {
  return corpusOfTestament(testamentOfVid(vid));
}

/** Intervalo de vids de um testamento: do 1:1 do primeiro livro ao último versículo do último. */
export function testamentRange(testament: Testament): VerseRange {
  const books = BOOK_TABLE.filter((b) => b.testament === testament);
  const first = books[0];
  const last = books[books.length - 1];
  if (!first || !last) throw new RangeError(`sem livros para o testamento ${testament}`);
  return { start: bookStartVid(first.num), end: packVid(last.num, last.chapters, LAST_VERSE) };
}

/**
 * Fonte do texto original de um testamento: TR no NT, WLC no AT (id do registro de fontes). É o que a lente Texto e
 * o leitor mostram como "original".
 */
export function originalTextOf(testament: Testament): string {
  return CORPUS[corpusOfTestament(testament)].interlinearText;
}

/**
 * Palavras do texto original de cada versículo, na ordem do texto. Só entra o corpus do testamento do versículo (o
 * NT lê o grego, o AT o hebraico) e, no grego, a palavra da edição TR (isBaseTextToken).
 */
export function originalTokensByVid(tokens: readonly Token[]): Map<Vid, Token[]> {
  const out = new Map<Vid, Token[]>();
  for (const t of tokens) {
    if (t.corpus !== corpusOfVid(t.vid) || !isBaseTextToken(t)) continue;
    const list = out.get(t.vid) ?? [];
    list.push(t);
    out.set(t.vid, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.pos - b.pos);
  return out;
}

/** Nome de cada letra de edição do AT (legenda das edições do TAHOT). Letra fora da tabela não tem legenda. */
export const HEBREW_EDITION_NAMES: Readonly<Record<string, string>> = {
  L: 'Leningrado',
  Q: 'Qere',
  K: 'Ketiv',
  A: 'Aleppo',
  B: 'BHS',
  C: 'Cairensis',
  D: 'Mar Morto',
  H: 'Ben Chaim',
  R: 'restaurado de paralelos',
  X: 'acrescentada da LXX',
  V: 'variante de outros manuscritos',
  E: 'emenda de estudiosos',
};

/** Legenda curta das edições de uma palavra ("L = Leningrado · Q = Qere"); vazia se nenhuma tem nome. */
export function editionLegend(editions: readonly string[]): string {
  return editions
    .filter((e) => HEBREW_EDITION_NAMES[e])
    .map((e) => `${e} = ${HEBREW_EDITION_NAMES[e]}`)
    .join(' · ');
}

export function testamentLabel(testament: Testament): 'AT' | 'NT' {
  return testament === 'OT' ? 'AT' : 'NT';
}

/** Corpus de um cite_id de token ("tok:gnt:50002007:30" -> "gnt"); null para outros ids. */
export function corpusOfCiteId(citeId: string): Corpus | null {
  const m = /^tok:(gnt|hot):/.exec(citeId);
  return m ? (m[1] as Corpus) : null;
}

// Língua, corpus e testamento: a fonte única para "grego ou hebraico?" e "NT ou AT?".
// Só importa de ../types e ../refs (regra de camadas, tests/architecture.test.ts).
import { BOOK_TABLE, splitVid } from '../refs';
import type { Token, Vid } from '../types';

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

export function testamentLabel(testament: Testament): 'AT' | 'NT' {
  return testament === 'OT' ? 'AT' : 'NT';
}

/** Corpus de um cite_id de token ("tok:gnt:50002007:30" -> "gnt"); null para outros ids. */
export function corpusOfCiteId(citeId: string): Corpus | null {
  const m = /^tok:(gnt|hot):/.exec(citeId);
  return m ? (m[1] as Corpus) : null;
}

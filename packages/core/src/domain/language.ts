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
  /** Edições-base do texto original (as que valem como "texto-base"). */
  baseEditions: readonly string[];
  /** Id da fonte de texto interlinear do leitor. */
  interlinearText: string;
}

export const CORPUS: Record<Corpus, CorpusSpec> = {
  gnt: {
    testament: 'NT',
    langs: ['grc'],
    tokensSource: 'tagnt',
    baseEditions: ['TR', 'BYZ', 'NA'],
    interlinearText: 'grc-tr',
  },
  hot: {
    testament: 'OT',
    langs: ['hbo', 'arc'],
    tokensSource: 'tahot',
    baseEditions: ['L'],
    interlinearText: 'hbo-wlc',
  },
};

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

// Painel hermenêutico: reúne as seis camadas de um intervalo a partir do banco.
import type { PanelData, Source, Token, VerseRange, VerseText } from './types';
import { formatReference, splitVid } from './refs';
import { DEFAULT_TEXT_SOURCE, type Concordance, Repo, type DictionaryHit } from './repo';
import { buildRelevanceContext, rankDictionary, rankEntities } from './relevance';

import { CORPUS, editionsOf, hasEditionVariants } from './domain/language';

/** Edições-base do NT grego (TR, BYZ, NA); uma palavra fora de alguma delas é uma variante textual. */
export const BASE_EDITIONS: readonly string[] = CORPUS.gnt.baseEditions;

export function editionSet(token: Token): Set<string> {
  return editionsOf(token);
}

export function hasEdition(token: Token, edition: string): boolean {
  return editionsOf(token).has(edition);
}

/** Edições-base do corpus da palavra que estão ausentes nela (TR, BYZ, NA no grego). */
export function missingBaseEditions(token: Token): string[] {
  const present = editionsOf(token);
  return CORPUS[token.corpus].baseEditions.filter((e) => !present.has(e));
}

export interface PanelLimits {
  /** Referências cruzadas, por peso. */
  xrefs: number;
  /** Exemplos de concordância por strong_base (o total é sempre contado). */
  concordanceSamples: number;
  /** Teto de segurança para comentários; o corte fino fica com o orçamento de contexto. */
  commentaries: number;
  dictionary: number;
  topics: number;
  entities: number;
  bookIntro: number;
}

export const DEFAULT_PANEL_LIMITS: PanelLimits = {
  xrefs: 12,
  concordanceSamples: 3,
  commentaries: 400,
  dictionary: 12,
  topics: 12,
  entities: 30,
  bookIntro: 4,
};

export interface PanelOptions {
  /** Fonte de texto para contexto literário e alvos de referências cruzadas. */
  textSource?: string;
  /** Versículos antes e depois do intervalo. */
  contextVerses?: number;
  limits?: Partial<PanelLimits>;
}

/**
 * Monta o painel do intervalo.
 * - variants: palavras gregas (corpus 'gnt') que não estão em TR, BYZ e NA. Palavras hebraicas
 *   não entram, porque suas edições (ex.: 'L') não são comparáveis às do NT.
 * - bookIntro: verbetes de dicionário cujo headword é o nome do livro ("Philippians" ou "Philippians, ...").
 */
export async function buildPanel(repo: Repo, range: VerseRange, opts: PanelOptions = {}): Promise<PanelData> {
  const textSource = opts.textSource ?? DEFAULT_TEXT_SOURCE;
  const contextVerses = opts.contextVerses ?? 5;
  const limits: PanelLimits = { ...DEFAULT_PANEL_LIMITS, ...opts.limits };
  const r: VerseRange = { start: range.start, end: range.end };

  const [books, sources] = await Promise.all([repo.books(), repo.sources()]);
  const sourceMap = new Map<string, Source>(sources.map((s) => [s.id, s] as const));
  const textSources = sources.filter((s) => s.kind === 'text');
  const startBook = books.find((b) => b.num === splitVid(r.start).book);

  const unit = await repo.literaryUnit(textSource, r);
  const [translationLists, tokens, neighbors, divisions, entities, dictionary, topics, commentaries, xrefs, bookIntro, events] =
    await Promise.all([
      Promise.all(textSources.map((s) => repo.verseTexts(s.id, r))),
      repo.tokens(r),
      repo.neighbors(textSource, r, contextVerses, unit),
      repo.divisions(textSource, r),
      repo.entities(r),
      repo.dictionaryEntries(r, ['dictionary']),
      repo.dictionaryEntries(r, ['topical']),
      repo.commentaries(r),
      repo.xrefs(r, limits.xrefs, textSource),
      startBook ? repo.bookIntro(startBook) : Promise.resolve([]),
      repo.timelineEvents(r),
    ]);

  const strongBases = [...new Set(tokens.map((t) => t.strong_base).filter((s): s is string => !!s))];
  const [lexicon, concordanceRows] = await Promise.all([
    repo.lexicon(strongBases),
    Promise.all(
      strongBases.map(async (base) => [base, await repo.concordance(base, textSource, limits.concordanceSamples, r)] as const),
    ),
  ]);
  const concordance: Record<string, Concordance> = {};
  for (const [base, c] of concordanceRows) concordance[base] = c;

  const translations: VerseText[] = translationLists.flat();
  const variants = tokens.filter((t) => hasEditionVariants(t.corpus) && missingBaseEditions(t).length > 0);
  const boundedBookIntro = bookIntro.slice(0, limits.bookIntro);
  // Verbetes de introdução do livro já aparecem na camada literária: não os repete no histórico.
  const introIds = new Set(boundedBookIntro.map((d) => d.cite_id));
  // Relevância: descarta verbetes/entidades improváveis para este trecho e ordena pelos mais específicos.
  const relevance = buildRelevanceContext(
    r,
    startBook,
    entities.map((e) => e.name),
    tokens,
  );
  const historicalDictionary = rankDictionary(
    dictionary.filter((d) => !introIds.has(d.cite_id)) as DictionaryHit[],
    relevance,
    limits.dictionary,
  );
  const rankedEntities = rankEntities(entities, limits.entities, { othersExist: historicalDictionary.length > 0 });
  const rankedTopics = rankDictionary(topics as DictionaryHit[], relevance, limits.topics);

  // Fontes efetivamente referenciadas no painel.
  const referenced = new Set<string>();
  const note = (rows: ReadonlyArray<{ source_id: string }>) => rows.forEach((row) => referenced.add(row.source_id));
  note(translations);
  note(tokens);
  note(neighbors.before);
  note(neighbors.after);
  note(divisions);
  note(lexicon);
  note(Object.values(concordance).flatMap((c) => c.samples));
  note(xrefs);
  note(xrefs.flatMap((x) => x.texts));
  note(historicalDictionary);
  note(rankedTopics);
  note(rankedEntities);
  note(events);
  note(commentaries);
  note(boundedBookIntro);

  const usedSources: Record<string, Source> = {};
  for (const id of referenced) {
    const source = sourceMap.get(id);
    if (source) usedSources[id] = source;
  }

  return {
    range: r,
    reference: formatReference(r, books),
    layers: {
      text: { translations, original: tokens, variants },
      literary: {
        before: neighbors.before,
        after: neighbors.after,
        divisions,
        bookIntro: boundedBookIntro,
        unit,
      },
      historical: {
        entities: rankedEntities,
        dictionary: historicalDictionary,
        events,
      },
      language: { lexicon, concordance },
      intertext: {
        xrefs,
        topics: rankedTopics,
      },
      interpretation: {
        commentaries: commentaries.slice(0, limits.commentaries),
      },
    },
    sources: usedSources,
  };
}

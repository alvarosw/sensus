// Consultas tipadas ao banco (SQLite, esquema em pipeline/schema.sql). Só SQL parametrizado.
// A classe Repo é a fachada: cada área vive em um módulo ao lado (text, language, commentary, dictionary,
// entities, timeline, timeline-search, cite) e recebe o driver. A API pública não mudou com a divisão.
import type {
  Book,
  CitableRecord,
  Commentary,
  DictionaryEntry,
  LexiconEntry,
  SqlDriver,
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
} from '../types';
import * as text from './text';
import * as language from './language';
import * as commentary from './commentary';
import * as dictionary from './dictionary';
import * as entities from './entities';
import * as timeline from './timeline';
import * as timelineSearch from './timeline-search';
import * as cite from './cite';
import { ALL_COMMENTARIES, parseCommentaryPreference, type CommentaryPreference } from '../domain/source-prefs';
import type { AppLang } from '../domain/locale';
import { ENTITY_NAME_LANG } from '../domain/names';

export { DEFAULT_TEXT_SOURCE } from './text';
export type { XRefWithTexts } from './text';
export type { Concordance } from './language';
export type { DictionaryHit, DictionaryKind } from './dictionary';
export type { EntityHit, PlaceVerseHit } from './entities';

export interface RepoOptions {
  /**
   * Banco de um texto que não está no principal (Bíblia baixada). Devolve o driver da fonte, ou null para usar o
   * principal. Só as consultas de texto passam por aqui (verseTexts, chapter, neighbors, divisões, unidade literária
   * e alvos de referências cruzadas). Sem a opção, tudo vai ao banco principal.
   */
  textDriver?: (sourceId: string) => SqlDriver | null;
  /**
   * Idioma dos nomes e descrições em outra língua que a fonte (tabelas entity_name e entity_text). Padrão pt, o único
   * que o banco traz hoje. Sem linhas nesse idioma, as consultas devolvem null e vale o texto da fonte (inglês).
   */
  nameLang?: AppLang;
}

export class Repo {
  /** Preferência de comentários: filtra toda consulta que devolve comentários (ver setCommentaryPreference). */
  private commentaryPref: CommentaryPreference = ALL_COMMENTARIES;
  /** Idioma dos nomes e descrições (ver RepoOptions.nameLang). */
  private nameLang: AppLang;

  constructor(
    private readonly driver: SqlDriver,
    private readonly options: RepoOptions = {},
  ) {
    this.nameLang = options.nameLang ?? ENTITY_NAME_LANG;
  }

  /**
   * Idioma dos nomes e descrições que as consultas devolvem (pessoas, lugares, linha do tempo, citações). Quem guarda o
   * repositório troca quando o idioma do app muda (ver app/src/data/active-db.ts).
   */
  setNameLang(lang: AppLang): void {
    this.nameLang = lang;
  }

  getNameLang(): AppLang {
    return this.nameLang;
  }

  /** Driver do banco que guarda o texto da fonte: o dela (se houver `textDriver`) ou o principal. */
  private textDb(sourceId: string): SqlDriver {
    return this.options.textDriver?.(sourceId) ?? this.driver;
  }

  /**
   * Define quais tradições e fontes de comentário este repositório entrega (lentes, painel, IA e citações).
   * Vale para as consultas seguintes; quem guarda o repositório decide quando trocar (ver app/src/data/active-db.ts).
   */
  setCommentaryPreference(pref: CommentaryPreference): void {
    this.commentaryPref = parseCommentaryPreference(pref);
  }

  getCommentaryPreference(): CommentaryPreference {
    return this.commentaryPref;
  }

  books(): Promise<Book[]> {
    return text.books(this.driver);
  }

  sources(): Promise<Source[]> {
    return text.sources(this.driver);
  }

  source(id: string): Promise<Source | null> {
    return text.source(this.driver, id);
  }

  /** Versículos de uma fonte de texto dentro do intervalo, em ordem. */
  verseTexts(sourceId: string, range: VerseRange, limit?: number): Promise<VerseText[]> {
    return text.verseTexts(this.textDb(sourceId), sourceId, range, limit);
  }

  chapter(sourceId: string, book: number, chapter: number): Promise<VerseText[]> {
    return text.chapter(this.textDb(sourceId), sourceId, book, chapter);
  }

  /**
   * Versículos antes e depois do intervalo, sem sair do livro: `count` versículos em cada lado.
   * Se `unit` for dado, também inclui os versículos da unidade literária (até 40 por lado).
   */
  neighbors(
    sourceId: string,
    range: VerseRange,
    count: number,
    unit?: VerseRange,
  ): Promise<{ before: VerseText[]; after: VerseText[] }> {
    return text.neighbors(this.textDb(sourceId), sourceId, range, count, unit);
  }

  /** Divisões relevantes para o intervalo (lead, dentro e next). Ver text.divisions. */
  divisions(sourceId: string, range: VerseRange): Promise<TextDivision[]> {
    return text.divisions(this.textDb(sourceId), sourceId, range);
  }

  /** Unidade literária que contém o intervalo (ver PanelData.layers.literary.unit). */
  literaryUnit(sourceId: string, range: VerseRange): Promise<VerseRange> {
    return text.literaryUnit(this.driver, this.textDb(sourceId), sourceId, range);
  }

  /** Palavras do texto original no intervalo (corpus 'gnt' ou 'hot' opcional). */
  tokens(range: VerseRange, corpus?: Token['corpus']): Promise<Token[]> {
    return language.tokens(this.driver, range, corpus);
  }

  /** Verbetes de léxico para os strong_base dados; mantém a ordem da entrada. */
  lexicon(strongBases: readonly string[]): Promise<LexiconEntry[]> {
    return language.lexicon(this.driver, strongBases);
  }

  /** Concordância de um strong_base (ver language.concordance). */
  concordance(
    strongBase: string,
    textSourceId: string,
    limit: number,
    exclude?: VerseRange,
  ): Promise<language.Concordance> {
    return language.concordance(this.driver, strongBase, textSourceId, limit, exclude);
  }

  /** Comentários visíveis pela preferência que se sobrepõem ao intervalo, mais as introduções de capítulo e livro. */
  commentaries(range: VerseRange): Promise<Commentary[]> {
    return commentary.commentaries(this.driver, range, this.commentaryPref);
  }

  /** Como `commentaries`, mais quantos comentários do trecho a preferência escondeu (aviso na folha de estudo). */
  commentariesAndHidden(range: VerseRange): Promise<commentary.CommentarySplit> {
    return commentary.commentarySplit(this.driver, range, this.commentaryPref);
  }

  /** Verbetes cujas referências se sobrepõem ao intervalo, com o tipo da fonte. */
  dictionaryEntries(
    range: VerseRange,
    kinds: readonly dictionary.DictionaryKind[] = ['dictionary', 'topical'],
  ): Promise<dictionary.DictionaryHit[]> {
    return dictionary.dictionaryEntries(this.driver, range, kinds);
  }

  /** Verbetes de dicionário do livro (ex.: "Philippians, Epistle to the" ou "Philippians"). */
  bookIntro(book: Pick<Book, 'name_en' | 'name_pt'>): Promise<DictionaryEntry[]> {
    return dictionary.bookIntro(this.driver, book);
  }

  /** Referências cruzadas com origem no intervalo, por peso decrescente, com o texto dos alvos. */
  xrefs(range: VerseRange, limit: number, textSourceId: string = text.DEFAULT_TEXT_SOURCE): Promise<text.XRefWithTexts[]> {
    return text.xrefs(this.driver, this.textDb(textSourceId), range, limit, textSourceId);
  }

  /** Pessoas, lugares e grupos ligados a versículos do intervalo, com o total de referências de cada um. */
  entities(range: VerseRange): Promise<entities.EntityHit[]> {
    return entities.entities(this.driver, range, this.nameLang);
  }

  /** Lugares com coordenadas ligados a versículos do intervalo: uma linha por (lugar, versículo). */
  placesInRange(range: VerseRange): Promise<entities.PlaceVerseHit[]> {
    return entities.placesInRange(this.driver, range, this.nameLang);
  }

  /** Linha do tempo do trecho: eventos no intervalo mais 2 de contexto antes e depois. */
  timelineEvents(range: VerseRange): Promise<TimelineEvent[]> {
    return timeline.timelineEvents(this.driver, range, this.nameLang);
  }

  /** Linhas do tempo da cronologia completa, mais frequentes primeiro. */
  timelineLines(): Promise<TimelineLine[]> {
    return timeline.timelineLines(this.driver, this.nameLang);
  }

  /** Eventos de uma linha do tempo (id = TimelineLine.id), em ordem de sortKey. */
  timelineLineEvents(lineId: string): Promise<TimelineLineEvent[]> {
    return timeline.timelineLineEvents(this.driver, lineId, this.nameLang);
  }

  /** Um evento pelo cite_id. Null se não for evento válido. */
  timelineEvent(citeId: string): Promise<TimelineLineEvent | null> {
    return timeline.timelineEvent(this.driver, citeId, this.nameLang);
  }

  /** Todos os eventos da cronologia, em ordem (base da busca sobre a tradução em cache). */
  timelineAllEvents(): Promise<TimelineLineEvent[]> {
    return timeline.timelineAllEvents(this.driver, this.nameLang);
  }

  /** Linhas do tempo em que cada evento aparece (chave: cite_id do evento). */
  timelineMemberships(eventIds: readonly string[]): Promise<Map<string, TimelineLineRef[]>> {
    return timeline.timelineMemberships(this.driver, eventIds, this.nameLang);
  }

  /** Busca na cronologia completa (linhas e eventos). */
  timelineSearch(query: string): Promise<TimelineSearchResult> {
    return timelineSearch.timelineSearch(this.driver, query, this.nameLang);
  }

  /** Linhas do tempo para o seletor "+ Linha", no máximo `limit`. */
  timelineSearchLines(query: string, limit = 30): Promise<TimelineLine[]> {
    return timelineSearch.timelineSearchLines(this.driver, query, this.nameLang, limit);
  }

  /** Posições cronológicas (sortKey) de todos os eventos. */
  timelineSortKeys(): Promise<number[]> {
    return timeline.timelineSortKeys(this.driver);
  }

  /** Resumo da Bíblia inteira por era. */
  timelineSummary(): Promise<TimelineSummary> {
    return timeline.timelineSummary(this.driver);
  }

  /** Resolve um cite_id ao registro de origem. Retorna null se o prefixo ou o id não existir. */
  resolveCite(citeId: string): Promise<CitableRecord | null> {
    return cite.resolveCite(this.driver, citeId, this.commentaryPref, this.nameLang);
  }
}

// Tipos compartilhados do núcleo do Sensus. Espelham pipeline/schema.sql.
// O núcleo não depende de React Native nem de Node: acesso a banco e rede
// chegam por injeção (SqlDriver, FetchLike).

/** livro*1_000_000 + capítulo*1000 + versículo (versificação KJV). */
export type Vid = number;

export interface VerseRange {
  start: Vid;
  end: Vid;
}

export type SqlParam = string | number | null;

/** Driver mínimo de SQLite; implementado por expo-sqlite no app e node:sqlite nas ferramentas. */
export interface SqlDriver {
  all<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]>;
}

// ---- registros do banco ----------------------------------------------------

export interface Source {
  id: string;
  kind: 'text' | 'tokens' | 'lexicon' | 'commentary' | 'dictionary' | 'topical' | 'xref' | 'entity';
  title: string;
  author: string | null;
  lang: string;
  license: string;
  license_url: string | null;
  url: string;
  version: string | null;
  retrieved_at: string;
  attribution: string | null;
  tradition: string | null;
  notes: string | null;
}

export interface Book {
  num: number;
  osis: string;
  name_pt: string;
  name_en: string;
  testament: 'OT' | 'NT';
  chapters: number;
}

export interface VerseText {
  cite_id: string;
  source_id: string;
  vid: Vid;
  text: string;
}

export interface TextDivision {
  source_id: string;
  vid: Vid;
  kind: 'paragraph' | 'heading';
  title: string | null;
}

export interface Token {
  cite_id: string;
  source_id: string;
  corpus: 'gnt' | 'hot';
  vid: Vid;
  pos: number;
  surface: string;
  translit: string | null;
  lemma: string | null;
  strong: string | null;
  strong_base: string | null;
  morph: string | null;
  morph_desc: string | null;
  gloss_en: string | null;
  /** Edições que contêm a palavra, separadas por vírgula (ex.: "TR,BYZ,NA"). */
  editions: string;
  variant_note: string | null;
  alt_ref: string | null;
}

export interface LexiconEntry {
  cite_id: string;
  source_id: string;
  key: string;
  strong_base: string | null;
  lemma: string | null;
  translit: string | null;
  gloss: string | null;
  definition: string;
  lang: string;
}

export interface Commentary {
  cite_id: string;
  source_id: string;
  start_vid: Vid;
  end_vid: Vid;
  text: string;
}

export interface DictionaryEntry {
  cite_id: string;
  source_id: string;
  headword: string;
  text: string;
}

export interface XRef {
  cite_id: string;
  source_id: string;
  from_vid: Vid;
  to_start_vid: Vid;
  to_end_vid: Vid;
  weight: number | null;
}

export interface Entity {
  cite_id: string;
  source_id: string;
  type: 'person' | 'place' | 'event' | 'group' | 'other';
  name: string;
  description: string | null;
  lat: number | null;
  lon: number | null;
  /** JSON da fonte. */
  data: string | null;
}

/** Qualquer registro citável, resolvido a partir de um cite_id. */
export type CitableRecord =
  | { table: 'verse_text'; record: VerseText }
  | { table: 'token'; record: Token }
  | { table: 'lexicon_entry'; record: LexiconEntry }
  | { table: 'commentary'; record: Commentary }
  | { table: 'dictionary_entry'; record: DictionaryEntry }
  | { table: 'xref'; record: XRef }
  | { table: 'entity'; record: Entity };

// ---- painel hermenêutico ------------------------------------------------------

export interface PanelData {
  range: VerseRange;
  /** Ex.: "Filipenses 2:5-8". */
  reference: string;
  layers: {
    /** 1. Texto: traduções, texto original e diferenças entre edições. */
    text: {
      translations: VerseText[];
      original: Token[];
      /** Tokens ausentes em pelo menos uma das edições TR/BYZ/NA. */
      variants: Token[];
    };
    /** 2. Contexto literário. */
    literary: {
      before: VerseText[];
      after: VerseText[];
      divisions: TextDivision[];
      bookIntro: DictionaryEntry[];
      /**
       * Unidade literária que contém o intervalo: do início da última divisão em/antes de start
       * até o último versículo antes da próxima divisão (ou fim do livro). As divisões são os parágrafos
       * do original (tagnt no NT, tahot no AT) quando existem; senão, as da fonte de texto. Adicionado em v0.2.
       */
      unit?: VerseRange;
    };
    /** 3. Contexto histórico-cultural. */
    historical: {
      entities: Entity[];
      dictionary: DictionaryEntry[];
    };
    /** 4. Língua original. */
    language: {
      lexicon: LexiconEntry[];
      /** strong_base → total de ocorrências e alguns exemplos. */
      concordance: Record<string, { count: number; samples: VerseText[] }>;
    };
    /** 5. Intertextualidade. */
    intertext: {
      xrefs: Array<XRef & { texts: VerseText[] }>;
      topics: DictionaryEntry[];
    };
    /** 6. História da interpretação. */
    interpretation: {
      commentaries: Commentary[];
    };
  };
  /** Todas as fontes referenciadas no painel, por id. */
  sources: Record<string, Source>;
}

// ---- IA ------------------------------------------------------------------------

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderConfig {
  /** Preset de origem ('nvidia', 'openai', 'openrouter', 'custom'...). */
  id: string;
  /** 'chatgpt': plano ChatGPT via Sign in with ChatGPT (apiKey vazio; token vem de getAccessToken). */
  kind: 'openai-compatible' | 'chatgpt';
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /**
   * Campos extras do corpo de cada requisição (ex.: `{ chat_template_kwargs: { enable_thinking: false } }`
   * para desligar o raciocínio em modelos que o aceitam). Os campos do próprio núcleo (model, messages,
   * stream, ...) prevalecem sobre estes.
   */
  extraBody?: Record<string, unknown>;
  /**
   * Configuração usada quando este provedor recusa a conta (plan_not_eligible) antes de qualquer texto.
   * O app preenche com a chave de API configurada; o núcleo não usa este campo.
   */
  fallback?: ProviderConfig;
}

export interface ChatRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** Chamado a cada pedaço de raciocínio do modelo (antes de qualquer texto): para mostrar "pensando…". */
  onReasoning?: () => void;
  /** Tempo sem dados até desistir (ms). Padrão: 45 s. */
  stallMs?: number;
}

export interface LLMProvider {
  /** Emite pedaços de texto conforme chegam (streaming). */
  stream(req: ChatRequest): AsyncIterable<string>;
}

/** Trecho da resposta da IA com suas citações validadas. */
export interface CitedSegment {
  text: string;
  /** cite_ids válidos (presentes no contexto enviado). */
  cites: string[];
  /** cite_ids citados pela IA mas ausentes do contexto. */
  invalidCites: string[];
  /**
   * source = afirmação apoiada em fonte (inclui a frase sem citação própria coberta pela citação seguinte
   * do mesmo parágrafo; então cites traz as citações do grupo); inference = rotulada pela IA como
   * "(Inferência)" (início ou fim da frase); uncited = afirmação factual sem citação;
   * structure = título, rótulo de seção, pergunta ou aviso sobre o contexto (não é fato).
   */
  kind: 'source' | 'inference' | 'uncited' | 'structure';
  /**
   * Afirmações gramaticais (modo, tempo, voz, caso, pessoa, número) que contradizem a análise de
   * TODOS os tokens citados no trecho. Preenchido por checkMorphClaims (adicionado em v0.2).
   */
  morphConflicts?: MorphConflict[];
}

export interface MorphConflict {
  /** Termo usado no texto da IA, ex.: "indicativo". */
  term: string;
  /** Valor(es) que a análise do token traz, em português, ex.: "imperativo". */
  expected: string;
}

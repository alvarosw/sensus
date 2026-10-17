// Contrato da UX de estudo (v0.3): resumo estruturado por camada, texto rico com citações inline
// e perguntas acionáveis. Implementado no núcleo; o app apenas renderiza estes tipos.

import type { MorphConflict, PanelData, Token } from '../types';
import type { Lang } from '../domain';

/** Chaves das seções do resumo, na ordem de exibição. */
export type SectionKey =
  | 'texto'
  | 'literario'
  | 'historico'
  | 'lingua'
  | 'intertexto'
  | 'interpretacao'
  | 'aplicacao';

export const SECTION_KEYS: readonly SectionKey[] = [
  'texto', 'literario', 'historico', 'lingua', 'intertexto', 'interpretacao', 'aplicacao',
];

/** Nome da seção para a interface (pt-BR). */
export const SECTION_LABELS: Record<SectionKey, string> = {
  texto: 'Texto',
  literario: 'Contexto literário',
  historico: 'Contexto histórico',
  lingua: 'Língua original',
  intertexto: 'Intertextualidade',
  interpretacao: 'História da interpretação',
  aplicacao: 'Aplicação',
};

/** Camada do PanelData que cada seção resume (null: aplicação não tem fonte própria). */
export const SECTION_LAYER: Record<SectionKey, keyof PanelData['layers'] | null> = {
  texto: 'text',
  literario: 'literary',
  historico: 'historical',
  lingua: 'language',
  intertexto: 'intertext',
  interpretacao: 'interpretation',
  aplicacao: null,
};

// ---- texto rico (subconjunto de markdown + citações) ------------------------------

export type Inline =
  | { type: 'text'; text: string; bold?: boolean; italic?: boolean }
  /** Trecho em grego/hebraico (detectado por bloco Unicode). tokenCiteId quando casa com um token do painel. */
  | { type: 'original'; text: string; lang: Lang; tokenCiteId?: string; bold?: boolean; italic?: boolean }
  /** Grupo de citações consecutivas, já com rótulos legíveis (ver CiteIndex). */
  | { type: 'cite'; refs: CiteRef[] };

export interface CiteRef {
  citeId: string;
  /** Rótulo curto para o chip, ex.: "Calvino", "Bíblia Livre 2:5–8", "TBESG μορφή", "TR 2:5". */
  label: string;
  /** false = id ausente do contexto (citação inventada). */
  valid: boolean;
  /** Todos os ids que este chip representa (mais de um quando consecutivos foram unidos). Adicionado em v0.3. */
  citeIds?: string[];
}

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; inlines: Inline[] }
  | { type: 'paragraph'; inlines: Inline[]; claim: ClaimInfo }
  | { type: 'list'; ordered: boolean; items: { inlines: Inline[]; claim: ClaimInfo }[] }
  | { type: 'quote'; inlines: Inline[]; claim: ClaimInfo };

/**
 * Classificação de confiabilidade de um parágrafo/item (agrega as frases que o compõem).
 * - inference: não há frase factual e há inferência (moldura azul; o rótulo "(Inferência)" não aparece);
 * - source: todas as frases factuais têm citação (frases de inferência no meio são destacadas);
 * - mixed: há ao menos uma frase factual sem citação. Vale exatamente quando `uncited` não está vazio;
 * - structure: só títulos, rótulos, perguntas e avisos (sem moldura).
 */
export interface ClaimInfo {
  kind: 'source' | 'inference' | 'mixed' | 'structure';
  /** Frases factuais sem citação, depois da atribuição (para destacar). Vazio se kind não for 'mixed'. */
  uncited: string[];
  /** Frases de inferência (com o rótulo), para destacar dentro de um bloco que não é inferência. Adicionado em v0.5. */
  inference: string[];
  morphConflicts: MorphConflict[];
}

// ---- resumo estruturado ------------------------------------------------------------

export interface StructuredSummary {
  /** 2–3 frases de visão geral do trecho. */
  overview: Block[];
  /** Resumo objetivo (1–3 frases) por seção; seções ainda não recebidas ficam ausentes. */
  sections: Partial<Record<SectionKey, Block[]>>;
  /** Perguntas acionáveis sugeridas pela IA (texto puro, sem citações). */
  questions: string[];
  /** true quando o stream terminou e o marcador final foi recebido. */
  complete: boolean;
  /**
   * Perguntas específicas de cada lente (linhas "? ..." dentro da seção; 'visao' = visão geral).
   * Até 2 por lente; só as lentes com perguntas aparecem. Adicionado em v0.4.
   */
  sectionQuestions?: Partial<Record<SectionKey | 'visao', string[]>>;
  /**
   * Palavra que move o trecho, escolhida pela IA: cite_id de um token do contexto, dado pela linha
   * "= [[tok:…]]" no início de @lingua. Ausente quando a IA não escolheu ou escolheu um id inválido.
   * Adicionado em v0.6.
   */
  keyWordCiteId?: string;
}

/** Resposta de chat/aprofundamento: texto rico + novas perguntas sugeridas ao final. */
export interface StructuredAnswer {
  blocks: Block[];
  followUps: string[];
  complete: boolean;
}

/** Mapa cite_id → rótulo/tipo, construído deterministicamente a partir do PanelData. */
export interface CiteIndexEntry {
  label: string;
  /** Tabela de origem, para ícone/cor do chip. */
  table: 'verse_text' | 'token' | 'lexicon_entry' | 'commentary' | 'dictionary_entry' | 'xref' | 'entity';
  sourceTitle: string;
  tradition: string | null;
  /** Nome curto da fonte usado no rótulo (ex.: "Bíblia Livre", "KJV", TBESG). Adicionado em v0.3. */
  short?: string;
  /** Parte de referência do rótulo de versículo (ex.: "2:5" ou "Fp 1:30"). Adicionado em v0.3. */
  refLabel?: string;
  /** vid do versículo (só para verse_text), usado para unir versículos consecutivos. Adicionado em v0.3. */
  vid?: number;
}
export type CiteIndex = Map<string, CiteIndexEntry>;

/** Contexto para interpretar a resposta da IA: ids válidos, rótulos e tokens (para palavras gregas/hebraicas). */
export interface RichTextContext {
  citeIds: Set<string>;
  citeIndex: CiteIndex;
  tokens?: Token[];
}

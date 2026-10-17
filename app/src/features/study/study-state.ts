// Tipos da folha de estudo compartilhados entre os hooks de dados (useStudyData), de IA (useStudyAi) e os
// contextos (study-context). Só tipos: nada aqui roda.
import type { Block, Book, PanelData, ProviderConfig, StructuredSummary, Vid } from '@sensus/core';
import type { LensKey } from '@/state/study';

export interface Range {
  start: Vid;
  end: Vid;
}

export type AiStatus = 'noprovider' | 'waiting' | 'streaming' | 'done' | 'error';

export interface DeepView {
  key: string;
  /** Trecho da afirmação detalhada (vazio = a lente inteira). */
  claim: string;
  blocks: Block[];
  followUps: string[];
  status: 'streaming' | 'done' | 'error';
  error?: string;
  /** Modelo de raciocínio pensando, sem texto ainda ("pensando…"). */
  thinking: boolean;
}

export interface StudyAi {
  provider: ProviderConfig | null;
  status: AiStatus;
  error: string | null;
  summary: StructuredSummary | null;
  /** Lente que está recebendo texto agora (cursor piscante). */
  writingLens: LensKey | null;
  /** Resumo: modelo de raciocínio pensando, sem texto ainda ("pensando…" no lugar do esqueleto). */
  thinking: boolean;
  /** Perícope diferente da seleção: texto "Resumo da perícope …". */
  unitRange: Range | null;
  retry: () => void;
  /** Pode pedir "Detalhar" (provedor e contexto prontos). */
  canDeepen: boolean;
  deepen: (lens: LensKey, opts?: { claim?: string; claimKey?: string }) => void;
  deepViews: (lens: LensKey) => DeepView[];
  /** Perguntas sugeridas da lente. */
  questions: (lens: LensKey) => string[];
}

export interface StudyData {
  range: Range;
  books: Book[];
  panel: PanelData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Perícope que contém a seleção (literaryUnit). */
  unit: Range | null;
  /** palavra normalizada → cite_id do token (para tornar o grego tocável em textos de fontes). */
  tokenByKey: ReadonlyMap<string, string>;
  textSource: string;
  /** Versículos da seleção e vizinhos imediatos (inclusive em outro livro); null enquanto carrega. */
  edges: RangeEdges | null;
  /** Rótulo curto de um cite_id do painel (ex.: "Calvino", "Fp 2:5"); o próprio id se desconhecido. */
  labelOf: (citeId: string) => string;
}

export interface RangeEdges {
  count: number | null;
  prev: Vid | null;
  next: Vid | null;
}

// Quando o resumo da IA começa na folha de estudo. Modelo puro: sem React e sem banco. Com a folha em "espiar" o
// resumo só começa depois que a seleção fica parada (o leitor pode estar arrastando as alças ou trocando de versículo).
import type { Detent } from '@/design';

/** Tempo parado na seleção, com a folha em espiar, antes de a IA começar o resumo. */
export const PEEK_DWELL_MS = 700;

export interface SummaryStartState {
  detent: Detent;
  /** Tempo, em ms, que a unidade e o detent ficaram sem mudar. */
  dwellMs: number;
  hasProvider: boolean;
  /** Painel da perícope e contexto de texto já prontos. */
  ctxReady: boolean;
  /** Estado da geração do resumo da perícope (undefined = nunca começou). */
  status: 'idle' | 'streaming' | 'done' | 'error' | undefined;
}

/** Vale começar o resumo agora? Folha fechada nunca; já pronto ou com erro não recomeça sozinho. */
export function shouldStartSummary(s: SummaryStartState): boolean {
  if (s.detent === 'closed' || !s.hasProvider || !s.ctxReady) return false;
  if (s.status === 'done' || s.status === 'error') return false;
  if (s.detent === 'peek') return s.dwellMs >= PEEK_DWELL_MS;
  return true;
}

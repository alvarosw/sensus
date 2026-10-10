// Esqueleto — implementado pelo agente da folha de estudo.
// Painel determinístico + contexto serializado para a IA, por intervalo (com cache em memória).
import type { PanelData, Vid } from '@sensus/core';
import type { RichTextContext, SerializedContext } from '@sensus/core';

export interface PassagePanel {
  panel: PanelData | null;
  /** Contexto serializado enviado à IA (texto + cite_ids). */
  context: SerializedContext | null;
  /** Para interpretar respostas (rótulos de citação, tokens). */
  richCtx: RichTextContext | null;
  /** Unidade literária (perícope) que contém o intervalo. */
  unit: { start: Vid; end: Vid } | null;
  loading: boolean;
  error: string | null;
}

export function usePassagePanel(_range: { start: Vid; end: Vid } | null): PassagePanel {
  return { panel: null, context: null, richCtx: null, unit: null, loading: false, error: null };
}

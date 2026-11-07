// Regras puras da tela de tradições (sem React, sem banco): agrupar as fontes de comentário do banco ativo por
// tradição e alternar tradições e fontes escondidas. Quem grava é app-prefs; aqui só se calcula o próximo valor.
import { sourceShort, traditionLabel, type Source } from '@sensus/core';

export interface TraditionGroup {
  /** Id da tradição no registro (ex.: 'adventist'). */
  tradition: string;
  /** Rótulo pt-BR (traditionLabel). */
  label: string;
  sources: Source[];
}

/** Fontes de comentário do banco, agrupadas por tradição (ordem pelo rótulo). Fonte sem tradição fica de fora. */
export function commentaryGroups(sources: readonly Source[]): TraditionGroup[] {
  const byTradition = new Map<string, Source[]>();
  for (const s of sources) {
    if (s.kind !== 'commentary' || !s.tradition) continue;
    const list = byTradition.get(s.tradition) ?? [];
    list.push(s);
    byTradition.set(s.tradition, list);
  }
  return [...byTradition.entries()]
    .map(([tradition, list]) => ({
      tradition,
      label: traditionLabel(tradition),
      sources: [...list].sort((a, b) => sourceShort(a.id, a.title).localeCompare(sourceShort(b.id, b.title), 'pt-BR')),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

/**
 * Marca ou desmarca uma tradição. Com "todas" (null), marcar uma significa "só esta". Desmarcar a última volta
 * para "todas", porque uma lista vazia esconderia todos os comentários.
 */
export function toggleTradition(current: readonly string[] | null, tradition: string): string[] | null {
  const base = current ?? [];
  const next = base.includes(tradition) ? base.filter((t) => t !== tradition) : [...base, tradition];
  return next.length > 0 ? next : null;
}

/** Esconde ou mostra uma fonte. */
export function toggleHiddenSource(hidden: readonly string[], sourceId: string): string[] {
  return hidden.includes(sourceId) ? hidden.filter((id) => id !== sourceId) : [...hidden, sourceId];
}

/** Tradição do filtro de estudo ainda visível: se a preferência escondeu a tradição escolhida, não há filtro. */
export function visibleTradition(active: string | null, visible: readonly string[]): string | null {
  return active !== null && visible.includes(active) ? active : null;
}

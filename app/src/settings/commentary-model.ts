// Regras puras da tela de tradições (sem React, sem banco): agrupar as fontes de comentário do banco ativo por
// tradição e alternar tradições e fontes escondidas. Quem grava é app-prefs; aqui só se calcula o próximo valor.
import { sourceShort, traditionLabel, type AppLang, type CommentaryPreference, type Source } from '@sensus/core';
import { COMMENTARY_STRINGS } from './commentary-strings';

export interface TraditionGroup {
  /** Id da tradição no registro (ex.: 'adventist'). */
  tradition: string;
  /** Rótulo pt-BR (traditionLabel). */
  label: string;
  sources: Source[];
}

/** Fontes de comentário do banco, agrupadas por tradição (ordem pelo rótulo). Fonte sem tradição fica de fora. */
export function commentaryGroups(sources: readonly Source[], lang: AppLang = 'pt'): TraditionGroup[] {
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
      label: traditionLabel(tradition, lang),
      sources: [...list].sort((a, b) => sourceShort(a.id, a.title).localeCompare(sourceShort(b.id, b.title))),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
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

/**
 * Resumo da preferência para a linha de Configurações, no idioma pedido: "Todas as tradições", "Só adventista",
 * "Adventista e reformada", "Adventista, reformada e mais 2"; fontes ocultas acrescentam "· 3 fontes ocultas".
 * `strings` é a tabela do idioma atual (COMMENTARY_STRINGS); os rótulos das tradições vêm do núcleo.
 */
export function describePreference(
  pref: CommentaryPreference,
  lang: AppLang,
  strings: Pick<typeof COMMENTARY_STRINGS, 'allTraditions' | 'onlyTradition' | 'twoTraditions' | 'manyTraditions' | 'hiddenSources'> = COMMENTARY_STRINGS,
): string {
  const names = (pref.traditions ?? []).map((t) => traditionLabel(t, lang));
  const base =
    names.length === 0
      ? strings.allTraditions
      : names.length === 1
        ? strings.onlyTradition(names[0]!)
        : names.length === 2
          ? strings.twoTraditions(names[0]!, names[1]!)
          : strings.manyTraditions(names[0]!, names[1]!, names.length - 2);
  const n = pref.hiddenSources.length;
  return n === 0 ? base : `${base} · ${strings.hiddenSources(n)}`;
}

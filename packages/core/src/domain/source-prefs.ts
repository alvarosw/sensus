// Preferência de comentários: quais tradições e quais fontes de comentário o leitor quer ver no estudo inteiro
// (lentes, painel e contexto da IA). Regra pura; quem aplica é o Repo (filtro na consulta), nunca a tela sozinha.
// Rótulos das tradições vêm de `traditionLabel` (registro de fontes), nunca de literais aqui.
import { traditionLabel } from './sources';

export interface CommentaryPreference {
  /** Tradições aceitas (ids do registro, ex.: 'adventist'); null = todas. Lista vazia equivale a null. */
  traditions: string[] | null;
  /** Fontes escondidas uma a uma (ids), mesmo quando a tradição é aceita. */
  hiddenSources: string[];
}

export const ALL_COMMENTARIES: CommentaryPreference = { traditions: null, hiddenSources: [] };

/**
 * A fonte de comentário passa pela preferência? Escondida individualmente vence. Sem tradição (null) só passa
 * quando a preferência aceita todas.
 */
export function isCommentaryAllowed(sourceId: string, tradition: string | null, pref: CommentaryPreference): boolean {
  if (pref.hiddenSources.includes(sourceId)) return false;
  if (pref.traditions === null) return true;
  return tradition !== null && pref.traditions.includes(tradition);
}

/** Lista só com strings não vazias, sem repetição. Outro formato devolve lista vazia. */
function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0))];
}

/**
 * Lê a preferência gravada no aparelho. Tolerante: qualquer coisa fora do formato (ou lista vazia de tradições)
 * vira ALL_COMMENTARIES, para que um arquivo estranho nunca esconda os comentários sem aviso.
 */
export function parseCommentaryPreference(input: unknown): CommentaryPreference {
  if (!input || typeof input !== 'object') return { traditions: null, hiddenSources: [] };
  const raw = input as { traditions?: unknown; hiddenSources?: unknown };
  const traditions = stringList(raw.traditions);
  return {
    traditions: traditions.length > 0 ? traditions : null,
    hiddenSources: stringList(raw.hiddenSources),
  };
}

/**
 * Resumo da preferência para a linha de Configurações: "Todas as tradições", "Só adventista",
 * "Adventista e reformada", "Adventista, reformada e mais 2"; fontes escondidas acrescentam "· 3 fontes ocultas".
 */
export function describePreference(pref: CommentaryPreference): string {
  const base = describeTraditions(pref.traditions);
  const n = pref.hiddenSources.length;
  if (n === 0) return base;
  return `${base} · ${n} ${n === 1 ? 'fonte oculta' : 'fontes ocultas'}`;
}

function describeTraditions(traditions: readonly string[] | null): string {
  if (!traditions || traditions.length === 0) return 'Todas as tradições';
  const names = traditions.map((t) => traditionLabel(t));
  if (names.length === 1) return `Só ${names[0]}`;
  const [first, ...rest] = names;
  const head = `${first!.charAt(0).toUpperCase()}${first!.slice(1)}`;
  if (names.length === 2) return `${head} e ${rest[0]}`;
  return `${head}, ${rest[0]} e mais ${names.length - 2}`;
}

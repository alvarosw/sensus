// Regras puras das lentes da folha (sem React nem banco): seleção de versículos, deduplicação de lugares, filtros de
// tradição e autor, matriz de comentários e montagem da comparação (texto traduzido × original do testamento).
import {
  dirOf,
  isIntroVid,
  scriptOf,
  traditionLabel,
  type Dir,
  type Entity,
  type PanelData,
  type Token,
  type VerseRange,
  type Vid,
} from '@sensus/core';
import { chv } from '../common/format';
import type { CommentaryView } from './format';

/** Fonte da coluna de comparação da lente Texto: traduções corridas ou o original do testamento do trecho. */
export type CompareKey = 'blivre' | 'kjv' | 'original';

type Historical = PanelData['layers']['historical'];
type Literary = PanelData['layers']['literary'];
type Place = Entity & { lat: number; lon: number };

/** Versículos da seleção que têm tradução no painel, sem repetição e em ordem. */
export function selectedVids(translations: readonly { vid: Vid }[], range: VerseRange): Vid[] {
  const set = new Set<Vid>();
  for (const v of translations) if (v.vid >= range.start && v.vid <= range.end) set.add(v.vid);
  return [...set].sort((a, b) => a - b);
}

/** Ordem de preferência entre fontes de lugar: a fonte com coordenadas mais confiável vence o mesmo nome. */
function placeRank(e: Entity): number {
  return e.source_id === 'theographic' ? 0 : e.source_id === 'openbible-geo' ? 1 : 2;
}

/** Lugares com coordenadas, um por nome (o de fonte mais preferida). */
export function dedupePlaces(entities: readonly Entity[]): Place[] {
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const e of [...entities].sort((a, b) => placeRank(a) - placeRank(b))) {
    if (e.type !== 'place' || e.lat == null || e.lon == null) continue;
    const k = e.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e as Place);
  }
  return out;
}

export interface HistoricalParts {
  places: Place[];
  /** Pessoas e grupos: sem lugares, sem eventos da linha do tempo e sem nome repetido. */
  people: Entity[];
  dic: Historical['dictionary'];
  events: Historical['events'];
}

export function historicalParts(h: Historical): HistoricalParts {
  const places = dedupePlaces(h.entities);
  const placeNames = new Set(places.map((p) => p.name.toLowerCase()));
  // Eventos que já estão na linha do tempo não se repetem em "Pessoas e grupos".
  const inTimeline = new Set(h.events.map((e) => e.cite_id));
  const seen = new Set<string>();
  const people = h.entities.filter((e) => {
    if (placeNames.has(e.name.toLowerCase()) || (e.type === 'place' && e.lat != null) || inTimeline.has(e.cite_id)) return false;
    const k = e.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { places, people, dic: h.dictionary, events: h.events };
}

/** Tradição pt-BR do filtro ativo (null = todas). */
export function activeTraditionOf(tradition: string | null): string | null {
  return tradition ? traditionLabel(tradition) : null;
}

export function commentaryTraditions(views: readonly CommentaryView[]): string[] {
  return [...new Set(views.map((v) => v.tradition).filter(Boolean))];
}

export function filterCommentaries(views: readonly CommentaryView[], tradition: string | null, author: string | null): CommentaryView[] {
  return views.filter((v) => (!tradition || v.tradition === tradition) && (!author || v.author === author));
}

export interface CommentaryMatrix {
  vids: Vid[];
  cols: { key: string; label: string }[];
}

/** Linhas (versículos do trecho, sem introduções) e colunas (autores) da matriz de comentários. */
export function commentaryMatrix(views: readonly CommentaryView[], range: VerseRange): CommentaryMatrix {
  const vids = [
    ...new Set(
      views.flatMap((v) => {
        const out: Vid[] = [];
        for (let x = Math.max(v.commentary.start_vid, range.start); x <= Math.min(v.commentary.end_vid, range.end); x++) {
          if (isIntroVid(x)) continue;
          out.push(x);
          if (out.length > 60) break;
        }
        return out;
      }),
    ),
  ].sort((a, b) => a - b);
  const cols: { key: string; label: string }[] = [];
  for (const v of views) if (!cols.some((c) => c.key === v.column)) cols.push({ key: v.column, label: v.column });
  return { vids: vids.slice(0, 24), cols: cols.slice(0, 9) };
}

export interface CommentaryHit {
  citeId: string;
  span: boolean;
  label: string;
}

/** Busca (versículo, coluna) → comentário que o cobre; o primeiro da coluna vence. Cobre até 80 versículos por comentário. */
export function commentaryHitIndex(views: readonly CommentaryView[]): (vid: number, col: string) => CommentaryHit | undefined {
  const index = new Map<string, CommentaryView>();
  for (const v of views) {
    for (let x = v.commentary.start_vid; x <= v.commentary.end_vid && x - v.commentary.start_vid < 80; x++) {
      const k = `${x}|${v.column}`;
      if (!index.has(k)) index.set(k, v);
    }
  }
  return (vid, col) => {
    const v = index.get(`${vid}|${col}`);
    return v ? { citeId: v.commentary.cite_id, span: v.commentary.start_vid !== v.commentary.end_vid, label: `${v.author} ${chv(vid)}` } : undefined;
  };
}

export interface LiteraryNeighborhood {
  before: Literary['before'];
  after: Literary['after'];
}

/** Dois versículos antes e dois depois do trecho (fora dele). */
export function literaryNeighborhood(lit: Pick<Literary, 'before' | 'after'>, range: VerseRange): LiteraryNeighborhood {
  return {
    before: lit.before.filter((v) => v.vid < range.start).slice(-2),
    after: lit.after.filter((v) => v.vid > range.end).slice(0, 2),
  };
}

/**
 * Cabeçalho da lente Texto. Sem variantes entre edições no trecho (variantCount null, só AT), o contador traz só os
 * versículos; com variantes, traz a contagem delas.
 */
export function textoCountLabel(vids: number, variantCount: number | null): string {
  if (variantCount === null) return `${vids} vv`;
  return `${vids} vv · ${variantCount} ${variantCount === 1 ? 'variante' : 'variantes'}`;
}

/** Divisões (títulos e parágrafos do original) que começam dentro do trecho. */
export function passageDivisions<T extends { vid: Vid }>(divisions: readonly T[], range: VerseRange): T[] {
  return divisions.filter((d) => d.vid >= range.start && d.vid <= range.end);
}

/** Uma linha da comparação: texto de tradução, palavras do original (com a direção da escrita) ou nada a mostrar. */
export type CompareRow =
  | { vid: Vid; kind: 'text'; text: string }
  | { vid: Vid; kind: 'original'; tokens: Token[]; dir: Dir }
  | { vid: Vid; kind: 'empty' };

/**
 * Monta as linhas da comparação de cada versículo. Para o original, as palavras já vêm do testamento certo (ver
 * originalTokensByVid); a direção sai da escrita da primeira palavra (hebraico: rtl).
 */
export function compareRows(
  vids: readonly Vid[],
  compare: CompareKey,
  translations: readonly { source_id: string; vid: Vid; text: string }[],
  originals: ReadonlyMap<Vid, readonly Token[]>,
): CompareRow[] {
  const byVid = new Map<string, string>();
  for (const t of translations) byVid.set(`${t.source_id}:${t.vid}`, t.text);
  return vids.map((vid): CompareRow => {
    if (compare === 'original') {
      const tokens = originals.get(vid);
      if (!tokens || tokens.length === 0) return { vid, kind: 'empty' };
      return { vid, kind: 'original', tokens: [...tokens], dir: dirOf(scriptOf(tokens[0]!.surface)) };
    }
    const text = byVid.get(`${compare}:${vid}`);
    return text == null ? { vid, kind: 'empty' } : { vid, kind: 'text', text };
  });
}

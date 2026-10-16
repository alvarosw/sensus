// O fio do trecho (Visão geral em passos): montagem pura dos passos a partir do painel determinístico.
// Ordem narrativa e títulos fixos; cada passo tem a evidência do banco (aparece antes da IA) e a lente que
// a sustenta. Passos sem dados são omitidos; Aplicação só aparece quando há IA (não tem fonte própria).
import {
  commentatorName,
  titleCaseHeadword,
  variantSites,
  type Book,
  type PanelData,
  type Vid,
} from '@sensus/core';
import { bareWord, chv, isOldTestament, keyWordsOf, refShort } from './format';
import { STUDY } from './strings';

export type ThreadLensKey = 'literario' | 'lingua' | 'texto' | 'intertexto' | 'historico' | 'interpretacao' | 'aplicacao';

/** Ordem da narrativa (não é a ordem das lentes na folha). */
export const THREAD_ORDER: readonly ThreadLensKey[] = [
  'literario',
  'lingua',
  'texto',
  'intertexto',
  'historico',
  'interpretacao',
  'aplicacao',
];

export const THREAD_TITLES: Record<ThreadLensKey, string> = {
  literario: 'Onde estamos',
  lingua: 'A palavra que move o trecho',
  texto: 'Os manuscritos divergem',
  intertexto: 'Ecos em outros textos',
  historico: 'Pessoas, lugares e contexto',
  interpretacao: 'Como a igreja leu',
  aplicacao: 'E para nós',
};

/** Quantos nomes do histórico e de comentaristas aparecem antes de "e mais N". */
const MAX_NAMES = 3;
const MAX_COMMENTATORS = 5;

export type ThreadEvidence =
  /** Versículo vizinho anterior (Literário). */
  | { kind: 'verse'; ref: string; text: string }
  /** Palavra mais rara do trecho (Língua). `note` = "hápax" ou "N vv. no NT/AT". */
  | { kind: 'word'; tokenCiteId: string; lemma: string; gloss: string | null; note: string | null }
  /** Primeiro sítio de variação entre TR, BYZ e NA (Texto). */
  | { kind: 'variants'; ref: string; readings: Array<{ text: string; editions: string[] }> }
  /** Referência cruzada de maior peso (Intertexto). */
  | { kind: 'xref'; ref: string; text: string; citeId: string }
  /** Entidades e verbetes (Histórico). */
  | { kind: 'names'; names: string[] }
  /** Comentaristas (Interpretação); `more` = quantos ficaram de fora. */
  | { kind: 'commentators'; names: string[]; more: number };

export interface ThreadStep {
  lens: ThreadLensKey;
  title: string;
  /** null no passo Aplicação: não tem fonte própria. */
  evidence: ThreadEvidence | null;
}

export interface ThreadInput {
  panel: PanelData | null;
  /** Seleção do leitor (o painel é da seleção). */
  range: { start: Vid; end: Vid };
  books: readonly Book[];
  /** Há IA configurada: só então o passo Aplicação aparece. */
  hasAi: boolean;
}

/**
 * Passos do fio, na ordem narrativa. Sem painel, nenhum passo (a folha ainda carrega). Um passo sem
 * evidência no banco é omitido; Aplicação entra só com IA.
 */
export function buildThread({ panel, range, books, hasAi }: ThreadInput): ThreadStep[] {
  if (!panel) return [];
  const evidence: Record<ThreadLensKey, ThreadEvidence | null> = {
    literario: literaryEvidence(panel, range, books),
    lingua: languageEvidence(panel),
    texto: textEvidence(panel),
    intertexto: intertextEvidence(panel, books),
    historico: historicalEvidence(panel),
    interpretacao: interpretationEvidence(panel),
    aplicacao: null,
  };
  const steps: ThreadStep[] = [];
  for (const lens of THREAD_ORDER) {
    if (lens === 'aplicacao') {
      if (hasAi) steps.push({ lens, title: THREAD_TITLES[lens], evidence: null });
      continue;
    }
    const ev = evidence[lens];
    if (ev) steps.push({ lens, title: THREAD_TITLES[lens], evidence: ev });
  }
  return steps;
}

/** Versículo anterior ao início da seleção, o mais próximo (último da lista de vizinhos). */
function literaryEvidence(panel: PanelData, range: { start: Vid; end: Vid }, books: readonly Book[]): ThreadEvidence | null {
  const before = panel.layers.literary.before.filter((v) => v.vid < range.start).at(-1);
  if (!before) return null;
  return { kind: 'verse', ref: refShort(before.vid, before.vid, books, true), text: before.text };
}

/** Palavra mais rara do trecho (keyWordsOf já ordena do hápax para as mais comuns). */
function languageEvidence(panel: PanelData): ThreadEvidence | null {
  const word = keyWordsOf(panel)[0];
  if (!word) return null;
  const t = word.token;
  const note = word.count === 1 ? STUDY.hapax : word.count > 1 ? STUDY.factVv(word.count, isOldTestament(word.strongBase)) : null;
  return {
    kind: 'word',
    tokenCiteId: t.cite_id,
    lemma: word.lexicon?.lemma ?? t.lemma ?? bareWord(t.surface),
    gloss: word.lexicon?.gloss ?? t.gloss_en,
    note,
  };
}

/** Primeiro sítio de variação do trecho: as leituras com as edições que as trazem. */
function textEvidence(panel: PanelData): ThreadEvidence | null {
  const site = variantSites(panel.layers.text.original)[0];
  if (!site) return null;
  return {
    kind: 'variants',
    ref: chv(site.vid),
    readings: site.readings.map((r) => ({
      editions: r.editions,
      text: r.tokens.map((t) => bareWord(t.surface)).join(' ') || STUDY.omits,
    })),
  };
}

/** Referência cruzada de maior peso (empate: a primeira da lista). */
function intertextEvidence(panel: PanelData, books: readonly Book[]): ThreadEvidence | null {
  let top: (typeof panel.layers.intertext.xrefs)[number] | undefined;
  for (const x of panel.layers.intertext.xrefs) if (!top || (x.weight ?? 0) > (top.weight ?? 0)) top = x;
  if (!top) return null;
  return {
    kind: 'xref',
    ref: refShort(top.to_start_vid, top.to_end_vid, books, true),
    text: top.texts.map((t) => t.text).join(' '),
    citeId: top.cite_id,
  };
}

/** Entidades primeiro, depois verbetes; sem repetir nome. */
function historicalEvidence(panel: PanelData): ThreadEvidence | null {
  const all = [
    ...panel.layers.historical.entities.map((e) => e.name),
    ...panel.layers.historical.dictionary.map((d) => titleCaseHeadword(d.headword)),
  ];
  const names = [...new Set(all.map((n) => n.trim()).filter(Boolean))];
  if (names.length === 0) return null;
  return { kind: 'names', names: names.slice(0, MAX_NAMES) };
}

/** Comentaristas distintos (sem introduções de capítulo/livro), com "e mais N" depois de 5. */
function interpretationEvidence(panel: PanelData): ThreadEvidence | null {
  const names = [
    ...new Set(
      panel.layers.interpretation.commentaries
        .filter((c) => c.start_vid % 1000 !== 0 && c.end_vid % 1000 !== 0)
        .map((c) => commentatorName(panel.sources[c.source_id], c)),
    ),
  ];
  if (names.length === 0) return null;
  return { kind: 'commentators', names: names.slice(0, MAX_COMMENTATORS), more: Math.max(0, names.length - MAX_COMMENTATORS) };
}

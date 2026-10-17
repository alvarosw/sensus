// O fio do trecho (Visão geral em passos): montagem pura dos passos a partir do painel determinístico.
// Ordem narrativa e títulos fixos; cada passo tem a evidência do banco (aparece antes da IA) e a lente que
// a sustenta. Passos sem dados são omitidos; Aplicação só aparece quando há IA (não tem fonte própria).
// Língua espera a escolha da IA (esqueleto) e, sem ela, usa os fallbacks de keyword.ts.
import {
  commentatorOf,
  isIntroCommentary,
  testamentOfCorpus,
  titleCaseHeadword,
  variantSites,
  type Book,
  type PanelData,
  type SectionKey,
  type StructuredSummary,
  type Vid,
} from '@sensus/core';
import { bareWord, chv, lexiconOfToken, refShort } from './format';
import { chooseKeyWord, citedIdsOf, type WordAi, type WordBy } from './keyword';
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
  /** Palavra que move o trecho (Língua). `note` = "hápax" ou a contagem no testamento; `by` diz de onde veio a escolha. */
  | { kind: 'word'; tokenCiteId: string; lemma: string; gloss: string | null; note: string | null; by: WordBy; mentions?: number }
  /** Língua aguardando a escolha da IA: o passo mostra um esqueleto no lugar da evidência. */
  | { kind: 'pending' }
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

/** Estado da IA para o fio. */
export interface ThreadAi {
  /** 'noprovider' = sem IA configurada (sem Aplicação); 'error' = falhou (o fio segue sem esperar a IA). */
  status: 'noprovider' | 'waiting' | 'streaming' | 'done' | 'error';
  /** Resumo recebido até agora (null antes do primeiro pedaço). */
  summary: StructuredSummary | null;
}

export interface ThreadInput {
  panel: PanelData | null;
  /** Seleção do leitor (o painel é da seleção). */
  range: { start: Vid; end: Vid };
  books: readonly Book[];
  ai: ThreadAi;
}

/** Seções que vêm depois de @lingua no resumo (ordem de SUMMARY_FORMAT, não a de exibição). */
const AFTER_LINGUA: readonly SectionKey[] = ['texto', 'intertexto', 'historico', 'interpretacao', 'aplicacao'];

/**
 * Passos do fio, na ordem narrativa. Sem painel, nenhum passo (a folha ainda carrega). Um passo sem
 * evidência no banco é omitido; Aplicação entra só com IA.
 */
export function buildThread({ panel, range, books, ai }: ThreadInput): ThreadStep[] {
  if (!panel) return [];
  const hasAi = ai.status !== 'noprovider';
  const evidence: Record<ThreadLensKey, ThreadEvidence | null> = {
    literario: literaryEvidence(panel, range, books),
    lingua: languageEvidence(panel, range, wordAiOf(ai)),
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

/** Estado da IA em termos da escolha da palavra: com a IA ativa, a seção @lingua termina quando a seguinte começa. */
function wordAiOf({ status, summary }: ThreadAi): WordAi {
  const linguaDone = status === 'done' || AFTER_LINGUA.some((k) => summary?.sections[k] !== undefined);
  return {
    active: status === 'waiting' || status === 'streaming' || status === 'done',
    keyWordCiteId: summary?.keyWordCiteId ?? null,
    linguaCiteIds: citedIdsOf(summary?.sections.lingua ?? []),
    linguaDone,
  };
}

/** Versículo anterior ao início da seleção, o mais próximo (último da lista de vizinhos). */
function literaryEvidence(panel: PanelData, range: { start: Vid; end: Vid }, books: readonly Book[]): ThreadEvidence | null {
  const before = panel.layers.literary.before.filter((v) => v.vid < range.start).at(-1);
  if (!before) return null;
  return { kind: 'verse', ref: refShort(before.vid, before.vid, books, true), text: before.text };
}

/** Palavra que move o trecho: a escolha de keyword.ts (IA, depois fallbacks), com a evidência do verbete. */
function languageEvidence(panel: PanelData, range: { start: Vid; end: Vid }, ai: WordAi): ThreadEvidence | null {
  const choice = chooseKeyWord(panel, range, ai);
  if (choice.state === 'pending') return { kind: 'pending' };
  if (choice.state === 'none') return null;
  const { token: t, by, mentions } = choice.pick;
  const sb = t.strong_base;
  const lexicon = lexiconOfToken(panel, t);
  const count = sb ? (panel.layers.language.concordance[sb]?.count ?? 0) : 0;
  const note = count === 1 ? STUDY.hapax : count > 1 ? STUDY.factVv(count, testamentOfCorpus(t.corpus)) : null;
  return {
    kind: 'word',
    tokenCiteId: t.cite_id,
    lemma: lexicon?.lemma ?? t.lemma ?? bareWord(t.surface),
    gloss: lexicon?.gloss ?? t.gloss_en,
    note,
    by,
    ...(mentions !== undefined ? { mentions } : {}),
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
        .filter((c) => !isIntroCommentary(c))
        .map((c) => commentatorOf(panel.sources[c.source_id], c)),
    ),
  ];
  if (names.length === 0) return null;
  return { kind: 'commentators', names: names.slice(0, MAX_COMMENTATORS), more: Math.max(0, names.length - MAX_COMMENTATORS) };
}

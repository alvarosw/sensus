// Estado compartilhado da experiência ler → selecionar → estudar → perguntar.
// Contrato entre leitor, folha de estudo e chat flutuante (agentes diferentes implementam cada parte).
// Só estado e ações síncronas; streaming de IA e consultas ao banco ficam nos módulos de feature.
// Nada aqui é persistido (regra do projeto: conteúdo de IA não é salvo).
import { create } from 'zustand';
import type { SectionKey, Vid } from '@sensus/core';
import type { Detent } from '../design/tokens';

/** Lentes da folha: visão geral + seções do resumo. */
export type LensKey = 'visao' | SectionKey;
export const LENS_KEYS: readonly LensKey[] = ['visao', 'texto', 'literario', 'historico', 'lingua', 'intertexto', 'interpretacao', 'aplicacao'];
export const LENS_LABELS: Record<LensKey, string> = {
  visao: 'Visão geral',
  texto: 'Texto',
  literario: 'Literário',
  historico: 'Histórico',
  lingua: 'Língua',
  intertexto: 'Intertexto',
  interpretacao: 'Interpretação',
  aplicacao: 'Aplicação',
};

export interface Selection {
  start: Vid;
  end: Vid;
  /** Versículo do primeiro toque (o intervalo se estende a partir dele). */
  anchor: Vid;
}

/** Item anexado a uma pergunta (aparece como chip no composer e no balão da pergunta). */
export interface Attachment {
  /** Único por item (ex.: o cite_id, "claim:<lente>-<i>", "var:<vid>"). */
  id: string;
  kind: 'verse' | 'token' | 'cite' | 'claim' | 'variant' | 'xref' | 'card';
  /** Rótulo curto do chip. */
  label: string;
  /** cite_ids que este anexo representa (vão para o contexto da pergunta). */
  citeIds?: string[];
  /** Texto do anexo quando não é um registro (ex.: parágrafo da IA). */
  text?: string;
}

export interface ChatTurn {
  id: string;
  question: string;
  attachments: Attachment[];
  /** Intervalo selecionado no momento da pergunta. */
  range: { start: Vid; end: Vid } | null;
  /** Texto bruto da IA (com marcadores [[cite_id]] e @perguntas); a UI interpreta com parseStructuredAnswer. */
  answer: string;
  status: 'streaming' | 'done' | 'error';
  error?: string;
  /** Modelo de raciocínio ainda pensando (nenhum texto da resposta chegou): a UI mostra "pensando…". */
  thinking?: boolean;
}

/** Painéis empilhados em tela cheia, com trilha de volta. */
export type PanelEntry =
  | { kind: 'word'; tokenCiteId: string }
  | { kind: 'lemma'; strongBase: string }
  | { kind: 'source'; citeId: string }
  | { kind: 'entity'; citeId: string };

/** Geração de IA (resumo por pericope e "Detalhar" por lente). Chave: `${unitStart}-${unitEnd}` (+ `:${lens}`). */
export interface Generation {
  text: string;
  status: 'idle' | 'streaming' | 'done' | 'error';
  error?: string;
  /** Raciocínio em curso, sem texto ainda (ver ChatTurn.thinking). */
  thinking?: boolean;
}

export interface BubblePosition {
  side: 'left' | 'right';
  /** Distância da base em px; null = posição padrão para a altura atual da folha. */
  bottom: number | null;
}

export interface StudyState {
  // ---- leitor ----
  /** Fonte do texto corrido ('blivre' | 'kjv'). */
  textSource: string;
  /** Grego TR sob os versículos selecionados (botão Αα). */
  greek: boolean;
  /** Referência cruzada fixada no topo do leitor ("lado a lado"). */
  pinned: { citeId: string; start: Vid; end: Vid } | null;
  /** Versículo para rolar até e realçar brevemente ("ir para"); o leitor zera após consumir. */
  jumpTarget: Vid | null;

  // ---- seleção ----
  selection: Selection | null;
  /** Seleção anterior, para "desfazer" após reduzir. */
  previousSelection: Selection | null;

  // ---- folha de estudo ----
  detent: Detent;
  /** Lente visível (sincronizada com o trilho e a rolagem). */
  lens: LensKey;
  /** Lente para a qual a folha deve rolar (consumido pela folha). */
  lensTarget: LensKey | null;
  compare: 'blivre' | 'kjv' | 'tr';
  /** Filtro de tradição na lente de interpretação (null = todas). */
  tradition: string | null;
  /** "Ver todos" por lente/grupo. */
  expanded: Record<string, boolean>;
  generations: Record<string, Generation>;

  // ---- prévia e painéis ----
  popoverCite: string | null;
  panels: PanelEntry[];

  // ---- chat ----
  chatOpen: boolean;
  unread: number;
  bubble: BubblePosition;
  attachments: Attachment[];
  thread: ChatTurn[];
  /** Pergunta pronta (sugerida numa lente, "Detalhar" etc.) para o chat enviar assim que abrir; o chat zera após consumir. */
  pendingQuestion: string | null;

  // ---- aviso ----
  toast: { text: string; actionLabel?: string; onAction?: () => void } | null;

  // ---- ações ----
  setTextSource(id: string): void;
  toggleGreek(): void;
  pin(p: StudyState['pinned']): void;
  jumpTo(vid: Vid | null): void;

  /** Toque em versículo: sem seleção → seleciona; fora do intervalo → estende a partir da âncora; dentro → reduz (guarda desfazer). */
  tapVerse(vid: Vid): void;
  setSelection(start: Vid, end: Vid, anchor?: Vid): void;
  undoSelection(): void;
  clearSelection(): void;

  setDetent(d: Detent): void;
  setLens(l: LensKey): void;
  goToLens(l: LensKey): void;
  consumeLensTarget(): void;
  setCompare(c: StudyState['compare']): void;
  setTradition(t: string | null): void;
  toggleExpanded(key: string): void;
  setGeneration(key: string, g: Partial<Generation>): void;
  appendGeneration(key: string, chunk: string): void;

  openPopover(citeId: string): void;
  closePopover(): void;
  pushPanel(p: PanelEntry): void;
  popPanel(): void;
  popPanelsTo(index: number): void;
  closePanels(): void;

  openChat(): void;
  closeChat(): void;
  setBubble(b: BubblePosition): void;
  attach(a: Attachment): void;
  detach(id: string): void;
  clearAttachments(): void;
  /** Cria a vez da pergunta (status streaming) e devolve o id; limpa os anexos. */
  /** Abre o chat e pede que ele envie `q` (com os anexos atuais). */
  askQuestion(q: string): void;
  consumeQuestion(): void;
  startTurn(question: string, range: ChatTurn['range']): string;
  appendTurn(id: string, chunk: string): void;
  finishTurn(id: string, error?: string): void;
  /** Reinicia uma vez (tentar de novo após erro): zera a resposta e volta a 'streaming'. */
  resetTurn(id: string): void;
  setTurnThinking(id: string, on: boolean): void;

  showToast(t: StudyState['toast']): void;
}

const ordered = (a: Vid, b: Vid): [Vid, Vid] => (a <= b ? [a, b] : [b, a]);

export const useStudy = create<StudyState>()((set, get) => ({
  textSource: 'blivre',
  greek: false,
  pinned: null,
  jumpTarget: null,
  selection: null,
  previousSelection: null,
  detent: 'closed',
  lens: 'visao',
  lensTarget: null,
  compare: 'blivre',
  tradition: null,
  expanded: {},
  generations: {},
  popoverCite: null,
  panels: [],
  chatOpen: false,
  unread: 0,
  bubble: { side: 'right', bottom: null },
  attachments: [],
  thread: [],
  pendingQuestion: null,
  toast: null,

  setTextSource: (id) => set({ textSource: id }),
  toggleGreek: () => set((s) => ({ greek: !s.greek })),
  pin: (p) => set({ pinned: p }),
  jumpTo: (vid) => set({ jumpTarget: vid }),

  tapVerse: (vid) => {
    const { selection, detent } = get();
    if (!selection) {
      set({ selection: { start: vid, end: vid, anchor: vid }, previousSelection: null, detent: detent === 'closed' ? 'peek' : detent });
      return;
    }
    if (vid >= selection.start && vid <= selection.end) {
      if (selection.start === selection.end) return;
      set({ previousSelection: selection, selection: { start: vid, end: vid, anchor: vid } });
      return;
    }
    const [start, end] = ordered(selection.anchor, vid);
    set({ selection: { start, end, anchor: selection.anchor } });
  },
  setSelection: (a, b, anchor) => {
    const [start, end] = ordered(a, b);
    set((s) => ({ selection: { start, end, anchor: anchor ?? start }, detent: s.detent === 'closed' ? 'peek' : s.detent }));
  },
  undoSelection: () => set((s) => (s.previousSelection ? { selection: s.previousSelection, previousSelection: null } : {})),
  clearSelection: () => set({ selection: null, previousSelection: null, detent: 'closed', popoverCite: null }),

  setDetent: (d) => set({ detent: d }),
  setLens: (l) => set({ lens: l }),
  goToLens: (l) => set((s) => ({ lensTarget: l, lens: l, detent: s.detent === 'peek' || s.detent === 'closed' ? 'half' : s.detent })),
  consumeLensTarget: () => set({ lensTarget: null }),
  setCompare: (c) => set({ compare: c }),
  setTradition: (t) => set({ tradition: t }),
  toggleExpanded: (key) => set((s) => ({ expanded: { ...s.expanded, [key]: !s.expanded[key] } })),
  setGeneration: (key, g) =>
    set((s) => {
      const cur: Generation = s.generations[key] ?? { text: '', status: 'idle' };
      return { generations: { ...s.generations, [key]: { ...cur, ...g } } };
    }),
  appendGeneration: (key, chunk) =>
    set((s) => {
      const cur = s.generations[key] ?? { text: '', status: 'streaming' as const };
      return { generations: { ...s.generations, [key]: { ...cur, text: cur.text + chunk } } };
    }),

  openPopover: (citeId) => set({ popoverCite: citeId }),
  closePopover: () => set({ popoverCite: null }),
  pushPanel: (p) => set((s) => ({ panels: [...s.panels, p], popoverCite: null })),
  popPanel: () => set((s) => ({ panels: s.panels.slice(0, -1) })),
  popPanelsTo: (index) => set((s) => ({ panels: s.panels.slice(0, index + 1) })),
  closePanels: () => set({ panels: [] }),

  openChat: () => set({ chatOpen: true, unread: 0, popoverCite: null }),
  closeChat: () => set({ chatOpen: false }),
  setBubble: (b) => set({ bubble: b }),
  attach: (a) => set((s) => (s.attachments.some((x) => x.id === a.id) ? {} : { attachments: [...s.attachments, a] })),
  detach: (id) => set((s) => ({ attachments: s.attachments.filter((a) => a.id !== id) })),
  clearAttachments: () => set({ attachments: [] }),
  askQuestion: (q) => set({ pendingQuestion: q, chatOpen: true, unread: 0, popoverCite: null }),
  consumeQuestion: () => set({ pendingQuestion: null }),
  startTurn: (question, range) => {
    const id = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({
      thread: [...s.thread, { id, question, attachments: s.attachments, range, answer: '', status: 'streaming' }],
      attachments: [],
    }));
    return id;
  },
  appendTurn: (id, chunk) =>
    set((s) => ({ thread: s.thread.map((t) => (t.id === id ? { ...t, answer: t.answer + chunk, thinking: false } : t)) })),
  finishTurn: (id, error) =>
    set((s) => ({
      thread: s.thread.map((t) => (t.id === id ? { ...t, status: error ? 'error' : 'done', error, thinking: false } : t)),
      unread: s.chatOpen ? s.unread : s.unread + 1,
    })),
  resetTurn: (id) =>
    set((s) => ({
      thread: s.thread.map((t) => (t.id === id ? { ...t, answer: '', status: 'streaming', error: undefined, thinking: false } : t)),
    })),
  setTurnThinking: (id, on) =>
    set((s) => ({ thread: s.thread.map((t) => (t.id === id && !!t.thinking !== on ? { ...t, thinking: on } : t)) })),

  showToast: (t) => set({ toast: t }),
}));

// Chat flutuante: aberto/fechado, anexos da próxima pergunta, a conversa e a pergunta pronta vinda de uma lente.
import type { StateCreator } from 'zustand';
import type { Vid } from '@sensus/core';
import type { StudyState } from './index';

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

export interface BubblePosition {
  side: 'left' | 'right';
  /** Distância da base em px; null = posição padrão para a altura atual da folha. */
  bottom: number | null;
}

export interface ChatSlice {
  chatOpen: boolean;
  unread: number;
  bubble: BubblePosition;
  attachments: Attachment[];
  thread: ChatTurn[];
  /** Pergunta pronta (sugerida numa lente, "Detalhar" etc.) para o chat enviar assim que abrir; o chat zera após consumir. */
  pendingQuestion: string | null;

  openChat(): void;
  closeChat(): void;
  setBubble(b: BubblePosition): void;
  attach(a: Attachment): void;
  detach(id: string): void;
  clearAttachments(): void;
  /** Abre o chat e pede que ele envie `q` (com os anexos atuais). */
  askQuestion(q: string): void;
  consumeQuestion(): void;
  /** Cria a vez da pergunta (status streaming), leva os anexos atuais para ela, limpa os anexos e devolve o id. */
  startTurn(question: string, range: ChatTurn['range']): string;
  appendTurn(id: string, chunk: string): void;
  finishTurn(id: string, error?: string): void;
  /** Reinicia uma vez (tentar de novo após erro): zera a resposta e volta a 'streaming'. */
  resetTurn(id: string): void;
  setTurnThinking(id: string, on: boolean): void;
}

export const createChatSlice: StateCreator<StudyState, [], [], ChatSlice> = (set) => ({
  chatOpen: false,
  unread: 0,
  bubble: { side: 'right', bottom: null },
  attachments: [],
  thread: [],
  pendingQuestion: null,

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
});

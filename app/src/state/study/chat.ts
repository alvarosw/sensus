// Chat flutuante: aberto/fechado, anexos (fixos até o leitor tirar, pedir nova conversa ou mudar de trecho), a
// conversa e a pergunta pronta vinda de uma lente. A conversa é de um trecho (`unitKey`): ao mudar de trecho, os
// anexos saem e um divisor marca a mudança; o histórico enviado ao modelo é só do trecho atual.
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
  /** Trecho em que o anexo foi feito (a seleção, na hora de anexar). Mudar de trecho só tira o que saiu dele. */
  origin?: { start: Vid; end: Vid };
}

/** Anexo sem os cite_ids: eles são do trecho de onde o anexo saiu. */
function withoutCites(a: Attachment): Attachment {
  const { citeIds: _citeIds, ...rest } = a;
  return rest;
}

/** O anexo veio de dentro do intervalo `unit` (fica quando o leitor muda para ele). */
function insideUnit(a: Attachment, unit: { start: Vid; end: Vid }): boolean {
  return a.origin !== undefined && a.origin.start >= unit.start && a.origin.end <= unit.end;
}

export interface ChatTurn {
  id: string;
  question: string;
  /** Cópia dos anexos usados nesta vez (o balão mostra; o histórico manda de novo). */
  attachments: Attachment[];
  /** Intervalo selecionado no momento da pergunta. */
  range: { start: Vid; end: Vid } | null;
  /** Trecho (unidade efetiva usada como contexto) em que a vez foi feita: ver `unitKeyOf`. */
  unitKey: string;
  /** Texto bruto da IA (com marcadores [[cite_id]] e @perguntas); a UI interpreta com parseStructuredAnswer. */
  answer: string;
  status: 'streaming' | 'done' | 'error';
  error?: string;
  /** Modelo de raciocínio ainda pensando (nenhum texto da resposta chegou): a UI mostra "pensando…". */
  thinking?: boolean;
}

/** Divisor "Agora em <ref>": aparece antes da vez de número `at` (`at` = tamanho da conversa na mudança). */
export interface ChatDivider {
  at: number;
  ref: string;
}

export interface BubblePosition {
  side: 'left' | 'right';
  /** Distância da base em px; null = posição padrão para a altura atual da folha. */
  bottom: number | null;
}

/** Chave do trecho: a unidade efetiva usada como contexto ("<início>-<fim>"). */
export function unitKeyOf(range: { start: Vid; end: Vid }): string {
  return `${range.start}-${range.end}`;
}

/**
 * Vezes da conversa que vão ao modelo: só as do mesmo trecho e, se `beforeId` for dado, só as anteriores a ela.
 * Uma vez com id desconhecido não tem histórico.
 */
export function historyFor(thread: readonly ChatTurn[], unitKey: string, beforeId?: string): ChatTurn[] {
  let end = thread.length;
  if (beforeId !== undefined) {
    end = thread.findIndex((t) => t.id === beforeId);
    if (end < 0) return [];
  }
  return thread.slice(0, end).filter((t) => t.unitKey === unitKey);
}

export interface ChatSlice {
  chatOpen: boolean;
  unread: number;
  bubble: BubblePosition;
  /** Anexos do composer: ficam depois de enviar; saem no × do chip, em "Nova conversa" ou ao mudar de trecho. */
  attachments: Attachment[];
  thread: ChatTurn[];
  /** Trecho da conversa (`unitKeyOf`); null antes do primeiro trecho conhecido. */
  unitKey: string | null;
  /** Divisores da conversa (um a cada mudança de trecho com vezes já feitas). */
  dividers: ChatDivider[];
  /** Pergunta pronta (sugerida numa lente, "Detalhar" etc.) para o chat enviar assim que abrir, com estes anexos; o chat zera após consumir. */
  pendingQuestion: { text: string; attachments: Attachment[] } | null;

  openChat(): void;
  closeChat(): void;
  setBubble(b: BubblePosition): void;
  attach(a: Attachment): void;
  detach(id: string): void;
  clearAttachments(): void;
  /** Abre o chat e pede que ele envie `q` com exatamente `attachments` (sem eles, por padrão; não usa os do composer). */
  askQuestion(q: string, attachments?: Attachment[]): void;
  consumeQuestion(): void;
  /**
   * Leva a conversa ao trecho `key` (`ref`: rótulo curto, para o divisor; `unit`: o intervalo do trecho). Se o trecho
   * muda, tira os anexos que não vieram de dentro de `unit` e devolve os que saíram (para o Desfazer do aviso); com
   * vezes na conversa, põe um divisor. Sem mudança, não faz nada.
   */
  moveToUnit(key: string, ref: string, unit: { start: Vid; end: Vid }): Attachment[];
  /** Devolve anexos tirados por mudança de trecho (ação "Desfazer"), sem os cite_ids. */
  restoreAttachments(list: readonly Attachment[]): void;
  /** Cria a vez (status streaming) com os anexos dados e o trecho dela, e devolve o id. Não mexe nos anexos do composer. */
  startTurn(question: string, range: ChatTurn['range'], attachments: readonly Attachment[], unitKey: string): string;
  appendTurn(id: string, chunk: string): void;
  finishTurn(id: string, error?: string): void;
  /** Reinicia uma vez (tentar de novo após erro): zera a resposta e volta a 'streaming'. */
  resetTurn(id: string): void;
  setTurnThinking(id: string, on: boolean): void;
  /** Nova conversa: zera a conversa, os divisores, os anexos e o trecho (a resposta em curso deve ser parada antes). */
  newConversation(): void;
}

export const createChatSlice: StateCreator<StudyState, [], [], ChatSlice> = (set, get) => ({
  chatOpen: false,
  unread: 0,
  bubble: { side: 'right', bottom: null },
  attachments: [],
  thread: [],
  unitKey: null,
  dividers: [],
  pendingQuestion: null,

  openChat: () => set({ chatOpen: true, unread: 0, popoverCite: null }),
  closeChat: () => set({ chatOpen: false }),
  setBubble: (b) => set({ bubble: b }),
  attach: (a) =>
    set((s) => {
      if (s.attachments.some((x) => x.id === a.id)) return {};
      // Sem origem dada, o anexo fica com a seleção atual como trecho de origem.
      const sel = s.selection;
      const origin = a.origin ?? (sel ? { start: sel.start, end: sel.end } : undefined);
      return { attachments: [...s.attachments, origin ? { ...a, origin } : a] };
    }),
  detach: (id) => set((s) => ({ attachments: s.attachments.filter((a) => a.id !== id) })),
  clearAttachments: () => set({ attachments: [] }),
  askQuestion: (q, attachments = []) => set({ pendingQuestion: { text: q, attachments }, chatOpen: true, unread: 0, popoverCite: null }),
  consumeQuestion: () => set({ pendingQuestion: null }),
  moveToUnit: (key, ref, unit) => {
    const s = get();
    if (s.unitKey === key) return [];
    // Sem trecho anterior (primeira vez), não há o que tirar: os anexos já são deste trecho.
    const kept = s.unitKey === null ? s.attachments : s.attachments.filter((a) => insideUnit(a, unit));
    const removed = s.attachments.filter((a) => !kept.includes(a));
    // Sem pergunta nova entre duas mudanças, o divisor da última vez só troca de rótulo (não empilha).
    const at = s.thread.length;
    const last = s.dividers[s.dividers.length - 1];
    let dividers = s.dividers;
    if (at > 0) dividers = last?.at === at ? [...s.dividers.slice(0, -1), { at, ref }] : [...s.dividers, { at, ref }];
    set({ unitKey: key, attachments: kept, dividers });
    return removed;
  },
  restoreAttachments: (list) =>
    set((s) => {
      const back = list.filter((a) => !s.attachments.some((x) => x.id === a.id)).map(withoutCites);
      return back.length > 0 ? { attachments: [...back, ...s.attachments] } : {};
    }),
  startTurn: (question, range, attachments, unitKey) => {
    const id = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({
      thread: [...s.thread, { id, question, attachments: [...attachments], range, unitKey, answer: '', status: 'streaming' }],
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
  newConversation: () => set({ thread: [], attachments: [], dividers: [], unitKey: null }),
});

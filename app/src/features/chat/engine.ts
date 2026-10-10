// Motor das perguntas: monta as mensagens (answerMessages), transmite a resposta (streamChat) para o estado
// compartilhado (startTurn/appendTurn/finishTurn) e cuida de cancelamento e nova tentativa.
// Nada daqui é persistido: a conversa vive só na sessão.
import {
  answerMessages,
  CHAT_MAX_TOKENS,
  type ChatAttachment,
  type ChatMessage,
  type ProviderConfig,
  type RichTextContext,
} from '@sensus/core';
import { streamChat } from '@/ai/client';
import { APP_LOCALE } from '@/i18n';
import { useStudy, type Attachment, type ChatTurn } from '@/state/study';
import { CHAT } from '../common/strings';

/** Contexto usado em cada vez (para interpretar a resposta e para tentar de novo). Só em memória. */
interface TurnMeta {
  contextText: string;
  richCtx: RichTextContext;
}
const metas = new Map<string, TurnMeta>();
const aborts = new Map<string, AbortController>();

export const EMPTY_CTX: RichTextContext = { citeIds: new Set(), citeIndex: new Map() };

export function turnCtxOf(id: string): RichTextContext | undefined {
  return metas.get(id)?.richCtx;
}

export function isStreaming(): boolean {
  return useStudy.getState().thread.some((t) => t.status === 'streaming');
}

/** Resposta sem as perguntas de seguimento: é o que vai no histórico da conversa. */
function answerForHistory(raw: string): string {
  const cut = raw.search(/^\s*@perguntas\b/im);
  return (cut >= 0 ? raw.slice(0, cut) : raw).trim();
}

function historyBefore(turnId: string): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const t of useStudy.getState().thread) {
    if (t.id === turnId) break;
    if (t.status !== 'done' || !t.answer.trim()) continue;
    out.push({ role: 'user', content: t.question }, { role: 'assistant', content: answerForHistory(t.answer) });
  }
  return out;
}

export function toChatAttachments(list: readonly Attachment[]): ChatAttachment[] {
  return list.map((a) => ({ label: a.label, citeIds: a.citeIds, text: a.text }));
}

async function execute(id: string, provider: ProviderConfig): Promise<void> {
  const store = useStudy.getState();
  const turn = store.thread.find((t) => t.id === id);
  const meta = metas.get(id);
  if (!turn || !meta) return;

  const messages = answerMessages(
    { text: meta.contextText },
    historyBefore(id),
    turn.question,
    { attachments: toChatAttachments(turn.attachments), language: APP_LOCALE },
  );

  const controller = new AbortController();
  aborts.set(id, controller);

  // Junta pedaços pequenos: um set no estado a cada ~40 ms em vez de um por pedaço.
  let buffer = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (buffer) {
      const chunk = buffer;
      buffer = '';
      useStudy.getState().appendTurn(id, chunk);
    }
  };

  // "Pensando…": o raciocínio chega antes do texto; marca a vez (uma vez por trecho) até o texto começar.
  let thinking = false;
  const onReasoning = () => {
    if (thinking) return;
    thinking = true;
    useStudy.getState().setTurnThinking(id, true);
  };

  try {
    await streamChat(
      provider,
      messages,
      (chunk) => {
        thinking = false;
        buffer += chunk;
        timer ??= setTimeout(flush, 40);
      },
      controller.signal,
      CHAT_MAX_TOKENS,
      onReasoning,
    );
    flush();
    useStudy.getState().finishTurn(id);
  } catch (e) {
    flush();
    const answered = (useStudy.getState().thread.find((t) => t.id === id)?.answer.trim().length ?? 0) > 0;
    if (controller.signal.aborted) {
      useStudy.getState().finishTurn(id, answered ? undefined : CHAT.interrupted);
    } else {
      useStudy.getState().finishTurn(id, e instanceof Error ? e.message : String(e));
    }
  } finally {
    aborts.delete(id);
  }
}

export interface AskArgs {
  provider: ProviderConfig;
  question: string;
  range: ChatTurn['range'];
  contextText: string;
  richCtx: RichTextContext;
}

/** Cria a vez (com os anexos atuais) e começa a transmitir. Devolve o id, ou null se já há resposta em curso. */
export function ask(args: AskArgs): string | null {
  if (isStreaming()) return null;
  const id = useStudy.getState().startTurn(args.question.trim(), args.range);
  metas.set(id, { contextText: args.contextText, richCtx: args.richCtx });
  void execute(id, args.provider);
  return id;
}

/** Tenta de novo uma vez com erro, com o mesmo contexto e anexos. */
export function retry(id: string, provider: ProviderConfig): void {
  if (isStreaming()) return;
  useStudy.getState().resetTurn(id);
  void execute(id, provider);
}

/** Interrompe a resposta em curso (mantém o que já chegou). */
export function stop(): void {
  for (const c of aborts.values()) c.abort();
}

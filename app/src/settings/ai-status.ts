// Textos de estado do assistente nas Configurações: linha da lista principal, linha "Em uso agora" e cartão
// ChatGPT. Função pura (sem React): recebe o estado real do provedor (settings-context) e devolve o que mostrar.
// Não decide a política de escolha: isso é de route.ts (chooseRoute), já refletido em `provider`.
// Testada em ai-status.test.ts.
import type { ProviderConfig } from '@sensus/core';
import { isPaused, type ChatGPTPause, type ProviderMode } from './route';
import type { ChatGPTAttention } from './settings-context';

export const CHATGPT_RETRY_TEXT = 'Até lá, as perguntas usam sua chave de API.';
export const NO_KEY_FALLBACK_TEXT = 'Enquanto isso, o Sensus não usa sua chave de API nessas perguntas.';

export interface AiSnapshot {
  mode: ProviderMode;
  /** Provedor efetivo agora (null = nenhum método disponível). */
  provider: ProviderConfig | null;
  /** Conta ChatGPT salva (sem tokens). null = nunca conectada. */
  account: { connected: boolean; hasSession: boolean; planEnabled: boolean; email: string | null } | null;
  attention: ChatGPTAttention;
  /** Há uma chave de API salva neste aparelho. */
  keySaved: boolean;
  /** Nome do provedor de chave, para as frases ("NVIDIA"). */
  keyLabel: string;
  /** Pausa vigente do ChatGPT (já filtrada pelo horário), ou null. */
  pause: ChatGPTPause | null;
  now: number;
}

/** Nome curto de um provedor ("NVIDIA (build.nvidia.com)" -> "NVIDIA"). */
export function shortLabel(label: string): string {
  return label.replace(/\s*\(.*\)\s*$/, '').trim();
}

/** HH:MM no horário do aparelho (sem depender de Intl). */
export function clockText(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Pausa do ChatGPT ativa no modo Automático (no modo Só ChatGPT não há reserva para pausar). */
export function pausedNow(s: Pick<AiSnapshot, 'mode' | 'pause' | 'now'>): boolean {
  return s.mode === 'auto' && isPaused(s.pause, s.now);
}

/** Atenção que bloqueia o ChatGPT. No modo Só chave a conta não é consultada, então não avisa. */
function attentionOf(s: AiSnapshot): ChatGPTAttention {
  return s.mode === 'key' ? null : s.attention;
}

export type AiWarn = 'attention' | 'paused' | 'no_method' | 'not_configured' | null;

/** Linha "Assistente de IA" da lista principal. `warn` ≠ null vira o alerta âmbar. */
export function aiSummary(s: AiSnapshot): { subtitle: string; warn: AiWarn } {
  const attention = attentionOf(s);
  if (attention === 'reauth') return { subtitle: 'Atenção · entrar de novo no ChatGPT', warn: 'attention' };
  if (attention === 'not_eligible') return { subtitle: 'Atenção · conta sem plano para o Sensus', warn: 'attention' };
  if (pausedNow(s) && s.pause) {
    const when = s.pause.known ? `volta às ${clockText(s.pause.until)}` : `nova tentativa às ${clockText(s.pause.until)}`;
    return { subtitle: `Limite atingido · ${when}`, warn: 'paused' };
  }
  if (!s.provider) {
    const connected = !!s.account?.connected;
    if (!connected && !s.keySaved) return { subtitle: 'Não configurado', warn: 'not_configured' };
    return { subtitle: 'Nenhum método disponível', warn: 'no_method' };
  }
  if (s.provider.kind === 'chatgpt') {
    return { subtitle: s.provider.fallback ? 'ChatGPT · reserva na chave de API' : 'ChatGPT · plano ativo', warn: null };
  }
  return { subtitle: `Chave de API (${s.keyLabel})`, warn: null };
}

/** Linha "Em uso agora" (lead em negrito, depois o resto). Diz qual caminho responde neste momento. */
export function inUseLine(s: AiSnapshot): { lead: string; rest: string } {
  const p = s.provider;
  if (!p) {
    if (s.mode === 'key') return { lead: 'Nenhum', rest: 'Falta a chave de API.' };
    if (s.mode === 'chatgpt') return { lead: 'Nenhum', rest: 'O ChatGPT não está pronto, e este modo não usa a chave.' };
    if (pausedNow(s) && s.pause) return { lead: 'Nenhum', rest: `até ${clockText(s.pause.until)}.` };
    return { lead: 'Nenhum', rest: 'Conecte o ChatGPT ou salve uma chave de API.' };
  }
  if (p.kind === 'chatgpt') {
    return { lead: 'ChatGPT', rest: p.fallback ? `Reserva: chave de API (${s.keyLabel}).` : 'Sem reserva.' };
  }
  const rest = pausedNow(s) && s.pause ? `até ${clockText(s.pause.until)}; depois, ChatGPT.` : '';
  return { lead: `Chave de API (${s.keyLabel})`, rest };
}

export type ChatGPTAction = 'signIn' | 'reconnect' | 'grant' | 'retryPlan' | 'resumeChatGPT' | 'signOut';

export interface ChatGPTView {
  pill: { label: string; tone: 'ok' | 'warn' | 'muted' } | null;
  lines: { text: string; muted: boolean; warn?: boolean }[];
  /** Mostra o seletor de modelos (sessão e plano ativos). */
  models: boolean;
  actions: { action: ChatGPTAction; label: string; variant: 'primary' | 'secondary' | 'ghost' }[];
}

/**
 * Cartão ChatGPT: estado (pílula, frases e ações). Cada estado tem a ação certa ao lado; a lógica de
 * cada ação fica no componente (settings-context). `available` = módulo nativo presente (build instalado).
 */
export function chatgptView(s: AiSnapshot): ChatGPTView {
  const acc = s.account;
  const linked = !!acc?.connected;
  const session = !!acc?.hasSession;
  const attention = attentionOf(s);
  const keyNote = s.mode === 'key' ? [] : [{ text: NO_KEY_FALLBACK_TEXT, muted: true }];
  const plan = 'Use o plano Go, Plus ou Pro do seu ChatGPT. Requer um desses planos.';
  const signOut = { action: 'signOut' as const, label: 'Desconectar ChatGPT', variant: 'ghost' as const };

  if (attention === 'reauth') {
    return {
      pill: { label: 'Atenção', tone: 'warn' },
      lines: [{ text: 'Sua sessão com o ChatGPT expirou ou foi recusada. Entre de novo para voltar a usar o plano.', muted: false }, ...keyNote],
      models: false,
      actions: [{ action: 'reconnect', label: 'Entrar de novo', variant: 'primary' }, signOut],
    };
  }
  if (attention === 'not_eligible') {
    return {
      pill: { label: 'Atenção', tone: 'warn' },
      lines: [{ text: 'Esta conta não tem o plano para o Sensus. Requer Go, Plus ou Pro.', muted: false }, ...keyNote],
      models: false,
      actions: [{ action: 'retryPlan', label: 'Tentar de novo', variant: 'secondary' }, signOut],
    };
  }
  if (!linked || !session) {
    if (s.keySaved) {
      return {
        pill: { label: 'Desconectado', tone: 'muted' },
        lines: [{ text: plan, muted: false }],
        models: false,
        actions: [{ action: 'signIn', label: 'Entrar com ChatGPT', variant: 'primary' }],
      };
    }
    return {
      pill: { label: 'Não configurado', tone: 'warn' },
      lines: [{ text: 'Entre com ChatGPT ou informe uma chave de API para ter resumos e perguntas.', muted: false }],
      models: false,
      actions: [{ action: 'signIn', label: 'Entrar com ChatGPT', variant: 'primary' }],
    };
  }
  if (acc && !acc.planEnabled) {
    return {
      pill: { label: 'Atenção', tone: 'warn' },
      lines: [{ text: 'Permissão do plano não concedida. Libere o uso do plano para o Sensus.', muted: false }],
      models: false,
      actions: [{ action: 'grant', label: 'Liberar o plano', variant: 'secondary' }, signOut],
    };
  }
  if (pausedNow(s) && s.pause) {
    const text = s.pause.known
      ? `Limite do plano atingido. Volta às ${clockText(s.pause.until)}.`
      : `Limite do plano atingido. Nova tentativa às ${clockText(s.pause.until)}, a cada 10 min até voltar.`;
    return {
      pill: { label: 'Limite atingido', tone: 'warn' },
      lines: [
        { text, muted: false, warn: true },
        { text: s.keySaved ? CHATGPT_RETRY_TEXT : 'Até lá, não há chave de API salva para responder.', muted: true },
      ],
      models: false,
      actions: [{ action: 'resumeChatGPT', label: 'Tentar o plano de novo', variant: 'secondary' }, signOut],
    };
  }
  return {
    pill: { label: 'Plano ativo', tone: 'ok' },
    lines: [{ text: acc?.email ?? 'Conta conectada', muted: true }],
    models: true,
    actions: [signOut],
  };
}

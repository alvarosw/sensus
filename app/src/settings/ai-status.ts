// Textos de estado do assistente nas Configurações: linha da lista principal, linha "Em uso agora" e cartão
// ChatGPT. Função pura (sem React): recebe o estado real do provedor (settings-context) e devolve o que mostrar.
// Não decide a política de escolha: isso é de route.ts (chooseRoute), já refletido em `provider`.
// Testada em ai-status.test.ts.
import type { ProviderConfig } from '@sensus/core';
import { SETTINGS_COPY } from './strings';
import { isPaused, type ChatGPTPause, type ProviderMode } from './route';
import type { ChatGPTAttention } from './settings-context';

const AI = () => SETTINGS_COPY.aiStatus;

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
  if (attention === 'reauth') return { subtitle: AI().reauth, warn: 'attention' };
  if (attention === 'not_eligible') return { subtitle: AI().notEligible, warn: 'attention' };
  if (pausedNow(s) && s.pause) {
    const when = s.pause.known ? AI().returnsAt(clockText(s.pause.until)) : AI().retryAt(clockText(s.pause.until));
    return { subtitle: AI().limitReached(when), warn: 'paused' };
  }
  if (!s.provider) {
    const connected = !!s.account?.connected;
    if (!connected && !s.keySaved) return { subtitle: AI().notConfigured, warn: 'not_configured' };
    return { subtitle: AI().noMethod, warn: 'no_method' };
  }
  if (s.provider.kind === 'chatgpt') {
    return { subtitle: s.provider.fallback ? AI().chatgptReserve : AI().chatgptActive, warn: null };
  }
  return { subtitle: AI().keyLabel(s.keyLabel), warn: null };
}

/** Linha "Em uso agora" (lead em negrito, depois o resto). Diz qual caminho responde neste momento. */
export function inUseLine(s: AiSnapshot): { lead: string; rest: string } {
  const p = s.provider;
  if (!p) {
    if (s.mode === 'key') return { lead: AI().noneLead, rest: AI().keyMissing };
    if (s.mode === 'chatgpt') return { lead: AI().noneLead, rest: AI().chatgptNotReady };
    if (pausedNow(s) && s.pause) return { lead: AI().noneLead, rest: AI().untilTime(clockText(s.pause.until)) };
    return { lead: AI().noneLead, rest: AI().connectOrKey };
  }
  if (p.kind === 'chatgpt') {
    return { lead: 'ChatGPT', rest: p.fallback ? AI().reserveKey(s.keyLabel) : AI().noReserve };
  }
  const rest = pausedNow(s) && s.pause ? AI().keyUntilThenChatGPT(clockText(s.pause.until)) : '';
  return { lead: AI().keyLabel(s.keyLabel), rest };
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
  const keyNote = s.mode === 'key' ? [] : [{ text: AI().keyNote, muted: true }];
  const plan = AI().plan;
  const signOut = { action: 'signOut' as const, label: AI().signOut, variant: 'ghost' as const };

  if (attention === 'reauth') {
    return {
      pill: { label: AI().attention, tone: 'warn' },
      lines: [{ text: AI().sessionExpiredLine, muted: false }, ...keyNote],
      models: false,
      actions: [{ action: 'reconnect', label: AI().reconnect, variant: 'primary' }, signOut],
    };
  }
  if (attention === 'not_eligible') {
    return {
      pill: { label: AI().attention, tone: 'warn' },
      lines: [{ text: AI().notEligibleLine, muted: false }, ...keyNote],
      models: false,
      actions: [{ action: 'retryPlan', label: AI().retryPlan, variant: 'secondary' }, signOut],
    };
  }
  if (!linked || !session) {
    if (s.keySaved) {
      return {
        pill: { label: AI().disconnected, tone: 'muted' },
        lines: [{ text: plan, muted: false }],
        models: false,
        actions: [{ action: 'signIn', label: AI().signIn, variant: 'primary' }],
      };
    }
    return {
      pill: { label: AI().notConfigured, tone: 'warn' },
      lines: [{ text: AI().connectHint, muted: false }],
      models: false,
      actions: [{ action: 'signIn', label: AI().signIn, variant: 'primary' }],
    };
  }
  if (acc && !acc.planEnabled) {
    return {
      pill: { label: AI().attention, tone: 'warn' },
      lines: [{ text: AI().grantLine, muted: false }],
      models: false,
      actions: [{ action: 'grant', label: AI().grant, variant: 'secondary' }, signOut],
    };
  }
  if (pausedNow(s) && s.pause) {
    const text = s.pause.known ? AI().limitKnown(clockText(s.pause.until)) : AI().limitRetry(clockText(s.pause.until));
    return {
      pill: { label: AI().limitPill, tone: 'warn' },
      lines: [
        { text, muted: false, warn: true },
        { text: s.keySaved ? AI().retryKey : AI().noKeyToAnswer, muted: true },
      ],
      models: false,
      actions: [{ action: 'resumeChatGPT', label: AI().resumePlan, variant: 'secondary' }, signOut],
    };
  }
  return {
    pill: { label: AI().activePill, tone: 'ok' },
    lines: [{ text: acc?.email ?? AI().accountConnected, muted: true }],
    models: true,
    actions: [signOut],
  };
}

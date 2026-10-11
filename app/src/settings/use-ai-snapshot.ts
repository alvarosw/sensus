// Ponte entre o contexto de Configurações e o estado puro do assistente (ai-status.ts).
import { useMemo } from 'react';
import { APP_PRESETS, isAppPresetId } from './presets';
import { useSettings, type SettingsValue } from './settings-context';
import { shortLabel, type AiSnapshot } from './ai-status';

/** Nome do provedor de chave salvo (ou o do .env de desenvolvimento), para o resumo ("NVIDIA"). */
export function keyLabelOf(s: Pick<SettingsValue, 'stored' | 'devProvider'>): string {
  const id = s.stored?.presetId;
  if (id && isAppPresetId(id)) return shortLabel(APP_PRESETS[id].label);
  if (s.devProvider) return shortLabel(APP_PRESETS.nvidia.label);
  return 'chave';
}

/** Nome do provedor de chave que responde agora (o do provedor efetivo; ou o de reserva). */
function activeKeyLabel(s: Pick<SettingsValue, 'stored' | 'devProvider' | 'provider'>): string {
  const p = s.provider;
  const key = p && p.kind !== 'chatgpt' ? p : (p?.fallback ?? null);
  return key ? shortLabel(key.label) : keyLabelOf(s);
}

export function useAiSnapshot(): AiSnapshot {
  const s = useSettings();
  const account = s.chatgpt.account;
  const keyLabel = activeKeyLabel(s);
  return useMemo<AiSnapshot>(
    () => ({
      mode: s.mode,
      provider: s.provider,
      account: account
        ? { connected: account.connected, hasSession: account.hasSession, planEnabled: account.planEnabled, email: account.email }
        : null,
      attention: s.chatgpt.attention,
      // A chave de desenvolvimento (opt-in) também é uma chave disponível: mesmo critério de "Em uso agora".
      keySaved: s.savedApiKey !== null || s.devProvider !== null,
      keyLabel,
      pause: s.pause,
      now: Date.now(),
    }),
    // `now` muda quando a pausa muda (settings-context re-renderiza ao vencer a pausa).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.mode, s.provider, account, s.chatgpt.attention, s.savedApiKey, s.devProvider, keyLabel, s.pause],
  );
}

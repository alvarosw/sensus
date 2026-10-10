import {
  buildChatGPTProviderConfig,
  buildProviderConfig,
  PRESET_IDS,
  PROVIDER_PRESETS,
  type PresetId,
  type ProviderConfig,
} from '@sensus/core';
import { DEMO_PROVIDER_CONFIG } from '../ai/demo-provider';
import { DEMO_POLICY, type DemoPolicy } from './demo';
import { DEMO_PRESET_ID } from './presets';
import type { StoredProviderSettings } from './provider-store';

/** Credenciais de desenvolvimento vindas do .env (app.config.ts -> extra.devProvider). */
export interface DevProvider {
  baseUrl: string;
  apiKey: string;
  model: string;
}

const DEV_PRESET: PresetId = 'nvidia';

export function isPresetId(id: string): id is PresetId {
  return (PRESET_IDS as readonly string[]).includes(id);
}

/**
 * Configuração pronta para uso, ou null se faltar URL, modelo ou chave.
 * Nunca registrar o retorno: contém a chave.
 */
export function buildConfigFrom(
  presetId: PresetId,
  baseUrl: string,
  model: string,
  apiKey: string,
): ProviderConfig | null {
  const config = buildProviderConfig(presetId, { apiKey, baseUrl, model });
  if (!config.baseUrl || !config.model || !config.apiKey) return null;
  return config;
}

/** Estado do plano ChatGPT para a escolha do provedor (ver auth/chatgpt/service.ts: isPlanActive). */
export interface ChatGPTSession {
  planActive: boolean;
  model: string;
}

/** Provedor por chave de API (preset salvo, ou demo, ou o .env de desenvolvimento). */
function resolveApiKeyProvider(
  stored: StoredProviderSettings | null,
  savedApiKey: string | null,
  dev: DevProvider | null,
  demo: DemoPolicy,
): ProviderConfig | null {
  if (stored && savedApiKey && isPresetId(stored.presetId)) {
    return buildConfigFrom(stored.presetId, stored.baseUrl, stored.model, savedApiKey);
  }
  if (demo.byDefault) return { ...DEMO_PROVIDER_CONFIG };
  if (dev) {
    return buildConfigFrom(DEV_PRESET, dev.baseUrl, dev.model, dev.apiKey);
  }
  return null;
}

/**
 * Provedor efetivo, por prioridade:
 *  1. EXPO_PUBLIC_SENSUS_DEMO=1 ou o preset 'demo' salvo: demo (offline);
 *  2. ChatGPT, quando a conta está conectada com o escopo do plano e não foi recusada.
 *     A chave de API (se houver) fica como `fallback`, usada só se a conta for recusada (403);
 *  3. configuração salva (com sua chave), ou o padrão da web (demo), ou o provedor de desenvolvimento do .env.
 */
export function resolveProvider(
  stored: StoredProviderSettings | null,
  savedApiKey: string | null,
  dev: DevProvider | null,
  demo: DemoPolicy = DEMO_POLICY,
  chatgpt: ChatGPTSession | null = null,
): ProviderConfig | null {
  if (demo.forced || stored?.presetId === DEMO_PRESET_ID) return { ...DEMO_PROVIDER_CONFIG };
  const keyProvider = resolveApiKeyProvider(stored, savedApiKey, dev, demo);
  if (chatgpt?.planActive && chatgpt.model) {
    return { ...buildChatGPTProviderConfig(chatgpt.model), fallback: keyProvider ?? undefined };
  }
  return keyProvider;
}

/** Valor inicial do formulário: salvo, ou derivado do .env, ou o preset padrão. */
export function initialFormSettings(
  stored: StoredProviderSettings | null,
  dev: DevProvider | null,
  demo: DemoPolicy = DEMO_POLICY,
): StoredProviderSettings {
  if (stored) return stored;
  if (demo.byDefault) {
    return { presetId: DEMO_PRESET_ID, baseUrl: DEMO_PROVIDER_CONFIG.baseUrl, model: DEMO_PROVIDER_CONFIG.model };
  }
  const preset = PROVIDER_PRESETS[dev ? DEV_PRESET : PRESET_IDS[0]];
  return {
    presetId: preset.id,
    baseUrl: dev?.baseUrl || preset.baseUrl,
    model: dev?.model || preset.defaultModel,
  };
}

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
import { chooseRoute, type ChatGPTPause, type ChatGPTRouteState, type ProviderMode } from './route';

/** Credenciais de desenvolvimento vindas do .env (app.config.ts -> extra.devProvider). Só em builds de dev. */
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
 * Configuração do formulário (salva ou ainda não salva, na verificação). `extraBody` escolhido com o modelo
 * substitui o do preset; sem ele, vale o do preset. Nunca registrar o retorno: contém a chave.
 */
export function formConfig(
  presetId: PresetId,
  baseUrl: string,
  model: string,
  apiKey: string,
  extraBody?: Record<string, unknown>,
): ProviderConfig {
  const config = buildProviderConfig(presetId, { apiKey, baseUrl, model });
  return extraBody && typeof extraBody === 'object' && !Array.isArray(extraBody) ? { ...config, extraBody } : config;
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
  extraBody?: Record<string, unknown>,
): ProviderConfig | null {
  const config = formConfig(presetId, baseUrl, model, apiKey, extraBody);
  if (!config.baseUrl || !config.model || !config.apiKey) return null;
  return config;
}

/** Entrada do plano ChatGPT para a escolha (ver ChatGPTRouteState em route.ts). */
export type ChatGPTSession = ChatGPTRouteState & { model: string };

/** Política de escolha no instante da resolução. */
export interface RoutePolicy {
  mode: ProviderMode;
  pause: ChatGPTPause | null;
  now: number;
}

/** Provedor por chave de API (preset salvo, ou demo, ou o .env de desenvolvimento). */
function resolveApiKeyProvider(
  stored: StoredProviderSettings | null,
  savedApiKey: string | null,
  dev: DevProvider | null,
  demo: DemoPolicy,
): ProviderConfig | null {
  if (stored && savedApiKey && isPresetId(stored.presetId)) {
    return buildConfigFrom(stored.presetId, stored.baseUrl, stored.model, savedApiKey, stored.extraBody);
  }
  if (demo.byDefault) return { ...DEMO_PROVIDER_CONFIG };
  if (dev) {
    return buildConfigFrom(DEV_PRESET, dev.baseUrl, dev.model, dev.apiKey);
  }
  return null;
}

/**
 * Provedor efetivo, conforme o modo e a conta (regras em route.ts, chooseRoute):
 *  1. EXPO_PUBLIC_SENSUS_DEMO=1 ou o preset 'demo' salvo: demo (offline);
 *  2. 'key' (Só chave de API): a chave salva (ou o padrão);
 *  3. 'chatgpt' (Só ChatGPT): o ChatGPT, sem reserva; nunca a chave;
 *  4. 'auto': ChatGPT com a chave como `fallback`, quando o plano está pronto e sem pausa; com conta
 *     em atenção, só o ChatGPT (sem chave); sem isso, a chave.
 */
export function resolveProvider(
  stored: StoredProviderSettings | null,
  savedApiKey: string | null,
  dev: DevProvider | null,
  demo: DemoPolicy = DEMO_POLICY,
  chatgpt: ChatGPTSession | null = null,
  policy: RoutePolicy = { mode: 'auto', pause: null, now: Date.now() },
): ProviderConfig | null {
  if (demo.forced || stored?.presetId === DEMO_PRESET_ID) return { ...DEMO_PROVIDER_CONFIG };
  const keyProvider = resolveApiKeyProvider(stored, savedApiKey, dev, demo);
  const choice = chooseRoute(policy.mode, chatgpt, policy.pause, policy.now);
  const chatgptConfig = chatgpt?.model ? buildChatGPTProviderConfig(chatgpt.model) : null;
  switch (choice) {
    case 'chatgpt':
      return chatgptConfig;
    case 'chatgpt-with-key':
      return chatgptConfig ? { ...chatgptConfig, fallback: keyProvider ?? undefined } : keyProvider;
    case 'key':
      return keyProvider;
    case 'none':
      return null;
  }
}

/** Valor inicial do formulário: salvo, ou derivado do .env de desenvolvimento, ou o preset padrão. */
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

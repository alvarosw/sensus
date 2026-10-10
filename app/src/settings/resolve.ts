import {
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

/**
 * Provedor efetivo, por prioridade:
 *  1. EXPO_PUBLIC_SENSUS_DEMO=1: demo (offline), sempre;
 *  2. configuração salva (com sua chave), ou o preset 'demo' salvo;
 *  3. na web (sem nada salvo): demo;
 *  4. provedor de desenvolvimento do .env, se houver.
 */
export function resolveProvider(
  stored: StoredProviderSettings | null,
  savedApiKey: string | null,
  dev: DevProvider | null,
  demo: DemoPolicy = DEMO_POLICY,
): ProviderConfig | null {
  if (demo.forced || stored?.presetId === DEMO_PRESET_ID) return { ...DEMO_PROVIDER_CONFIG };
  if (stored && savedApiKey && isPresetId(stored.presetId)) {
    return buildConfigFrom(stored.presetId, stored.baseUrl, stored.model, savedApiKey);
  }
  if (demo.byDefault) return { ...DEMO_PROVIDER_CONFIG };
  if (dev) {
    return buildConfigFrom(DEV_PRESET, dev.baseUrl, dev.model, dev.apiKey);
  }
  return null;
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

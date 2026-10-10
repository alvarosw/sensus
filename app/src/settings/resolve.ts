import {
  buildProviderConfig,
  PRESET_IDS,
  PROVIDER_PRESETS,
  type PresetId,
  type ProviderConfig,
} from '@sensus/core';
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
 * Provedor efetivo: a configuração salva (com sua chave) tem prioridade; sem
 * nada salvo, usa o provedor de desenvolvimento do .env, se houver.
 */
export function resolveProvider(
  stored: StoredProviderSettings | null,
  savedApiKey: string | null,
  dev: DevProvider | null,
): ProviderConfig | null {
  if (stored && savedApiKey && isPresetId(stored.presetId)) {
    return buildConfigFrom(stored.presetId, stored.baseUrl, stored.model, savedApiKey);
  }
  if (dev) {
    return buildConfigFrom(DEV_PRESET, dev.baseUrl, dev.model, dev.apiKey);
  }
  return null;
}

/** Valor inicial do formulário: salvo, ou derivado do .env, ou o preset padrão. */
export function initialFormSettings(
  stored: StoredProviderSettings | null,
  dev: DevProvider | null,
): StoredProviderSettings {
  if (stored) return stored;
  const preset = PROVIDER_PRESETS[dev ? DEV_PRESET : PRESET_IDS[0]];
  return {
    presetId: preset.id,
    baseUrl: dev?.baseUrl || preset.baseUrl,
    model: dev?.model || preset.defaultModel,
  };
}

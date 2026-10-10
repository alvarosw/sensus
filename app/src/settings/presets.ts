// Predefinições do app = as do núcleo (@sensus/core, não alterado) + 'demo' (provedor offline,
// ai/demo-provider.ts). Telas devem usar APP_PRESETS/APP_PRESET_IDS em vez de PROVIDER_PRESETS/PRESET_IDS.
import {
  buildProviderConfig,
  PRESET_IDS,
  PROVIDER_PRESETS,
  type PresetId,
  type ProviderConfig,
  type ProviderOverrides,
  type ProviderPreset,
} from '@sensus/core';
import { DEMO_LABEL, DEMO_PRESET_ID, DEMO_PROVIDER_CONFIG } from '../ai/demo-provider';

export { DEMO_PRESET_ID };
export type AppPresetId = PresetId | typeof DEMO_PRESET_ID;
export type AppProviderPreset = Omit<ProviderPreset, 'id'> & { id: AppPresetId };

export const DEMO_PRESET: AppProviderPreset = {
  id: DEMO_PRESET_ID,
  label: DEMO_LABEL,
  kind: 'openai-compatible',
  baseUrl: DEMO_PROVIDER_CONFIG.baseUrl,
  defaultModel: DEMO_PROVIDER_CONFIG.model,
};

export const APP_PRESETS: Record<AppPresetId, AppProviderPreset> = {
  ...PROVIDER_PRESETS,
  [DEMO_PRESET_ID]: DEMO_PRESET,
};

export const APP_PRESET_IDS: readonly AppPresetId[] = [...PRESET_IDS, DEMO_PRESET_ID];

export function isAppPresetId(id: string): id is AppPresetId {
  return (APP_PRESET_IDS as readonly string[]).includes(id);
}

/** O preset 'demo' não precisa de chave de API. */
export function presetNeedsKey(id: AppPresetId): boolean {
  return id !== DEMO_PRESET_ID;
}

/** Como buildProviderConfig do núcleo, mas aceita 'demo' (ignora chave, URL e modelo). */
export function buildAppProviderConfig(id: AppPresetId, overrides: ProviderOverrides): ProviderConfig {
  if (id === DEMO_PRESET_ID) return { ...DEMO_PROVIDER_CONFIG };
  return buildProviderConfig(id, overrides);
}

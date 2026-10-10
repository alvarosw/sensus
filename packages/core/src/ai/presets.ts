// Predefinições de provedores compatíveis com a API da OpenAI.
import type { ProviderConfig } from '../types';

export type PresetId = 'nvidia' | 'openai' | 'openrouter' | 'custom';

export interface ProviderPreset {
  id: PresetId;
  label: string;
  kind: 'openai-compatible';
  baseUrl: string;
  /** Modelo sugerido. Vazio quando o usuário deve escolher (ex.: NVIDIA, pelo catálogo). */
  defaultModel: string;
  /** Onde obter a chave, para mensagens de configuração. */
  keyUrl?: string;
}

export const PROVIDER_PRESETS: Record<PresetId, ProviderPreset> = {
  nvidia: {
    id: 'nvidia',
    label: 'NVIDIA (build.nvidia.com)',
    kind: 'openai-compatible',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: '',
    keyUrl: 'https://build.nvidia.com',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    keyUrl: 'https://openrouter.ai/keys',
  },
  custom: {
    id: 'custom',
    label: 'Personalizado (compatível com OpenAI)',
    kind: 'openai-compatible',
    baseUrl: '',
    defaultModel: '',
  },
};

export const PRESET_IDS: readonly PresetId[] = ['nvidia', 'openai', 'openrouter', 'custom'];

export interface ProviderOverrides {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

/** Monta a configuração de um preset, com base URL e modelo sobrescritos quando informados. */
export function buildProviderConfig(presetId: PresetId, overrides: ProviderOverrides): ProviderConfig {
  const preset = PROVIDER_PRESETS[presetId];
  return {
    id: preset.id,
    kind: preset.kind,
    label: preset.label,
    baseUrl: overrides.baseUrl?.trim() || preset.baseUrl,
    apiKey: overrides.apiKey.trim(),
    model: overrides.model?.trim() || preset.defaultModel,
  };
}

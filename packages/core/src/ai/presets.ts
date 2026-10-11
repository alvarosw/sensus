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
  /** Campos extras do corpo das requisições (ver ProviderConfig.extraBody). */
  extraBody?: Record<string, unknown>;
}

export const PROVIDER_PRESETS: Record<PresetId, ProviderPreset> = {
  nvidia: {
    id: 'nvidia',
    label: 'NVIDIA (build.nvidia.com)',
    kind: 'openai-compatible',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    // Nemotron 3 Ultra com o raciocínio desligado: primeiro texto em ~2,5 s (Gemma 4 leva ~45 s), precisão 90
    // (ver "Decisão" em docs/MODEL_BENCHMARK.md). Outras opções: RECOMMENDED_MODELS (recommended-models.ts).
    defaultModel: 'nvidia/nemotron-3-ultra-550b-a55b',
    keyUrl: 'https://build.nvidia.com',
    extraBody: { chat_template_kwargs: { enable_thinking: false } },
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
    ...(preset.extraBody ? { extraBody: preset.extraBody } : {}),
  };
}

/**
 * Plano ChatGPT (Sign in with ChatGPT). Fica fora de PresetId/PRESET_IDS: não tem chave de API nem
 * entra nas listas de provedores por chave. O modelo vem da lista da conta (listModelInfo).
 */
export const CHATGPT_PRESET_ID = 'chatgpt' as const;

export const CHATGPT_PRESET = {
  id: CHATGPT_PRESET_ID,
  label: 'ChatGPT (plano)',
  kind: 'chatgpt',
  baseUrl: 'https://api.openai.com/v1',
  defaultModel: '',
} as const;

/** Configuração do plano ChatGPT. O token de acesso é injetado pelo app (createProvider deps). */
export function buildChatGPTProviderConfig(model: string): ProviderConfig {
  return {
    id: CHATGPT_PRESET_ID,
    kind: 'chatgpt',
    label: CHATGPT_PRESET.label,
    baseUrl: CHATGPT_PRESET.baseUrl,
    apiKey: '',
    model: model.trim(),
  };
}

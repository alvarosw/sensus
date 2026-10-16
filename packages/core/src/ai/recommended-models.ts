// Modelos recomendados por provedor, medidos no benchmark de tarefas reais (ver docs/MODEL_BENCHMARK.md e
// packages/core/tools/bench-models.ts). Primeiro item = padrão do preset. Ids de modelos que a conta não
// tem (404) ou que falharam no benchmark ficam de fora. Nemotron 3 Ultra saiu da lista em 16/10/2026 (404
// persistente, ver docs/MODEL_BENCHMARK.md, "Atualização de 16/10/2026").
//
// extraBody: desliga o raciocínio (chat_template_kwargs.enable_thinking=false), como o preset NVIDIA. O
// benchmark usou essa configuração para todos os modelos listados.

export type RecommendedTier = 'equilibrado' | 'rapido' | 'preciso';

export interface RecommendedModel {
  id: string;
  label: string;
  tier: RecommendedTier;
  note: string;
  extraBody?: Record<string, unknown>;
}

const REASONING_OFF = { chat_template_kwargs: { enable_thinking: false } };

export const RECOMMENDED_MODELS: Record<string, Array<RecommendedModel>> = {
  nvidia: [
    {
      id: 'google/gemma-4-31b-it',
      label: 'Gemma 4 31B',
      tier: 'equilibrado',
      note: 'Mais precisa (96 de 100) e sempre completa. Primeiro texto em cerca de 12 s e total de cerca de 70 s.',
      extraBody: REASONING_OFF,
    },
    {
      id: 'nvidia/nemotron-3-super-120b-a12b',
      label: 'Nemotron 3 Super 120B',
      tier: 'rapido',
      note: 'O mais rápido (primeiro texto em cerca de 3 s, total de cerca de 18 s). Menos precisa (84 de 100), mais citações inválidas e uma resposta sem o marcador de fim.',
      extraBody: REASONING_OFF,
    },
  ],
};

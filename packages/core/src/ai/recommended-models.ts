// Modelos recomendados por provedor, medidos no benchmark de tarefas reais (ver docs/MODEL_BENCHMARK.md e
// packages/core/tools/bench-models.ts). Primeiro item = padrão do preset. Ids de modelos que a conta não
// tem (404) ou que falharam no benchmark ficam de fora. A ordem segue a decisão de docs/MODEL_BENCHMARK.md
// ("Decisão"): primeiro texto rápido, depois precisão.
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
      id: 'nvidia/nemotron-3-ultra-550b-a55b',
      label: 'Nemotron 3 Ultra 550B',
      tier: 'equilibrado',
      note: 'Primeiro texto em cerca de 2,5 s e total de cerca de 45 s. Precisão menor (90 contra 95 do Gemma) e mais frases factuais sem citação, sobretudo em listas.',
      extraBody: REASONING_OFF,
    },
    {
      id: 'google/gemma-4-31b-it',
      label: 'Gemma 4 31B',
      tier: 'preciso',
      note: 'Mais preciso, mas o primeiro texto demora cerca de 45 s. Citações quase sempre válidas e respostas completas.',
      extraBody: REASONING_OFF,
    },
    {
      id: 'nvidia/nemotron-3-super-120b-a12b',
      label: 'Nemotron 3 Super 120B',
      tier: 'rapido',
      note: 'O mais rápido (total de cerca de 8 s). Menos precisa: mais citações inválidas e uma resposta sem o marcador de fim.',
      extraBody: REASONING_OFF,
    },
  ],
};

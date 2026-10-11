// Modelos recomendados por provedor (seletor "Recomendados" e opções rápidas da verificação).
// Fonte: RECOMMENDED_MODELS do núcleo (packages/core/src/ai/recommended-models.ts), primeiro item = padrão.
// Enquanto o arquivo do núcleo não existe, a lista é vazia e a tela só mostra o seletor normal.
export type RecommendedTier = 'equilibrado' | 'rapido' | 'preciso';

export interface RecommendedModel {
  id: string;
  label: string;
  tier: RecommendedTier;
  note: string;
  extraBody?: Record<string, unknown>;
}

const RECOMMENDED: Record<string, readonly RecommendedModel[]> = {};

/** Modelos recomendados do provedor (preset), na ordem em que aparecem; vazio se não há. */
export function recommendedFor(presetId: string): readonly RecommendedModel[] {
  return RECOMMENDED[presetId] ?? [];
}

/** O modelo recomendado com este id no provedor, ou null (define o corpo extra ao escolher). */
export function recommendedById(presetId: string, modelId: string): RecommendedModel | null {
  return recommendedFor(presetId).find((m) => m.id === modelId) ?? null;
}

/** Corpo extra a salvar para um modelo escolhido: o do recomendado, ou nenhum (vale o do preset). */
export function extraBodyFor(presetId: string, modelId: string): Record<string, unknown> | undefined {
  return recommendedById(presetId, modelId)?.extraBody;
}

export const TIER_LABEL: Record<RecommendedTier, string> = {
  equilibrado: 'Equilibrado',
  rapido: 'Rápido',
  preciso: 'Preciso',
};

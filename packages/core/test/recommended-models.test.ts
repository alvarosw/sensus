import { describe, expect, it } from 'vitest';
import { PROVIDER_PRESETS, RECOMMENDED_MODELS, type RecommendedTier } from '../src/index';

const TIERS: readonly RecommendedTier[] = ['equilibrado', 'rapido', 'preciso'];

describe('RECOMMENDED_MODELS', () => {
  it('tem entradas para o NVIDIA, com 2 a 4 modelos', () => {
    const nvidia = RECOMMENDED_MODELS.nvidia;
    expect(nvidia).toBeDefined();
    expect(nvidia!.length).toBeGreaterThanOrEqual(2);
    expect(nvidia!.length).toBeLessThanOrEqual(4);
  });

  it('o primeiro é o padrão do preset NVIDIA', () => {
    const first = RECOMMENDED_MODELS.nvidia![0]!;
    expect(first.id).toBe(PROVIDER_PRESETS.nvidia.defaultModel);
  });

  it('cada entrada tem id, rótulo, nível e nota, e ids são únicos', () => {
    const entries = Object.values(RECOMMENDED_MODELS).flat();
    for (const m of entries) {
      expect(m.id).toMatch(/^[\w.-]+\/[\w./-]+$/);
      expect(m.label.trim()).not.toBe('');
      expect(m.note.trim()).not.toBe('');
      expect(TIERS).toContain(m.tier);
    }
    const ids = RECOMMENDED_MODELS.nvidia!.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('desliga o raciocínio por padrão (como o preset)', () => {
    for (const m of RECOMMENDED_MODELS.nvidia!) {
      expect(m.extraBody).toEqual({ chat_template_kwargs: { enable_thinking: false } });
    }
  });
});

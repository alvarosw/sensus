// Dicionário único de morfologia em português: o painel (morphParts) e o card (morphLabelsPt) usam o mesmo termo com o
// mesmo rótulo. Casos do grego do NT (TAGNT) e do hebraico/aramaico do AT.
import { describe, expect, it } from 'vitest';
import { morphLabelsPt, morphParts, morphPills, morphTerm } from './morph-pt';

describe('morfologia pt: um dicionário', () => {
  it('grego do NT: o card e o painel dão o mesmo rótulo a cada termo', () => {
    const desc = 'Verb; Tense=Present; Voice=Active; Mood=Indicative';
    expect(morphPills(desc)).toEqual(['presente', 'ativa', 'indicativo']);
    expect(morphLabelsPt(desc, true)).toEqual(['Verbo', 'presente', 'ativa', 'indicativo']);
    expect(morphParts(desc)).toEqual([
      { key: 'Classe', value: 'Verbo' },
      { key: 'Tempo', value: 'presente' },
      { key: 'Voz', value: 'ativa' },
      { key: 'Modo', value: 'indicativo' },
    ]);
  });

  it('o card mostra as mesmas pílulas que o painel, sem a classe', () => {
    const desc = 'Noun; Case=Genitive; Number=Singular; Gender=Feminine';
    expect(morphLabelsPt(desc)).toEqual(morphPills(desc));
    expect(morphLabelsPt(desc, true)[0]).toBe(morphParts(desc)[0]!.value);
  });

  it('AT (hebraico e aramaico): termos compostos e classe com a mesma capitalização', () => {
    expect(morphLabelsPt('Noun; Gender=Masculine; Number=Singular', true)).toEqual(['Substantivo', 'masculino', 'singular']);
    expect(morphTerm('Masculine + Noun')).toBe('masculino + Substantivo');
    expect(morphLabelsPt('Masculine + Noun', true)).toEqual(['Masculino + Substantivo']);
    expect(morphParts('Masculine + Noun')[0]).toEqual({ key: 'Classe', value: 'Masculino + Substantivo' });
  });

  it('ordinais e termos de verbo fora da lista direta', () => {
    expect(morphTerm('2nd Imperfect')).toBe('imperfeito 2º');
    expect(morphTerm('Deponent')).toBe('depoente');
    expect(morphTerm('Termo que não existe')).toBe('Termo que não existe');
  });

  it('sem análise: nada', () => {
    expect(morphLabelsPt(null)).toEqual([]);
    expect(morphParts('')).toEqual([]);
  });
});

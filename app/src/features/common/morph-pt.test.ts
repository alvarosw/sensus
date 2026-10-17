// Dicionário único de morfologia em português: o painel (morphParts) e o card (morphLabelsPt) usam o mesmo termo com o
// mesmo rótulo. Casos do grego do NT (TAGNT) e do hebraico/aramaico do AT.
import { describe, expect, it } from 'vitest';
import { morphChipsOf, morphLabelsPt, morphParts, morphPills, morphTerm } from './morph-pt';

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

  it('card do NT: a classe é a primeira etiqueta, como no painel', () => {
    const desc = 'Verb; Tense=Present; Voice=Active; Mood=Indicative';
    expect(morphChipsOf(desc, 'NT')).toEqual(['Verbo', 'presente', 'ativa', 'indicativo']);
    expect(morphChipsOf(desc, 'NT')[0]).toBe(morphParts(desc)[0]!.value);
  });

  it('card do AT (1Rs 15:15, כְּלִי): mesmo mapa do painel, classe primeiro', () => {
    const desc = 'Consecutive Conjunction + Verb : Hiphil (Causative/declarative, Active) Consecutive Imperfect (Past/present Indicative) Third Singular Masculine';
    expect(morphChipsOf(desc, 'OT')).toEqual([
      'Conjunção consecutiva',
      'verbo Hiphil (causativa/declarativa, ativa)',
      'imperfeito consecutivo',
      '3ª pessoa singular masculino',
    ]);
  });

  it('card do AT: substantivo com estado e número (זָהָב, כֶּסֶף)', () => {
    expect(morphChipsOf('Noun (Singular Masculine, Absolute)', 'OT')).toEqual(['Substantivo singular masculino', 'estado absoluto']);
    expect(morphChipsOf('Noun (Singular Masculine, Construct)', 'OT')).toEqual(['Substantivo singular masculino', 'estado construto']);
  });

  it('card do AT: termo fora do mapa mostra a descrição original como uma etiqueta', () => {
    expect(morphChipsOf('Noun (Singular Masculine, Frobnicated)', 'OT')).toEqual(['Noun (Singular Masculine, Frobnicated)']);
  });

  it('sem análise: nenhuma etiqueta', () => {
    expect(morphChipsOf(null, 'OT')).toEqual([]);
    expect(morphChipsOf('', 'NT')).toEqual([]);
  });
});

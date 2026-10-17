import { describe, expect, it } from 'vitest';
import { hebrewMorphPt } from './morph-hb';

describe('hebrewMorphPt (classe hebraica do TAHOT)', () => {
  it('1Rs 15:15 (וַיָּבֵא, H0935P): conjunção consecutiva, hífil consecutivo, 3ª pessoa', () => {
    expect(
      hebrewMorphPt(
        'Consecutive Conjunction + Verb : Hiphil (Causative/declarative, Active) Consecutive Imperfect (Past/present Indicative) Third Singular Masculine',
      ),
    ).toEqual({
      text: 'Conjunção consecutiva + verbo Hiphil (causativa/declarativa, ativa), imperfeito consecutivo, 3ª pessoa singular masculino',
      complete: true,
    });
  });

  it('Gn 1:1 (בָּרָא, H1254): qal perfeito', () => {
    expect(
      hebrewMorphPt('Verb : Qal (Simple, Active) Perfect (Past/present Indicative) Third Singular Masculine'),
    ).toEqual({ text: 'Verbo Qal (simples, ativa), perfeito, 3ª pessoa singular masculino', complete: true });
  });

  it('substantivo com estado (construto, absoluto) e número/gênero', () => {
    expect(hebrewMorphPt('Noun (Plural Masculine, Absolute)').text).toBe('Substantivo plural masculino, estado absoluto');
    expect(hebrewMorphPt('Noun (Singular Masculine, Construct)').text).toBe('Substantivo singular masculino, estado construto');
    expect(hebrewMorphPt('Adjective (Singular Feminine, Absolute)').text).toBe('Adjetivo singular feminino, estado absoluto');
  });

  it('sufixo pronominal e partícula de objeto', () => {
    expect(hebrewMorphPt('Noun (Singular Masculine, Construct) + Suffix (Third Singular Masculine)').text).toBe(
      'Substantivo singular masculino, estado construto + sufixo pronominal 3ª pessoa singular masculino',
    );
    expect(hebrewMorphPt('Object indicator + Suffix (Third Plural Masculine)').text).toBe(
      'Marcador de objeto + sufixo pronominal 3ª pessoa plural masculino',
    );
  });

  it('preposição com artigo, artigo definido e conjunção', () => {
    expect(hebrewMorphPt('Preposition (Definite) + Noun (Singular Feminine, Absolute)').text).toBe(
      'Preposição com artigo + substantivo singular feminino, estado absoluto',
    );
    expect(hebrewMorphPt('Definite article (Hebrew) + Noun (Singular Masculine, Absolute)').text).toBe(
      'Artigo definido + substantivo singular masculino, estado absoluto',
    );
    expect(hebrewMorphPt('Conjunction + Object indicator').text).toBe('Conjunção + marcador de objeto');
  });

  it('modo jussivo, indicativo sem modo e conjunção ligada ao tempo', () => {
    expect(hebrewMorphPt('Verb : Qal (Simple, Active) Imperfect (Future/present Jussive) Third Singular Masculine').text).toBe(
      'Verbo Qal (simples, ativa), imperfeito jussivo, 3ª pessoa singular masculino',
    );
    expect(
      hebrewMorphPt('Verb : Niphal (Simple, Passive) Conjunction+Imperfect (Future/present Indicative) Third Singular Feminine').text,
    ).toBe('Verbo Niphal (simples, passiva), conjunção + imperfeito, 3ª pessoa singular feminino');
  });

  it('particípio com número, gênero e estado; glosa intensiva', () => {
    expect(hebrewMorphPt('Verb : Piel (Intensive/resultive/transtive, Active) Participle (Singular Feminine, Absolute)').text).toBe(
      'Verbo Piel (intensiva/resultativa/transitiva, ativa), particípio, singular feminino, estado absoluto',
    );
  });

  it('imperativo, infinitivo construto e absoluto', () => {
    expect(hebrewMorphPt('Verb : Qal (Simple, Active) Imperative Second Singular Masculine').text).toBe(
      'Verbo Qal (simples, ativa), imperativo, 2ª pessoa singular masculino',
    );
    expect(hebrewMorphPt('Preposition + Verb : Hiphil (Causative/declarative, Active) Infinitive Construct').text).toBe(
      'Preposição + verbo Hiphil (causativa/declarativa, ativa), infinitivo construto',
    );
    expect(hebrewMorphPt('Verb : Qal (Simple, Active) Infinitive Absolute').text).toBe('Verbo Qal (simples, ativa), infinitivo absoluto');
  });

  it('haste aramaica sai marcada; partículas e advérbios', () => {
    expect(hebrewMorphPt('Conjunction + Verb : Peal (Simple, Active) Perfect (Past/present Indicative) Third Singular Masculine').text).toBe(
      'Conjunção + verbo Qal aramaico (simples, ativa), perfeito, 3ª pessoa singular masculino',
    );
    expect(hebrewMorphPt('Negative Particle').text).toBe('Partícula negativa');
    expect(hebrewMorphPt('Adverb').text).toBe('Advérbio');
  });

  it('nome próprio com uso; vazio', () => {
    expect(hebrewMorphPt('Proper Noun (Title)').text).toBe('Substantivo próprio, título');
    expect(hebrewMorphPt('').complete).toBe(true);
    expect(hebrewMorphPt(null).text).toBe('');
  });

  it('termo fora do mapa: complete = false (quem chama usa o original ou a tradução automática)', () => {
    expect(hebrewMorphPt('Verb : Xyzzy (Simple, Active) Perfect (Past/present Indicative) Third Singular Masculine')).toEqual({
      text: '',
      complete: false,
    });
    expect(hebrewMorphPt('Noun (Singular Masculine, Frobnicated)').complete).toBe(false);
  });
});

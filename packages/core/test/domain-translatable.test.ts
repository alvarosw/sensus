import { describe, expect, it } from 'vitest';
import {
  isTranslatableSource,
  langBase,
  modelPairOf,
  needsTranslation,
  sourceLangOf,
  translationPair,
} from '../src/index';

describe('idioma e tradução pelo registro de fontes', () => {
  it('langBase normaliza o código principal do idioma', () => {
    expect(langBase('en')).toBe('en');
    expect(langBase('EN-us')).toBe('en');
    expect(langBase('pt_BR')).toBe('pt');
    expect(langBase('')).toBeNull();
    expect(langBase(null)).toBeNull();
  });

  it('sem idioma do app: inglês é traduzido (para português); o resto não', () => {
    expect(needsTranslation('en')).toBe(true);
    expect(needsTranslation('en-GB')).toBe(true);
    expect(needsTranslation('pt')).toBe(false);
    expect(needsTranslation('grc')).toBe(false);
    expect(needsTranslation('hbo')).toBe(false);
    expect(needsTranslation(undefined)).toBe(false);
  });

  it('com o idioma do app: inglês vira o idioma escolhido (pt, es, zh)', () => {
    expect(needsTranslation('en', 'pt')).toBe(true);
    expect(needsTranslation('en', 'es')).toBe(true);
    expect(needsTranslation('en', 'zh')).toBe(true);
    expect(translationPair('en', 'es')).toEqual({ from: 'en', to: 'es' });
  });

  it('mesma base nunca traduz: pt no app pt, en no app en, zh-Hans no app zh', () => {
    expect(needsTranslation('pt', 'pt')).toBe(false);
    expect(needsTranslation('en', 'en')).toBe(false);
    expect(needsTranslation('zh-Hant', 'zh')).toBe(false);
    expect(translationPair('en', 'en')).toBeNull();
  });

  it('origem em outro idioma dos 14 também é traduzida (Bíblia em espanhol, app em inglês)', () => {
    expect(needsTranslation('es', 'en')).toBe(true);
    expect(needsTranslation('es', 'pt')).toBe(true);
    expect(translationPair('es', 'en')).toEqual({ from: 'es', to: 'en' });
    expect(needsTranslation('es', 'es')).toBe(false);
  });

  it('origem grega ou hebraica nunca é traduzida, em nenhum idioma do app', () => {
    for (const app of ['pt', 'en', 'es', 'zh'] as const) {
      expect(needsTranslation('grc', app)).toBe(false);
      expect(needsTranslation('hbo', app)).toBe(false);
      expect(needsTranslation('arc', app)).toBe(false);
    }
  });

  it('o par precisa dos dois modelos: origem e destino com mlkit (os 14 têm); códigos de fora dos 14 não', () => {
    expect(needsTranslation('en', 'pt')).toBe(true);
    expect(needsTranslation('ko', 'pt')).toBe(false);
    expect(needsTranslation('en', 'ko' as 'pt')).toBe(false);
  });

  it('modelPairOf: inglês -> idioma do app; app em inglês não tem modelo próprio', () => {
    expect(modelPairOf('pt')).toEqual({ from: 'en', to: 'pt' });
    expect(modelPairOf('en')).toBeNull();
  });

  it('a fonte registrada decide: theographic (inglês) é traduzível, blivre (português) não', () => {
    expect(sourceLangOf('theographic')).toBe('en');
    expect(isTranslatableSource('theographic')).toBe(true);
    expect(isTranslatableSource('blivre')).toBe(false);
    expect(isTranslatableSource('kjv')).toBe(true);
    expect(isTranslatableSource('tagnt')).toBe(false);
    expect(isTranslatableSource('grc-tr')).toBe(false);
  });

  it('o idioma registrado vence o do banco', () => {
    expect(isTranslatableSource('blivre', 'en')).toBe(false);
    expect(isTranslatableSource('theographic', 'pt')).toBe(true);
  });

  it('fonte fora do registro usa o idioma do banco; sem idioma, não traduz', () => {
    expect(isTranslatableSource('fonte-nova', 'en')).toBe(true);
    expect(isTranslatableSource('fonte-nova', 'pt')).toBe(false);
    expect(isTranslatableSource('fonte-nova')).toBe(false);
    expect(isTranslatableSource(null)).toBe(false);
    expect(isTranslatableSource(null, 'en')).toBe(true);
  });

  it('com idioma do app: a regra vale para a fonte registrada e para a do banco', () => {
    expect(isTranslatableSource('theographic', null, 'es')).toBe(true);
    expect(isTranslatableSource('theographic', null, 'en')).toBe(false);
    expect(isTranslatableSource('kjv', null, 'pt')).toBe(true);
    expect(isTranslatableSource('blivre', null, 'en')).toBe(true);
    expect(isTranslatableSource('blivre', null, 'pt')).toBe(false);
    expect(isTranslatableSource('tagnt', null, 'zh')).toBe(false);
    expect(isTranslatableSource('fonte-nova', 'es', 'zh')).toBe(true);
  });
});

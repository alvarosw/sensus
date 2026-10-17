import { describe, expect, it } from 'vitest';
import { isTranslatableLang, isTranslatableSource, langBase, sourceLangOf } from '../src/index';

describe('idioma e tradução pelo registro de fontes', () => {
  it('langBase normaliza o código principal do idioma', () => {
    expect(langBase('en')).toBe('en');
    expect(langBase('EN-us')).toBe('en');
    expect(langBase('pt_BR')).toBe('pt');
    expect(langBase('')).toBeNull();
    expect(langBase(null)).toBeNull();
  });

  it('inglês é traduzível; português e línguas originais não', () => {
    expect(isTranslatableLang('en')).toBe(true);
    expect(isTranslatableLang('en-GB')).toBe(true);
    expect(isTranslatableLang('pt')).toBe(false);
    expect(isTranslatableLang('grc')).toBe(false);
    expect(isTranslatableLang('hbo')).toBe(false);
    expect(isTranslatableLang(undefined)).toBe(false);
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
});

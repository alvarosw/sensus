import { describe, expect, it } from 'vitest';
import {
  APP_LANGS,
  BOOK_NAMES,
  BOOK_TABLE,
  DEFAULT_APP_LANG,
  appLangFromDevice,
  appLangInfo,
  bookAbbrOf,
  bookNameOf,
  fallbackChain,
  formatReference,
  formatVerse,
  isAppLang,
  pickLang,
  testamentLabel,
  traditionLabel,
} from '../src/index';

describe('idiomas da interface', () => {
  it('são 14, sem repetição, com o português primeiro e padrão', () => {
    const codes = APP_LANGS.map((l) => l.code);
    expect(codes).toHaveLength(14);
    expect(new Set(codes).size).toBe(14);
    expect(codes[0]).toBe('pt');
    expect(DEFAULT_APP_LANG).toBe('pt');
  });

  it('BCP-47, endônimo e direção de cada idioma', () => {
    expect(appLangInfo('pt')).toMatchObject({ bcp47: 'pt-BR', endonym: 'Português', rtl: false });
    expect(appLangInfo('zh')).toMatchObject({ bcp47: 'zh-Hans', endonym: '中文（简体）' });
    expect(appLangInfo('ar').rtl).toBe(true);
    expect(appLangInfo('ur').rtl).toBe(true);
    expect(APP_LANGS.filter((l) => l.rtl).map((l) => l.code)).toEqual(['ar', 'ur']);
    for (const l of APP_LANGS) expect(l.endonym.length).toBeGreaterThan(0);
  });

  it('motores de tradução: o ML Kit tem os 14; a Apple não tem bengali nem urdu', () => {
    expect(APP_LANGS.every((l) => l.mlkit !== null)).toBe(true);
    expect(APP_LANGS.filter((l) => l.apple === null).map((l) => l.code)).toEqual(['bn', 'ur']);
    expect(appLangInfo('zh').mlkit).toBe('zh');
  });

  it('isAppLang aceita só os 14 códigos', () => {
    expect(isAppLang('ja')).toBe(true);
    expect(isAppLang('pt-BR')).toBe(false);
    expect(isAppLang('sw')).toBe(false);
    expect(isAppLang(undefined)).toBe(false);
  });

  it('idioma do aparelho: primeiro da lista pelo código principal; senão inglês', () => {
    expect(appLangFromDevice(['fr-CA', 'pt-BR'])).toBe('fr');
    expect(appLangFromDevice(['zh-Hans-CN'])).toBe('zh');
    expect(appLangFromDevice(['pt_BR'])).toBe('pt');
    expect(appLangFromDevice(['sw-KE', 'ru-RU'])).toBe('ru');
    expect(appLangFromDevice(['sw-KE'])).toBe('en');
    expect(appLangFromDevice([])).toBe('en');
  });

  it('cadeia de fallback: idioma, inglês, português, sem repetição', () => {
    expect(fallbackChain('de')).toEqual(['de', 'en', 'pt']);
    expect(fallbackChain('en')).toEqual(['en', 'pt']);
    expect(fallbackChain('pt')).toEqual(['pt', 'en']);
  });

  it('pickLang escolhe o primeiro idioma da cadeia que tem valor', () => {
    const table = { pt: 'oi', en: 'hi' };
    expect(pickLang(table, 'ja')).toBe('hi');
    expect(pickLang(table, 'pt')).toBe('oi');
    expect(pickLang({ pt: 'oi' }, 'ja')).toBe('oi');
    expect(pickLang({}, 'ja')).toBeUndefined();
  });
});

describe('rótulos do núcleo por idioma (padrão pt)', () => {
  it('testamento: AT/NT em pt, OT/NT em inglês, outros idiomas pelo inglês', () => {
    expect(testamentLabel('OT')).toBe('AT');
    expect(testamentLabel('NT')).toBe('NT');
    expect(testamentLabel('OT', 'en')).toBe('OT');
    expect(testamentLabel('OT', 'de')).toBe('OT');
  });

  it('tradição: pt por padrão, en pelo idioma inglês e fallback para os demais', () => {
    expect(traditionLabel('reformed')).toBe('reformada');
    expect(traditionLabel('reformed', 'pt')).toBe('reformada');
    expect(traditionLabel('reformed', 'en')).toBe('Reformed');
    expect(traditionLabel('reformed', 'de')).toBe('Reformed');
    expect(traditionLabel('reformed-baptist', 'en')).toBe('Reformed Baptist');
    expect(traditionLabel('fora-do-registro', 'en')).toBe('fora-do-registro');
    expect(traditionLabel(null, 'en')).toBe('');
  });

  it('nomes e abreviações de livros: pt igual ao núcleo; en pelos nomes ingleses', () => {
    expect(BOOK_NAMES.pt).toHaveLength(66);
    expect(BOOK_NAMES.pt?.map((b) => b.name)).toEqual(BOOK_TABLE.map((b) => b.name_pt));
    expect(BOOK_NAMES.en?.map((b) => b.name)).toEqual(BOOK_TABLE.map((b) => b.name_en));
    expect(bookNameOf(BOOK_TABLE[49], 50)).toBe('Filipenses');
    expect(bookNameOf(BOOK_TABLE[49], 50, 'en')).toBe('Philippians');
    expect(bookNameOf(BOOK_TABLE[49], 50, 'ja')).toBe('Philippians');
    expect(bookAbbrOf(50)).toBe('Fp');
    expect(bookAbbrOf(50, 'en')).toBe('Phil');
  });

  it('formatação de referências no idioma pedido', () => {
    const r = (start: number, end: number) => ({ start, end });
    // pt continua igual (chamadas existentes)
    expect(formatReference(r(50002005, 50002008))).toBe('Filipenses 2:5-8');
    expect(formatVerse(50002005)).toBe('Filipenses 2:5');
    // inglês: nomes, intervalos e introdução
    expect(formatReference(r(50002005, 50002008), BOOK_TABLE, 'en')).toBe('Philippians 2:5-8');
    expect(formatVerse(50002005, BOOK_TABLE, 'en')).toBe('Philippians 2:5');
    expect(formatReference(r(50002005, 51001001), BOOK_TABLE, 'en')).toBe('Philippians 2:5 - Colossians 1:1');
    expect(formatReference(r(50002000, 50002000), BOOK_TABLE, 'en')).toBe('Philippians 2 (introduction)');
    expect(formatReference(r(50002000, 50002000))).toBe('Filipenses 2 (introdução)');
  });
});

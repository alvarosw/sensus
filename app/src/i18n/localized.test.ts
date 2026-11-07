import { afterEach, describe, expect, it } from 'vitest';
import { localized, resolveKey, type LocaleTables } from './localized';
import { t } from './index';
import { currentBcp47, useLangStore } from './lang-store';

type Demo = { oi: string; soma: (a: number, b: number) => string; so: string };

const pt: Demo = { oi: 'oi', soma: (a, b) => `${a} + ${b}`, so: 'só português' };
const en: Partial<Demo> = { oi: 'hi', soma: (a, b) => `${a} plus ${b}` };
const tables: LocaleTables<Demo> = { pt, en: en as Demo };

afterEach(() => useLangStore.getState().setLang('pt'));

describe('resolveKey (fallback por chave: idioma, inglês, português)', () => {
  it('usa o idioma pedido quando ele tem a chave', () => {
    expect(resolveKey(tables, 'en', 'oi')).toBe('hi');
    expect(resolveKey(tables, 'pt', 'oi')).toBe('oi');
  });

  it('idioma sem tabela cai no inglês, e a chave que o inglês não tem vai ao português', () => {
    expect(resolveKey(tables, 'de', 'oi')).toBe('hi');
    expect(resolveKey(tables, 'de', 'so')).toBe('só português');
  });

  it('chave inexistente em todas as tabelas: undefined', () => {
    expect(resolveKey(tables, 'en', 'nao-existe')).toBeUndefined();
  });

  it('não confunde propriedades herdadas do Object.prototype com textos', () => {
    expect(resolveKey(tables, 'en', 'toString')).toBeUndefined();
    expect(resolveKey(tables, 'en', 'constructor')).toBeUndefined();
  });
});

describe('localized (Proxy que resolve no idioma atual, na hora do acesso)', () => {
  it('acompanha a troca de idioma sem recriar o objeto', () => {
    const strings = localized<Demo>(tables);
    expect(strings.oi).toBe('oi');
    useLangStore.getState().setLang('en');
    expect(strings.oi).toBe('hi');
    expect(strings.so).toBe('só português');
  });

  it('funções seguem com as mesmas assinaturas e o fallback por chave', () => {
    const strings = localized<Demo>(tables);
    useLangStore.getState().setLang('en');
    expect(strings.soma(2, 3)).toBe('2 plus 3');
    useLangStore.getState().setLang('ja');
    expect(strings.soma(2, 3)).toBe('2 plus 3');
  });

  it('enumera as chaves do português (Object.keys e has)', () => {
    const strings = localized<Demo>(tables);
    expect(Object.keys(strings).sort()).toEqual(['oi', 'so', 'soma']);
    expect('oi' in strings).toBe(true);
    expect('nao' in strings).toBe(false);
  });
});

describe('t() e idioma atual', () => {
  it('traduz a chave no idioma atual, com variáveis', () => {
    expect(t('common.retry')).toBe('Tentar novamente');
    useLangStore.getState().setLang('en');
    expect(t('common.retry')).toBe('Try again');
    expect(t('common.showAll', { count: 4 })).toBe('Show all (4)');
  });

  it('BCP-47 do idioma atual (datas e IA)', () => {
    expect(currentBcp47()).toBe('pt-BR');
    useLangStore.getState().setLang('zh');
    expect(currentBcp47()).toBe('zh-Hans');
  });
});

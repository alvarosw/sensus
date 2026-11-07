// Os 12 idiomas além de pt e en precisam estar traduzidos de fato: um rascunho esquecido (cópia do inglês) passaria
// no typecheck, porque as chaves e assinaturas são as mesmas. Aqui se compara cada texto com o inglês.
import { describe, expect, it } from 'vitest';
import { APP_LANGS } from '@sensus/core';
import * as all from './locales/all';

type Tables = Record<string, Record<string, object>>;

/** Folhas de texto (strings) de uma tabela, com o caminho da chave. Funções são chamadas com argumentos de exemplo. */
function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value === 'function') {
    try {
      const out = (value as (...a: unknown[]) => unknown)(3, 'x', 'y', 4);
      return typeof out === 'string' ? [[path, out]] : [];
    } catch {
      return [];
    }
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  }
  return [];
}

// Textos que podem coincidir com o inglês em qualquer idioma: nomes próprios, siglas, números, símbolos.
const SAME_OK = /^[\s\d.,:;·•\-–—/()%+…'"×→←{}#x]*$|^(Sensus|ChatGPT|OpenAI|KJV|BLivre|TR|WLC|LSJ|Strong|OK|Theographic|OpenBible|TAGNT|TAHOT|TBESG|TBESH|API|URL|IA|AI)$/;

describe('traduções da interface', () => {
  const tables = Object.values(all) as unknown as Tables[keyof Tables][];
  const langs = APP_LANGS.map((l) => l.code).filter((c) => c !== 'pt' && c !== 'en');

  it.each(langs)('%s: no máximo 10%% dos textos iguais ao inglês', (lang) => {
    let total = 0;
    const same: string[] = [];
    for (const byLang of tables) {
      const en = new Map(leaves(byLang.en));
      for (const [path, text] of leaves(byLang[lang])) {
        const ref = en.get(path);
        if (ref === undefined || SAME_OK.test(text.trim())) continue;
        total++;
        if (text === ref) same.push(path);
      }
    }
    expect(total).toBeGreaterThan(300);
    expect(same.length / total, `iguais ao inglês: ${same.slice(0, 20).join(', ')}`).toBeLessThanOrEqual(0.1);
  });
});

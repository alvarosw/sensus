// Escrita de uma palavra (grego, hebraico, latim) e direção de leitura.

/** Palavras em grego (inclui polytonismo e elisão) ou hebraico. Regex global: use com matchAll/replace. */
export const SCRIPT_WORD_RE = /[Ͱ-Ͽἀ-῿֐-׿][Ͱ-Ͽἀ-῿֐-׿\p{M}’']*/gu;

export type Script = 'greek' | 'hebrew' | 'latin' | 'other';
export type Dir = 'ltr' | 'rtl';

/** Escrita pela primeira letra da palavra (sinais diacríticos não contam). */
export function scriptOf(word: string): Script {
  for (const ch of word) {
    if (!/\p{L}/u.test(ch)) continue;
    if (/\p{Script=Hebrew}/u.test(ch)) return 'hebrew';
    if (/\p{Script=Greek}/u.test(ch)) return 'greek';
    if (/\p{Script=Latin}/u.test(ch)) return 'latin';
    return 'other';
  }
  return 'other';
}

export function dirOf(script: Script): Dir {
  return script === 'hebrew' ? 'rtl' : 'ltr';
}

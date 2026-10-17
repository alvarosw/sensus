import { describe, expect, it } from 'vitest';
import { dirOf, SCRIPT_WORD_RE, scriptOf } from '../src/domain';

describe('escrita e direção', () => {
  it('identifica a escrita pela primeira letra', () => {
    expect(scriptOf('ἐκένωσεν')).toBe('greek'); // Fp 2:7
    expect(scriptOf('וַיָּבֵא')).toBe('hebrew'); // 1Rs 15:15
    expect(scriptOf('Jesus')).toBe('latin');
    expect(scriptOf('123')).toBe('other');
    expect(scriptOf('')).toBe('other');
  });

  it('direção: hebraico é da direita para a esquerda', () => {
    expect(dirOf('hebrew')).toBe('rtl');
    expect(dirOf('greek')).toBe('ltr');
    expect(dirOf('latin')).toBe('ltr');
  });

  it('SCRIPT_WORD_RE acha palavras gregas com elisão e hebraicas', () => {
    expect('ἀλλ᾽ ἐκένωσεν'.match(SCRIPT_WORD_RE)).toEqual(['ἀλλ᾽', 'ἐκένωσεν']);
    expect('וַיָּבֵא את'.match(SCRIPT_WORD_RE)).toEqual(['וַיָּבֵא', 'את']);
    expect('Jesus disse'.match(SCRIPT_WORD_RE)).toBeNull();
  });
});

// Referência curta do app: a do núcleo, com a tabela de livros de fallback quando a lista ainda não carregou.
// Casos do NT (Fp 2:5) e do AT (Dn 2:4, 1Rs 15:15, Gn 1).
import { BOOK_TABLE, makeVid } from '@sensus/core';
import { describe, expect, it } from 'vitest';
import { bareWord, chv, refShort } from './format';

describe('refShort', () => {
  it('NT e AT, com e sem livro', () => {
    expect(refShort(50002005, 50002005, BOOK_TABLE, true)).toBe('Fp 2:5');
    expect(refShort(50002005, 50002008, BOOK_TABLE, false)).toBe('2:5–8');
    expect(refShort(27002004, 27002004, BOOK_TABLE, true)).toBe('Dn 2:4');
    expect(refShort(11015015, 11015015, BOOK_TABLE, true)).toBe('1Rs 15:15');
    expect(refShort(1001001, 1001031, BOOK_TABLE, true)).toBe('Gn 1:1–31');
    expect(refShort(1001000, 1001999, BOOK_TABLE, true)).toBe('Gn 1');
  });

  it('sem a lista de livros carregada usa a do núcleo', () => {
    expect(refShort(50002005, 50002005, [], true)).toBe('Fp 2:5');
    expect(refShort(makeVid(1, 1, 1), makeVid(1, 1, 1), [], false)).toBe('1:1');
  });
});

describe('chv', () => {
  it('capítulo e versículo, sem livro (inclusive o versículo 0 da introdução)', () => {
    expect(chv(50002005)).toBe('2:5');
    expect(chv(11015015)).toBe('15:15');
    expect(chv(1001000)).toBe('1:0');
  });
});

describe('bareWord', () => {
  it('tira pontuação de borda, sem mexer nas letras', () => {
    expect(bareWord('λόγος,')).toBe('λόγος');
    expect(bareWord('«ἀγάπη»')).toBe('ἀγάπη');
    expect(bareWord('הָאָרֶץ׃')).toBe('הָאָרֶץ');
  });
});

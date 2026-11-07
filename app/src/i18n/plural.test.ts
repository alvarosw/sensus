// Formas de plural de russo e árabe: casos de cada faixa, incluindo as bordas (11 a 14, 21, 101, 111).
import { describe, expect, it } from 'vitest';
import { arPlural, ruPlural } from './plural';

const ru = (n: number) => ruPlural(n, 'one', 'few', 'many');
const ar = (n: number) => arPlural(n, 'one', 'two', 'few', 'many');

describe('ruPlural (1 / 2-4 / 5+)', () => {
  it.each([
    [1, 'one'], [21, 'one'], [31, 'one'], [101, 'one'],
    [2, 'few'], [3, 'few'], [4, 'few'], [22, 'few'], [23, 'few'], [104, 'few'], [102, 'few'],
    [0, 'many'], [5, 'many'], [9, 'many'], [10, 'many'], [11, 'many'], [12, 'many'], [13, 'many'], [14, 'many'],
    [15, 'many'], [20, 'many'], [25, 'many'], [111, 'many'], [112, 'many'], [114, 'many'], [115, 'many'],
  ])('%i -> %s', (n, form) => {
    expect(ru(n)).toBe(form);
  });

  it('usa as formas reais: стих / стиха / стихов', () => {
    const w = (n: number) => `${n} ${ruPlural(n, 'стих', 'стиха', 'стихов')}`;
    expect([w(1), w(2), w(5), w(11), w(12), w(21), w(22), w(25)]).toEqual([
      '1 стих', '2 стиха', '5 стихов', '11 стихов', '12 стихов', '21 стих', '22 стиха', '25 стихов',
    ]);
  });
});

describe('arPlural (1 / 2 / 3-10 / 11+)', () => {
  it.each([
    [1, 'one'],
    [2, 'two'],
    [3, 'few'], [7, 'few'], [10, 'few'],
    [0, 'many'], [11, 'many'], [12, 'many'], [99, 'many'], [100, 'many'], [101, 'many'],
  ])('%i -> %s', (n, form) => {
    expect(ar(n)).toBe(form);
  });
});

import { describe, expect, it } from 'vitest';
import {
  BOOK_TABLE,
  chapterRange,
  formatReference,
  formatVerse,
  makeVid,
  parseRef,
  resolveBook,
  splitVid,
} from '../src/index';

describe('vid', () => {
  it('monta e separa ids de versículo', () => {
    expect(makeVid(50, 1, 1)).toBe(50001001);
    expect(splitVid(50002005)).toEqual({ book: 50, chapter: 2, verse: 5 });
  });

  it('rejeita valores fora do intervalo', () => {
    expect(() => makeVid(0, 1, 1)).toThrow(RangeError);
    expect(() => makeVid(67, 1, 1)).toThrow(RangeError);
    expect(() => makeVid(50, 1000, 1)).toThrow(RangeError);
    expect(() => makeVid(50, 1, -1)).toThrow(RangeError);
  });
});

describe('formatReference', () => {
  const r = (start: number, end: number) => ({ start, end });

  it('formata versículo, intervalo no capítulo e entre capítulos em pt-BR', () => {
    expect(formatReference(r(50002005, 50002008))).toBe('Filipenses 2:5-8');
    expect(formatReference(r(50002005, 50002005))).toBe('Filipenses 2:5');
    expect(formatReference(r(50002005, 50003001))).toBe('Filipenses 2:5-3:1');
    expect(formatVerse(50002005)).toBe('Filipenses 2:5');
  });

  it('formata capítulos inteiros, livro inteiro e intro', () => {
    expect(formatReference(chapterRange(50, 2))).toBe('Filipenses 2');
    expect(formatReference(r(50002000, 50002000))).toBe('Filipenses 2 (introdução)');
    expect(formatReference(r(makeVid(50, 1, 1), makeVid(50, 4, 999)))).toBe('Filipenses');
    expect(formatReference(r(makeVid(50, 2, 1), makeVid(50, 3, 999)))).toBe('Filipenses 2-3');
  });

  it('formata intervalos de livros diferentes', () => {
    expect(formatReference(r(50002005, 51001001))).toBe('Filipenses 2:5 - Colossenses 1:1');
  });
});

describe('resolveBook e parseRef', () => {
  it('resolve OSIS, nomes pt/en, abreviações e numerais romanos', () => {
    expect(resolveBook('Phil')?.num).toBe(50);
    expect(resolveBook('Filipenses')?.num).toBe(50);
    expect(resolveBook('Fp')?.num).toBe(50);
    expect(resolveBook('1 João')?.num).toBe(62);
    expect(resolveBook('I Jo')?.num).toBe(62);
    expect(resolveBook('Foo')).toBeNull();
  });

  it('interpreta referências simples', () => {
    expect(parseRef('Phil 2:5-8')).toEqual({ start: 50002005, end: 50002008 });
    expect(parseRef('Filipenses 2:5-8')).toEqual({ start: 50002005, end: 50002008 });
    expect(parseRef('Fp 2.5')).toEqual({ start: 50002005, end: 50002005 });
    expect(parseRef('Phil. 2:5')).toEqual({ start: 50002005, end: 50002005 });
    expect(parseRef('1 João 3:16')).toEqual({ start: 62003016, end: 62003016 });
    expect(parseRef('Phil 2:5–3:1')).toEqual({ start: 50002005, end: 50003001 });
  });

  it('interpreta capítulos e intervalos de capítulos', () => {
    expect(parseRef('Phil 2')).toEqual(chapterRange(50, 2));
    expect(parseRef('Phil 2-3')).toEqual({ start: makeVid(50, 2, 1), end: makeVid(50, 3, 999) });
  });

  it('retorna null para referências inválidas', () => {
    expect(parseRef('Foo 1:1')).toBeNull();
    expect(parseRef('Phil 9:1')).toBeNull();
    expect(parseRef('Phil 2:8-5')).toBeNull();
    expect(parseRef('')).toBeNull();
  });

  it('usa a tabela de livros embutida por padrão', () => {
    expect(BOOK_TABLE).toHaveLength(66);
  });
});

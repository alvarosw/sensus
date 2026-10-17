import { describe, expect, it } from 'vitest';
import { bookStartVid, chapterStartVid, isIntroCommentary, isIntroVid } from '../src/domain';

describe('vid: introdução e início de livro/capítulo', () => {
  it('versículo 0 é introdução', () => {
    expect(isIntroVid(50000000)).toBe(true); // introdução de Filipenses
    expect(isIntroVid(50002000)).toBe(true); // introdução do capítulo 2
    expect(isIntroVid(50002007)).toBe(false); // Fp 2:7
    expect(isIntroVid(11015015)).toBe(false); // 1Rs 15:15
  });

  it('comentário de introdução: começa ou termina em versículo 0', () => {
    expect(isIntroCommentary({ start_vid: 50000000, end_vid: 50001000 })).toBe(true);
    expect(isIntroCommentary({ start_vid: 50001001, end_vid: 50001000 })).toBe(true);
    expect(isIntroCommentary({ start_vid: 50002005, end_vid: 50002011 })).toBe(false);
  });

  it('início de livro e de capítulo (primeiro versículo)', () => {
    expect(bookStartVid(50)).toBe(50001001);
    expect(bookStartVid(11)).toBe(11001001);
    expect(chapterStartVid(11, 15)).toBe(11015001);
    expect(() => chapterStartVid(67, 1)).toThrow(RangeError);
  });
});

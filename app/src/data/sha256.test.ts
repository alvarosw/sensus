// SHA-256 incremental: deve bater com o digest de uma vez (node:crypto) qualquer que seja o corte em blocos.
import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createSha256Stream, sameDigest } from './sha256';

function streamed(data: Uint8Array, block: number): string {
  const s = createSha256Stream();
  for (let i = 0; i < data.length; i += block) s.update(data.subarray(i, i + block));
  return s.hexDigest();
}

describe('createSha256Stream', () => {
  const data = new Uint8Array(randomBytes(300_000));
  const expected = createHash('sha256').update(data).digest('hex');

  it('bate com o digest de uma vez em blocos de vários tamanhos', () => {
    for (const block of [1, 63, 64, 65, 4096, 1_000_000]) {
      expect(streamed(data, block)).toBe(expected);
    }
  });

  it('vazio tem o digest conhecido', () => {
    expect(createSha256Stream().hexDigest()).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('sameDigest', () => {
  it('ignora maiúsculas e minúsculas', () => {
    expect(sameDigest('ABCDEF', 'abcdef')).toBe(true);
    expect(sameDigest('abc', 'abd')).toBe(false);
  });
});

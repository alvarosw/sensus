import { describe, expect, it } from 'vitest';
import { makeVid, type Repo } from '@sensus/core';
import { chapterIndex, loadChapter } from './chapters';

/** Repo falso: só o que loadChapter usa. `verses` = versículos que a fonte devolve em qualquer capítulo pedido. */
function fakeRepo(verses: (book: number, chapter: number) => { vid: number; text: string }[]): Repo & { calls: number } {
  const repo = {
    calls: 0,
    chapter: async (_source: string, book: number, chapter: number) => {
      repo.calls++;
      return verses(book, chapter);
    },
    divisions: async () => [],
  };
  return repo as unknown as Repo & { calls: number };
}

const none = () => [];
const some = (book: number, chapter: number) => [
  { vid: makeVid(book, chapter, 1), text: 'No princípio' },
  { vid: makeVid(book, chapter, 2), text: 'E a terra' },
];

describe('loadChapter', () => {
  it('guarda em cache por Repo e fonte: o mesmo Repo não consulta de novo', async () => {
    const repo = fakeRepo(some);
    const idx = chapterIndex(43, 1); // João 1 (NT)
    await loadChapter(repo, 'blivre', idx);
    await loadChapter(repo, 'blivre', idx);
    expect(repo.calls).toBe(1);
  });

  it('um Repo novo (Bíblia instalada depois) não herda o capítulo vazio do anterior — AT', async () => {
    const idx = chapterIndex(1, 1); // Gênesis 1 (AT)
    const before = await loadChapter(fakeRepo(none), 'blivre-at', idx);
    expect(before.blocks).toEqual([]);
    const after = await loadChapter(fakeRepo(some), 'blivre-at', idx);
    expect(after.first).toBe(makeVid(1, 1, 1));
    expect(after.blocks.length).toBeGreaterThan(0);
  });

  it('o mesmo vale no NT', async () => {
    const idx = chapterIndex(40, 5); // Mateus 5
    await loadChapter(fakeRepo(none), 'blivre-nt', idx);
    const after = await loadChapter(fakeRepo(some), 'blivre-nt', idx);
    expect(after.last).toBe(makeVid(40, 5, 2));
  });
});

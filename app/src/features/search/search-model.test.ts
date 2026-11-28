// Filtros por testamento (domínio) e livro, contagem, grupos com "Mais N", trecho destacado e recentes; NT e AT.
import { describe, expect, it } from 'vitest';
import { makeVid } from '@sensus/core';
import { foldText, matchRanges } from '../../data/bibles/search-model';
import { countByBook, filterHits, groupHits, hitBookName, hitRef, pushRecent, snippetParts } from './search-model';

// "graça" na BLivre: Gn 6:8 (AT), Rm 1:5, 1:7, 3:24, 4:16 e Ef 2:8 (NT).
const HITS = [makeVid(1, 6, 8), makeVid(45, 1, 5), makeVid(45, 1, 7), makeVid(45, 3, 24), makeVid(45, 4, 16), makeVid(49, 2, 8)];

describe('filtros e contagem', () => {
  it('testamento pelo domínio: AT e NT', () => {
    expect(filterHits(HITS, { testament: 'OT', book: null })).toEqual([makeVid(1, 6, 8)]);
    expect(filterHits(HITS, { testament: 'NT', book: null })).toHaveLength(5);
    expect(filterHits(HITS, { testament: 'all', book: 49 })).toEqual([makeVid(49, 2, 8)]);
    expect(filterHits(HITS, { testament: 'OT', book: 45 })).toEqual([]);
  });
  it('contagem por livro na ordem canônica', () => {
    expect(countByBook(HITS)).toEqual([{ book: 1, count: 1 }, { book: 45, count: 4 }, { book: 49, count: 1 }]);
  });
});

describe('groupHits', () => {
  it('3 por livro e "Mais N"; livro aberto mostra todos', () => {
    const groups = groupHits(HITS, new Set());
    expect(groups.find((g) => g.book === 45)).toMatchObject({ total: 4, more: 1 });
    expect(groups.find((g) => g.book === 45)!.shown).toHaveLength(3);
    expect(groupHits(HITS, new Set([45])).find((g) => g.book === 45)!.more).toBe(0);
  });
  it('um livro só (filtro): mostra todos', () => {
    expect(groupHits(filterHits(HITS, { testament: 'all', book: 45 }), new Set())[0]).toMatchObject({ total: 4, more: 0 });
  });
});

describe('snippetParts', () => {
  it('NT (Ef 2:8): marca o termo sem cortar o versículo curto', () => {
    const text = 'Porque pela graça sois salvos, por meio da fé;';
    const parts = snippetParts(text, matchRanges(text, ['graca'], false));
    expect(parts).toEqual([
      { text: 'Porque pela ', hit: false },
      { text: 'graça', hit: true },
      { text: ' sois salvos, por meio da fé;', hit: false },
    ]);
  });
  it('AT longo: corta em volta do termo, em fronteira de palavra, com reticências', () => {
    const text = `${'palavra '.repeat(30)}SENHOR ${'fim '.repeat(40)}`.trim();
    const parts = snippetParts(text, matchRanges(text, ['senhor'], false), 120);
    expect(parts[0]).toEqual({ text: '…', hit: false });
    expect(parts.at(-1)).toEqual({ text: '…', hit: false });
    expect(parts.find((p) => p.hit)?.text).toBe('SENHOR');
    expect(parts[1]!.text.startsWith('palavra')).toBe(true);
  });
});

describe('pushRecent', () => {
  it('mais recente primeiro, sem repetir (acento e maiúscula), até 5', () => {
    const list = pushRecent(['servo', 'graca', 'fé', 'amor', 'paz'], 'Graça', foldText);
    expect(list).toEqual(['Graça', 'servo', 'fé', 'amor', 'paz']);
    expect(pushRecent(list, 'esperança', foldText)).toHaveLength(5);
    expect(pushRecent(list, '   ', foldText)).toEqual(list);
  });
});

describe('rótulos', () => {
  it('referência e nome do livro no idioma do app (NT e AT)', () => {
    expect(hitRef(makeVid(49, 2, 8))).toBe('Ef 2:8');
    expect(hitRef(makeVid(11, 15, 15))).toBe('1Rs 15:15');
    expect(hitRef(makeVid(49, 2, 8), 'en')).toBe('Eph 2:8');
    expect(hitBookName(1)).toBe('Gênesis');
  });
});

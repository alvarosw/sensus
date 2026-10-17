import { describe, expect, it } from 'vitest';
import {
  buildCards,
  canConfirm,
  comboKey,
  favoriteCombo,
  parseCombos,
  recordRecent,
  removeCombo,
  RECENT_COMBOS_MAX,
  trimRecents,
  unfavoriteCombo,
  type UserCombo,
} from '../src/timeline-combos';

const combo = (id: string, lines: string[], favorite = false): UserCombo => ({ id, name: `n${id}`, lines, favorite });
const READY = [
  { id: 'r1', name: 'Pronta 1', lines: ['a', 'b'] },
  { id: 'r2', name: 'Pronta 2', lines: ['c', 'd'] },
  { id: 'r3', name: 'Pronta 3', lines: ['e'] },
  { id: 'r4', name: 'Pronta 4', lines: ['f'] },
  { id: 'r5', name: 'Pronta 5', lines: ['g'] },
];

describe('chave da combinação', () => {
  it('ignora a ordem e repetições', () => {
    expect(comboKey(['b', 'a', 'a'])).toBe(comboKey(['a', 'b']));
    expect(comboKey(['a'])).not.toBe(comboKey(['a', 'b']));
  });
});

describe('cartões da entrada', () => {
  it('sem combinações do usuário, mostra as cinco prontas', () => {
    const cards = buildCards([], READY);
    expect(cards.map((c) => c.id)).toEqual(['ready:r1', 'ready:r2', 'ready:r3', 'ready:r4', 'ready:r5']);
    expect(cards.every((c) => c.source === 'ready')).toBe(true);
  });

  it('favoritas vêm primeiro, depois recentes, e as prontas só completam até cinco', () => {
    const saved = [combo('rec1', ['x']), combo('fav1', ['y'], true), combo('rec2', ['z'])];
    const cards = buildCards(saved, READY);
    expect(cards.map((c) => c.id)).toEqual(['fav1', 'rec1', 'rec2', 'ready:r1', 'ready:r2']);
    expect(cards.slice(0, 3).every((c) => c.source === 'mine')).toBe(true);
  });

  it('com cinco combinações do usuário, as prontas somem', () => {
    const saved = ['1', '2', '3', '4', '5'].map((id) => combo(id, [id]));
    const cards = buildCards(saved, READY);
    expect(cards).toHaveLength(5);
    expect(cards.every((c) => c.source === 'mine')).toBe(true);
  });

  it('uma pronta que o usuário já tem (mesmas linhas) não aparece de novo', () => {
    const saved = [combo('mine', ['b', 'a'], true)];
    const cards = buildCards(saved, READY);
    expect(cards.map((c) => c.id)).toEqual(['mine', 'ready:r2', 'ready:r3', 'ready:r4', 'ready:r5']);
  });

  it('nunca passa do máximo, mesmo com muitas favoritas', () => {
    const saved = ['1', '2', '3', '4', '5', '6', '7'].map((id) => combo(id, [id], true));
    expect(buildCards(saved, READY)).toHaveLength(5);
  });
});

describe('persistência das combinações', () => {
  it('confirmar cria uma recente no topo, sem repetir as mesmas linhas', () => {
    let list: UserCombo[] = [];
    list = recordRecent(list, ['a', 'b'], 'Ab', 'id1');
    list = recordRecent(list, ['c'], 'C', 'id2');
    list = recordRecent(list, ['b', 'a'], 'outro nome', 'id3');
    expect(list.map((c) => c.id)).toEqual(['id1', 'id2']);
    expect(list[0]!.favorite).toBe(false);
  });

  it('as recentes não favoritas ficam nas últimas cinco; as favoritas não saem', () => {
    let list: UserCombo[] = [combo('fav', ['fav'], true)];
    for (let i = 0; i < 9; i++) list = recordRecent(list, [`l${i}`], `n${i}`, `id${i}`);
    const recents = list.filter((c) => !c.favorite);
    expect(recents).toHaveLength(RECENT_COMBOS_MAX);
    expect(recents[0]!.id).toBe('id8');
    expect(list.some((c) => c.id === 'fav')).toBe(true);
  });

  it('confirmar uma combinação que já é favorita não muda nada', () => {
    const list = [combo('fav', ['a', 'b'], true)];
    expect(recordRecent(list, ['b', 'a'], 'x', 'novo')).toEqual(list);
  });

  it('favoritar uma recente a promove (mesmo id, com o nome dado) e não a duplica', () => {
    const list = [combo('rec', ['a'], false), combo('old', ['z'], false)];
    const next = favoriteCombo(list, ['a'], 'Meu nome', 'novo');
    expect(next.filter((c) => comboKey(c.lines) === comboKey(['a']))).toHaveLength(1);
    expect(next.find((c) => c.id === 'rec')).toMatchObject({ favorite: true, name: 'Meu nome' });
  });

  it('favoritar uma pronta cria uma combinação do usuário favorita', () => {
    const next = favoriteCombo([], READY[0]!.lines, 'Pronta 1', 'novo');
    expect(next).toEqual([{ id: 'novo', name: 'Pronta 1', lines: ['a', 'b'], favorite: true }]);
    expect(buildCards(next, READY).map((c) => c.id)).toEqual(['novo', 'ready:r2', 'ready:r3', 'ready:r4', 'ready:r5']);
  });

  it('desfavoritar devolve a combinação para as recentes; remover tira', () => {
    const list = [combo('fav', ['a'], true)];
    const un = unfavoriteCombo(list, 'fav');
    expect(un[0]).toMatchObject({ id: 'fav', favorite: false });
    expect(removeCombo(un, 'fav')).toEqual([]);
  });

  it('trimRecents mantém a ordem e só corta as recentes', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => combo(id, [id]));
    expect(trimRecents(many).map((c) => c.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('lê só o que é válido do arquivo', () => {
    const parsed = parseCombos([
      { id: 'ok', name: ' Nome ', lines: ['a', 'a', 'b'], favorite: true },
      { id: 'sem-linhas', name: 'x', lines: [], favorite: false },
      { name: 'sem id', lines: ['c'] },
      { id: 'repetida', name: 'y', lines: ['b', 'a'] },
      'lixo',
    ]);
    expect(parsed).toEqual([{ id: 'ok', name: 'Nome', lines: ['a', 'b'], favorite: true }]);
    expect(parseCombos({ oi: 1 })).toEqual([]);
  });
});

describe('botão Confirmar', () => {
  it('habilitado só com pelo menos uma linha', () => {
    expect(canConfirm([])).toBe(false);
    expect(canConfirm(['a'])).toBe(true);
    expect(canConfirm(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])).toBe(true);
  });
});

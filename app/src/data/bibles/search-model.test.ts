// Regras da busca: termos sem acento, MATCH sem operadores soltos, destaque e marca do índice (NT e AT).
import { describe, expect, it } from 'vitest';
import { ftsMatch, indexChunks, indexIsCurrent, indexStamp, matchRanges, searchTerms, textMatches } from './search-model';

const EF_2_8 = 'Porque pela graça sois salvos, por meio da fé; e isto não vem de vós; é dom de Deus;';
const RS_15_15 = 'E trouxe à Casa do SENHOR as coisas consagradas por seu pai, e as coisas que ele havia consagrado: prata, ouro e utensílios.';

describe('searchTerms', () => {
  it('sem acento, minúsculas, sem repetição e sem pontuação', () => {
    expect(searchTerms('  Graça, GRAÇA e Fé! ')).toEqual(['graca', 'e', 'fe']);
    expect(searchTerms('"" ** ()')).toEqual([]);
  });
  it('limita o número de termos', () => {
    expect(searchTerms('a b c d e f g h')).toHaveLength(6);
  });
});

describe('ftsMatch', () => {
  it('palavra inteira e prefixo', () => {
    expect(ftsMatch(['graca'], false)).toBe('"graca"');
    expect(ftsMatch(['graca', 'fe'], true)).toBe('"graca"* "fe"*');
  });
  it('operadores e aspas digitados viram texto', () => {
    expect(ftsMatch(searchTerms('graça" OR NEAR(fé* ^x:y)'), false)).toBe('"graca" "or" "near" "fe" "x" "y"');
    expect(ftsMatch(['a"b'], false)).toBe('"a""b"');
  });
});

describe('matchRanges e textMatches', () => {
  it('NT (Ef 2:8): acha "graça" digitando sem acento, só a palavra inteira', () => {
    const [r] = matchRanges(EF_2_8, ['graca'], false);
    expect(EF_2_8.slice(r![0], r![1])).toBe('graça');
    expect(textMatches(EF_2_8, ['graca', 'fe'], false)).toBe(true);
    expect(textMatches('Dai graças a Deus', ['graca'], false)).toBe(false);
    expect(textMatches('Dai graças a Deus', ['graca'], true)).toBe(true);
  });
  it('AT (1Rs 15:15): maiúsculas e prefixo', () => {
    const ranges = matchRanges(RS_15_15, ['consagr'], true);
    expect(ranges.map(([a, b]) => RS_15_15.slice(a, b))).toEqual(['consagradas', 'consagrado']);
    expect(matchRanges(RS_15_15, ['senhor'], false).map(([a, b]) => RS_15_15.slice(a, b))).toEqual(['SENHOR']);
  });
});

describe('índice', () => {
  it('marca com formato e versão', () => {
    expect(indexIsCurrent(indexStamp('2026.11.06'), '2026.11.06')).toBe(true);
    expect(indexIsCurrent(indexStamp('2026.11.06'), '2026.12.01')).toBe(false);
    expect(indexIsCurrent(null, '2026.11.06')).toBe(false);
  });
  it('lotes cobrem todos os rowid', () => {
    expect(indexChunks(4500, 2000)).toEqual([[1, 2000], [2001, 4000], [4001, 4500]]);
    expect(indexChunks(0)).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import type { LexiconEntry } from '../src/types';
import { LEXICONS, lexiconByBase, pickLexicon } from '../src/domain';

function entry(source: string, key: string, base: string, gloss: string): LexiconEntry {
  return {
    cite_id: `lex:${source}:${key}`,
    source_id: source,
    key,
    strong_base: base,
    lemma: null,
    translit: null,
    gloss,
    definition: gloss,
    lang: 'en',
  };
}

// Valores reais do banco (lexicon_entry): TBESH de H0935 (1Rs 15:15), TBESG e TFLSJ de G2758 (Fp 2:7).
const TBESH_G = entry('stepbible-tbesh', 'H0935G', 'H0935', 'to come (in): come');
const TBESH_P = entry('stepbible-tbesh', 'H0935P', 'H0935', 'to come (in): bring');
const TBESG = entry('stepbible-tbesg', 'G2758', 'G2758', 'to empty');
const TFLSJ = entry('stepbible-tflsj', 'G2758', 'G2758', 'to empty');
const ENTRIES = [TBESH_G, TBESH_P, TBESG, TFLSJ];

describe('léxico por língua', () => {
  it('fontes e rótulos por língua', () => {
    expect(LEXICONS.grc).toEqual({ primary: 'stepbible-tbesg', secondary: 'stepbible-tflsj', label: 'TBESG' });
    expect(LEXICONS.hbo).toEqual({ primary: 'stepbible-tbesh', label: 'TBESH' });
    expect(LEXICONS.arc).toEqual({ primary: 'stepbible-tbesh', label: 'TBESH' });
  });

  it('hebraico: a chave com sufixo vence (H0935P, não H0935G)', () => {
    const pick = pickLexicon(ENTRIES, 'H0935P', 'hbo');
    expect(pick.primary).toBe(TBESH_P);
    expect(pick.secondary).toBeNull();
  });

  it('hebraico: sem a chave exata, o primeiro verbete da base na fonte principal', () => {
    expect(pickLexicon(ENTRIES, 'H0935', 'hbo').primary).toBe(TBESH_G);
  });

  it('aramaico usa o TBESH, como o hebraico', () => {
    expect(pickLexicon(ENTRIES, 'H0935P', 'arc').primary).toBe(TBESH_P);
  });

  it('grego: TBESG e LSJ (TFLSJ) como secundário', () => {
    const pick = pickLexicon(ENTRIES, 'G2758', 'grc');
    expect(pick.primary).toBe(TBESG);
    expect(pick.secondary).toBe(TFLSJ);
  });

  it('nunca devolve verbete de outra língua', () => {
    expect(pickLexicon(ENTRIES, 'G2758', 'hbo')).toEqual({ primary: null, secondary: null });
    expect(pickLexicon(ENTRIES, 'H0935P', 'grc')).toEqual({ primary: null, secondary: null });
    expect(pickLexicon(ENTRIES, 'lixo', 'grc')).toEqual({ primary: null, secondary: null });
  });

  it('sem Strong, o primeiro verbete da fonte principal da língua', () => {
    expect(pickLexicon(ENTRIES, null, 'hbo').primary).toBe(TBESH_G);
    expect(pickLexicon(ENTRIES, null, 'grc').primary).toBe(TBESG);
  });

  it('mapa por base: fonte principal antes da complementar, só da língua', () => {
    const byBase = lexiconByBase(ENTRIES, 'grc');
    expect(byBase.get('G2758' as never)).toBe(TBESG);
    const heb = lexiconByBase(ENTRIES, 'hbo');
    expect(heb.get('H0935' as never)).toBe(TBESH_G);
    expect(heb.has('G2758' as never)).toBe(false);
  });
});

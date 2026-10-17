import { describe, expect, it } from 'vitest';
import type { LexiconEntry } from '@sensus/core';
import { pickLexicon } from './lexicon-pick';

const entry = (source_id: string, key: string, strong_base: string): LexiconEntry => ({
  cite_id: `lex:${source_id}:${key}`,
  source_id,
  key,
  strong_base,
  lemma: null,
  translit: null,
  gloss: null,
  definition: `verbete ${key}`,
  lang: 'en',
});

// 1Rs 15:15 (H0935P) só tem TBESH; o banco traz H0935G…P nessa fonte.
const hebrew = [entry('stepbible-tbesh', 'H0935G', 'H0935'), entry('stepbible-tbesh', 'H0935P', 'H0935')];
// Greek: TBESG e TFLSJ com a mesma chave base.
const greek = [
  entry('stepbible-tbesg', 'G2424G', 'G2424'),
  entry('stepbible-tbesg', 'G2424H', 'G2424'),
  entry('stepbible-tflsj', 'G2424G', 'G2424'),
];

describe('pickLexicon (fonte pelo idioma e verbete pelo Strong estendido)', () => {
  it('hebraico: usa TBESH e o verbete com o sufixo da forma (H0935P), sem LSJ', () => {
    const pair = pickLexicon(hebrew, 'H0935P');
    expect(pair.main?.key).toBe('H0935P');
    expect(pair.main?.source_id).toBe('stepbible-tbesh');
    expect(pair.lsj).toBeNull();
  });

  it('hebraico sem a chave exata: primeiro verbete da fonte certa', () => {
    expect(pickLexicon(hebrew, null).main?.key).toBe('H0935G');
  });

  it('grego: usa TBESG (não TBESH) e o LSJ da forma', () => {
    const pair = pickLexicon(greek, 'G2424H');
    expect(pair.main?.key).toBe('G2424H');
    expect(pair.main?.source_id).toBe('stepbible-tbesg');
    expect(pair.lsj?.source_id).toBe('stepbible-tflsj');
  });

  it('lema sem forma (strong null) de grego pega o primeiro TBESG', () => {
    expect(pickLexicon(greek, null).main?.key).toBe('G2424G');
  });

  it('sem entradas: nada', () => {
    expect(pickLexicon([], 'H0935P')).toEqual({ main: null, lsj: null });
  });
});

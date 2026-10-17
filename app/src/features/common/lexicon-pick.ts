// Escolha do verbete do léxico para uma forma. A fonte depende do idioma: TBESH para o hebraico (H…), TBESG para o
// grego (G…); o LSJ só existe para o grego. Módulo sem dependências de tela, para ser testado.
import type { LexiconEntry } from '@sensus/core';
import { isOldTestament } from '../study/format';

export const LEXICON_TBESG = 'stepbible-tbesg';
export const LEXICON_TBESH = 'stepbible-tbesh';
export const LEXICON_LSJ = 'stepbible-tflsj';

export interface LexiconPair {
  /** Verbete principal: TBESH (hebraico) ou TBESG (grego). */
  main: LexiconEntry | null;
  /** Verbete do LSJ (só grego). */
  lsj: LexiconEntry | null;
}

/**
 * Escolhe o verbete certo para a forma: pela fonte do idioma e pela chave com o sufixo do Strong estendido
 * (H0935P, G2424G). Sem a chave exata, o primeiro verbete da fonte.
 */
export function pickLexicon(entries: LexiconEntry[], strong: string | null): LexiconPair {
  const base = strong ?? entries[0]?.strong_base ?? '';
  const hebrew = isOldTestament(base);
  const pick = (source: string): LexiconEntry | null => {
    const list = entries.filter((e) => e.source_id === source);
    return list.find((e) => strong && e.key === strong) ?? list[0] ?? null;
  };
  return {
    main: pick(hebrew ? LEXICON_TBESH : LEXICON_TBESG),
    lsj: hebrew ? null : pick(LEXICON_LSJ),
  };
}

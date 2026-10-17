// Fatos de uma palavra (token) reunidos num lugar: a tela pergunta aqui, não reimplementa.
import type { Token } from '../types';
import { langOfToken, testamentOfCorpus, type Lang, type Testament } from './language';
import { LEXICONS } from './lexicon';
import { isContentToken, isProperNameToken, isVerbToken } from './morph';
import { parseStrong, type Strong } from './strong';
import { dirOf, scriptOf, type Dir, type Script } from './script';

export interface WordFacts {
  lang: Lang;
  testament: Testament;
  strong: Strong | null;
  /** Rótulo do léxico da língua (ex.: "TBESG", "TBESH"). */
  lexiconLabel: string;
  script: Script;
  dir: Dir;
  isContent: boolean;
  isVerb: boolean;
  isProperName: boolean;
}

export function wordFacts(
  token: Pick<Token, 'corpus' | 'morph' | 'morph_desc' | 'strong' | 'surface'>,
): WordFacts {
  const lang = langOfToken(token);
  const script = scriptOf(token.surface);
  return {
    lang,
    testament: testamentOfCorpus(token.corpus),
    strong: token.strong ? parseStrong(token.strong) : null,
    lexiconLabel: LEXICONS[lang].label,
    script,
    dir: dirOf(script),
    isContent: isContentToken(token),
    isVerb: isVerbToken(token),
    isProperName: isProperNameToken(token),
  };
}

// Língua, testamento, léxico e verbete de uma palavra (token) ou de um lema (só o strong_base). Usado pelo painel
// da palavra e pela prévia. A regra é do domínio (CORPUS, LEXICONS, pickLexicon); aqui só se junta. Sem React nem banco.
import {
  CORPUS,
  langOfStrong,
  langOfToken,
  LEXICONS,
  pickLexicon,
  testamentOfCorpus,
  type Corpus,
  type Lang,
  type LexiconEntry,
  type LexiconPick,
  type Testament,
  type Token,
} from '@sensus/core';

export interface WordView {
  /** Língua da forma; null se o Strong do lema não for reconhecido. */
  lang: Lang | null;
  testament: Testament | null;
  /** Rótulo do léxico da língua (o do domínio, LEXICONS); vazio sem língua. */
  lexiconLabel: string;
  /** Verbete da forma: principal (da língua) e complementar (LSJ, só grego). */
  lex: LexiconPick;
}

/** Testamento do corpus que contém a língua (grc: NT; hbo e arc: AT). */
function testamentOfLang(lang: Lang): Testament | null {
  const corpus = (Object.keys(CORPUS) as Corpus[]).find((k) => CORPUS[k].langs.includes(lang));
  return corpus ? testamentOfCorpus(corpus) : null;
}

export function wordView(token: Token | null, strongBase: string | null, lexicon: readonly LexiconEntry[]): WordView {
  const lang = token ? langOfToken(token) : strongBase ? langOfStrong(strongBase) : null;
  const testament = token ? testamentOfCorpus(token.corpus) : lang ? testamentOfLang(lang) : null;
  const lex: LexiconPick = lang ? pickLexicon(lexicon, token?.strong ?? strongBase, lang) : { primary: null, secondary: null };
  return { lang, testament, lexiconLabel: lang ? LEXICONS[lang].label : '', lex };
}

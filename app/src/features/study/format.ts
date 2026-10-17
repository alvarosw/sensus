// Formatação e seleção de dados para a folha de estudo (referências, tradições, morfologia, palavras-chave).
import {
  BOOK_TABLE,
  commentatorOf,
  formatReference,
  isBaseTextToken,
  isContentToken,
  isIntroCommentary,
  isIntroVid,
  langOfToken,
  pickLexicon,
  testamentOfCorpus,
  traditionLabel,
  type Book,
  type Commentary,
  type LexiconEntry,
  type PanelData,
  type Source,
  type Testament,
  type Token,
  type Vid,
} from '@sensus/core';

/**
 * Referência com travessão: "Filipenses 1:30–2:1" ou "Filipenses 4:23 – Colossenses 1:1". Nome do livro e
 * capítulo ficam juntos (espaço não separável) para a quebra de linha cair só no travessão entre livros.
 */
export function refTitle(start: Vid, end: Vid, books: readonly Book[]): string {
  const table = books.length > 0 ? (books as Book[]) : BOOK_TABLE;
  return formatReference({ start, end }, table)
    .replace(/(?<=\d)-(?=\d)/g, '–')
    .replace(/ - /g, ' – ')
    .replace(/(?<=\p{L}) (?=\d)/gu, '\u00A0');
}

// ---- comentários ---------------------------------------------------------------------------------

export interface CommentaryView {
  commentary: Commentary;
  /** Nome curto do autor/obra (coluna da matriz). */
  author: string;
  /** Rótulo agrupado para a matriz (patrística num só grupo). */
  column: string;
  tradition: string;
  /** Trecho sem o cabeçalho "Autor — Obra" dos pais da Igreja. */
  body: string;
  /** true = introdução do capítulo/livro (vid com versículo 0). */
  intro: boolean;
}

export function viewCommentary(c: Commentary, source: Source | undefined): CommentaryView {
  const patristic = c.source_id === 'patristic';
  const author = commentatorOf(source, c);
  let body = c.text;
  if (patristic) {
    const parts = c.text.split(/\n{2,}/);
    if (parts.length > 1 && /\s[—–-]\s/.test(parts[0]!)) body = parts.slice(1).join('\n\n');
  }
  return {
    commentary: c,
    author,
    column: patristic ? 'Patrística' : author,
    tradition: traditionLabel(source?.tradition),
    body: body.trim(),
    intro: isIntroCommentary(c),
  };
}

// ---- palavras-chave ------------------------------------------------------------------------------

export interface KeyWord {
  token: Token;
  strongBase: string;
  /** Verbete do próprio token (o sufixo do Strong conta: H0935P recebe o verbete H0935P). */
  lexicon: LexiconEntry | null;
  /** Total de versículos com a palavra, no testamento da palavra. */
  count: number;
  testament: Testament;
}

const MAX_KEY_WORDS = 12;
const COMMON_LIMIT = 40;

/**
 * Verbete do token: a chave exata do Strong (com sufixo) na fonte da língua; sem ela, a base; na falta, o
 * complementar (LSJ no grego). Escolha do domínio (pickLexicon), não da feature.
 */
export function lexiconOfToken(panel: PanelData, t: Token): LexiconEntry | null {
  const pick = pickLexicon(panel.layers.language.lexicon, t.strong ?? t.strong_base, langOfToken(t));
  return pick.primary ?? pick.secondary;
}

/**
 * Palavra que conta como chave: de conteúdo, com Strong, e do texto-base do corpus (TR no NT; todo o texto no AT,
 * inclusive o Qere). É a mesma regra do contexto da IA (isBaseTextToken): a palavra do passo nunca é uma que a IA
 * não recebeu.
 */
export function isKeyToken(t: Token): boolean {
  return !!t.strong_base && isContentToken(t) && isBaseTextToken(t);
}

/** Palavras de conteúdo do trecho, das mais raras para as mais comuns (hápax primeiro). */
export function keyWordsOf(panel: PanelData): KeyWord[] {
  const seen = new Set<string>();
  const out: KeyWord[] = [];
  for (const t of panel.layers.text.original) {
    const sb = t.strong_base;
    if (!sb || seen.has(sb) || !isKeyToken(t)) continue;
    seen.add(sb);
    const count = panel.layers.language.concordance[sb]?.count ?? 0;
    out.push({ token: t, strongBase: sb, lexicon: lexiconOfToken(panel, t), count, testament: testamentOfCorpus(t.corpus) });
  }
  out.sort((a, b) => (a.count || 9999) - (b.count || 9999));
  const rare = out.filter((w) => w.count > 0 && w.count <= COMMON_LIMIT);
  return (rare.length > 0 ? rare : out).slice(0, MAX_KEY_WORDS);
}

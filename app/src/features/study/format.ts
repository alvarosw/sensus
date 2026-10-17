// Formatação e seleção de dados para a folha de estudo (referências, tradições, morfologia, palavras-chave).
import {
  BOOK_TABLE,
  commentatorOf,
  formatReference,
  formatShortRef,
  isBaseTextToken,
  isContentToken,
  isIntroCommentary,
  isIntroVid,
  langOfToken,
  pickLexicon,
  splitVid,
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

/** "1:30" */
export function chv(vid: Vid): string {
  const p = splitVid(vid);
  return `${p.chapter}:${p.verse}`;
}

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

/** "1:27–2:4" (sem livro) ou "Fp 1:27–2:4" (com livro abreviado). */
export function refShort(start: Vid, end: Vid, books: readonly Book[], withBook = false): string {
  const table = books.length > 0 ? (books as Book[]) : BOOK_TABLE;
  return formatShortRef(start, end, table, withBook);
}

// ---- morfologia em português ---------------------------------------------------------------------

const MORPH_PT: Record<string, string> = {
  Verb: 'verbo', Noun: 'substantivo', Adjective: 'adjetivo', Adverb: 'advérbio', Conjunction: 'conjunção',
  Preposition: 'preposição', 'Definite article': 'artigo', 'Personal pronoun': 'pronome pessoal',
  Present: 'presente', Aorist: 'aoristo', Imperfect: 'imperfeito', Perfect: 'perfeito', Future: 'futuro',
  Pluperfect: 'mais-que-perfeito', Active: 'ativa', Passive: 'passiva', Middle: 'média',
  'Middle or Passive': 'média/passiva', 'Middle or Passive Deponent': 'média/passiva depoente',
  Deponent: 'depoente', Imperative: 'imperativo', Indicative: 'indicativo', Subjunctive: 'subjuntivo',
  Optative: 'optativo', Participle: 'particípio', Infinitive: 'infinitivo', Nominative: 'nominativo',
  Genitive: 'genitivo', Dative: 'dativo', Accusative: 'acusativo', Vocative: 'vocativo', Singular: 'singular',
  Plural: 'plural', Masculine: 'masculino', Feminine: 'feminino', Neuter: 'neutro', '1st': '1ª pessoa',
  '2nd': '2ª pessoa', '3rd': '3ª pessoa', Title: 'título', Negative: 'negativo',
};

function translateMorph(value: string): string {
  const v = value.trim();
  if (MORPH_PT[v]) return MORPH_PT[v]!;
  const nth = /^(1st|2nd|3rd)\s+(.+)$/.exec(v); // "2nd Aorist" -> "aoristo 2º"
  if (nth && MORPH_PT[nth[2]!]) return `${MORPH_PT[nth[2]!]} ${nth[1]![0]}º`;
  const multi = v.split(/\s+/).map((w) => MORPH_PT[w] ?? w.toLowerCase());
  return multi.join(' ');
}

/** Rótulos morfológicos em português para as pílulas do card (classe gramatical + tempo, voz, modo, caso...). */
export function morphLabelsPt(desc: string | null | undefined, withClass = false): string[] {
  if (!desc) return [];
  const [cls, ...rest] = desc.split(';').map((s) => s.trim());
  const out: string[] = [];
  if (withClass && cls) out.push(translateMorph(cls));
  for (const part of rest) {
    const eq = part.indexOf('=');
    if (eq < 0 || /^(Name type|Extra)/.test(part)) continue;
    out.push(translateMorph(part.slice(eq + 1)));
  }
  return out;
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

/** Palavra sem pontuação de borda. */
export function bareWord(surface: string): string {
  return surface.normalize('NFC').replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '');
}

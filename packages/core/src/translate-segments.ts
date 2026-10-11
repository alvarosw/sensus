// Segmentação de textos em inglês para tradução automática no aparelho.
// Divide o texto em trechos "translate" (prosa em inglês) e "keep" (grego e hebraico, números de Strong,
// referências bíblicas, URLs, marcas de seção, abreviações de léxico e quebras de parágrafo).
// Só os trechos "translate" vão ao tradutor; juntar os segmentos de novo reproduz o texto original
// (com as traduções nos lugares certos). Função pura: sem banco, rede nem dependências de runtime.

export interface TextSegment {
  /** "translate": prosa em inglês a traduzir. "keep": copiado sem alteração. */
  kind: 'translate' | 'keep';
  text: string;
}

const GREEK_HEBREW = String.raw`[\p{Script=Greek}\p{Script=Hebrew}\p{M}\u0387\u037E]`;

/** Livros da Bíblia (abreviações e nomes curtos, em inglês e pt-BR), com maiúscula inicial. */
const BOOK_ABBR = [
  'Gen', 'Gn', 'Ex', 'Exo', 'Exod', 'Êx', 'Lev', 'Lv', 'Num', 'Nm', 'Deut', 'Dt', 'Josh', 'Js', 'Jos', 'Judg', 'Jdg', 'Jz',
  'Ruth', 'Rt', 'Sam', 'Sm', 'Kgs', 'Rs', 'Chr', 'Cr', 'Ezra', 'Esd', 'Ed', 'Neh', 'Ne', 'Est', 'Esth', 'Et', 'Job', 'Jó',
  'Ps', 'Psa', 'Pss', 'Sl', 'Prov', 'Pr', 'Pv', 'Eccl', 'Ecc', 'Ec', 'Song', 'Ct', 'Cant', 'Isa', 'Is', 'Jer', 'Jr', 'Lam',
  'Lm', 'Ezek', 'Ez', 'Dan', 'Dn', 'Hos', 'Os', 'Joel', 'Jl', 'Amos', 'Am', 'Obad', 'Ob', 'Jon', 'Jnh', 'Mic', 'Mq', 'Nah',
  'Na', 'Hab', 'Hc', 'Zeph', 'Sf', 'Hag', 'Ag', 'Zech', 'Zc', 'Mal', 'Ml', 'Matt', 'Mat', 'Mt', 'Mark', 'Mrk', 'Mk', 'Mc',
  'Luke', 'Lk', 'Lc', 'John', 'Jhn', 'Jo', 'Jn', 'Acts', 'At', 'Rom', 'Rm', 'Cor', 'Co', 'Gal', 'Gl', 'Eph', 'Ef', 'Phil',
  'Php', 'Fp', 'Col', 'Cl', 'Thess', 'Th', 'Ts', 'Tim', 'Tm', 'Tit', 'Tt', 'Phlm', 'Phm', 'Fm', 'Heb', 'Hb', 'Jas', 'Tg',
  'Pet', 'Pe', 'Jude', 'Jd', 'Rev', 'Ap', 'Tob', 'Wis',
];

/** Nomes completos (sem número de capítulo obrigatório): só valem com capítulo, ex.: "Romans 8". */
const BOOK_NAMES = [
  'Genesis', 'Gênesis', 'Exodus', 'Êxodo', 'Leviticus', 'Levítico', 'Numbers', 'Números', 'Deuteronomy', 'Deuteronômio',
  'Joshua', 'Josué', 'Judges', 'Juízes', 'Ruth', 'Rute', 'Samuel', 'Kings', 'Reis', 'Chronicles', 'Crônicas', 'Ezra',
  'Esdras', 'Nehemiah', 'Neemias', 'Esther', 'Ester', 'Job', 'Jó', 'Psalm', 'Psalms', 'Salmos', 'Proverbs', 'Provérbios',
  'Ecclesiastes', 'Eclesiastes', 'Isaiah', 'Isaías', 'Jeremiah', 'Jeremias', 'Lamentations', 'Lamentações', 'Ezekiel',
  'Ezequiel', 'Daniel', 'Hosea', 'Oseias', 'Joel', 'Amos', 'Obadiah', 'Obadias', 'Jonah', 'Jonas', 'Micah', 'Miqueias',
  'Nahum', 'Naum', 'Habakkuk', 'Habacuque', 'Zephaniah', 'Sofonias', 'Haggai', 'Ageu', 'Zechariah', 'Zacarias',
  'Malachi', 'Malaquias', 'Matthew', 'Mateus', 'Mark', 'Marcos', 'Luke', 'Lucas', 'John', 'João', 'Acts', 'Atos',
  'Romans', 'Romanos', 'Corinthians', 'Coríntios', 'Galatians', 'Gálatas', 'Ephesians', 'Efésios', 'Philippians',
  'Filipenses', 'Colossians', 'Colossenses', 'Thessalonians', 'Tessalonicenses', 'Timothy', 'Timóteo', 'Titus', 'Tito',
  'Philemon', 'Filemom', 'Hebrews', 'Hebreus', 'James', 'Tiago', 'Peter', 'Pedro', 'Jude', 'Judas', 'Revelation',
  'Apocalipse',
];

/** Abreviações de léxico e dicionário que o tradutor tenderia a expandir ou alterar. */
const LEXICON_ABBR = [
  'cf', 'e\\.g', 'i\\.e', 'etc', 'viz', 'ibid', 'Ibid', 'sc', 'sch', 'ca', 'al', 'ff', 'fem', 'masc', 'neut', 'pl', 'sg',
  'lit', 'Gk', 'Heb', 'Lat', 'Hom', 'Il', 'Od', 'Pl', 'Arist', 'Xen', 'Thuc', 'Plut', 'Eur', 'Aesch', 'Soph', 'Herod',
  's\\.v', 'q\\.v',
];
/** Siglas sem ponto (corpus e léxico) que não devem ser traduzidas. */
const ACRONYMS = [
  'LXX', 'TH', 'NT', 'OT', 'MT', 'LSJ', 'BDAG', 'BDB', 'TDNT', 'TBESG', 'TFLSJ', 'AS', 'Thayer', 'Strong', 'KJV', 'AV', 'RV',
  'ASV', 'TR', 'Byz', 'NA27', 'NA28',
];

const BOOK_ALT = [...BOOK_ABBR, ...BOOK_NAMES]
  .sort((a, b) => b.length - a.length)
  .map((b) => b.replace(/\./g, '\\.'))
  .join('|');
const CHAPTER_VERSE = String.raw`\.?\s?\d{1,3}\s?[:.,]\s?\d{1,3}(?:\s?[-–]\s?\d{1,3})?`;

/**
 * Padrões protegidos, em ordem de prioridade (em empate de início, vale o primeiro).
 * Sem a flag `i`: livros e abreviações exigem maiúscula inicial, para não pegar "is 3:2" no meio de frases.
 */
const PROTECTED = new RegExp(
  [
    String.raw`https?:\/\/[^\s<>"()]+[^\s<>"().,;:!?]|www\.[^\s<>"()]+[^\s<>"().,;:!?]`,
    String.raw`${GREEK_HEBREW}+(?:[ \t\u00A0'’\-–]+${GREEK_HEBREW}+)*`,
    String.raw`§§?\s?\d[\d.,–-]*|\d[\d.,–-]*\s?§+|¶\s?\d[\d.,–-]*`,
    String.raw`(?<![\p{L}\p{N}])[GH]\d{1,5}(?![\p{L}\p{N}])`,
    String.raw`(?<![\p{L}\p{N}])(?:(?:[1-3]|I{1,3})\s?)?(?:${BOOK_ALT})${CHAPTER_VERSE}(?![\p{L}\p{N}])`,
    String.raw`(?<![\p{L}\p{N}])(?:[1-3]\s)?(?:${BOOK_NAMES.map((b) => b.replace(/\./g, '\\.')).join('|')})\s\d{1,3}(?:[:.,]\d{1,3}(?:[-–]\d{1,3})?)?(?![\p{L}\p{N}])`,
    String.raw`(?<![\p{L}])(?:${LEXICON_ABBR.join('|')})\.`,
    String.raw`(?<![\p{L}])(?:${ACRONYMS.join('|')})(?![\p{L}])`,
    // Sigla entre parênteses (ex.: a abreviação de Abbott-Smith "(AS)"): ALL-CAPS de 1 a 6 letras.
    String.raw`\(\p{Lu}{1,6}\)`,
  ].join('|'),
  'gu',
);

/** Trecho com ao menos uma palavra de duas letras latinas é prosa a traduzir. */
const HAS_ENGLISH_WORD = /[A-Za-z]{2,}/;

/** Quebra de parágrafo: linha em branco (com espaços opcionais). */
const PARAGRAPH_BREAK = /(\n[ \t]*\n\s*)/;

/** Adiciona um segmento, juntando com o anterior quando ambos são "keep". */
function push(out: TextSegment[], kind: TextSegment['kind'], text: string): void {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.kind === kind) {
    last.text += text;
    return;
  }
  out.push({ kind, text });
}

/** Pontuação e espaços nas bordas de um trecho (ex.: "(", ", ") ficam fora do que vai ao tradutor. */
const LEAD = /^[\s,;:!?.()[\]{}“”"‘’'—–-]*/u;
const TRAIL = /[\s,;:()[\]{}“”"‘’']*$/u;

/** Separa as bordas de um trecho de prosa (espaços e pontuação) do miolo, que vai ao tradutor. */
function pushProse(out: TextSegment[], run: string): void {
  const lead = LEAD.exec(run)?.[0] ?? '';
  const rest = run.slice(lead.length);
  const trail = TRAIL.exec(rest)?.[0] ?? '';
  const core = rest.slice(0, rest.length - trail.length);
  push(out, 'keep', lead);
  if (core) {
    if (HAS_ENGLISH_WORD.test(core)) {
      // quebras de linha dentro do trecho viram espaço (o tradutor trata uma linha só)
      push(out, 'translate', core.replace(/\s*\n\s*/g, ' '));
    } else {
      push(out, 'keep', core);
    }
  }
  push(out, 'keep', trail);
}

/** Segmenta um parágrafo (sem quebras de linha de parágrafo). */
function segmentParagraph(paragraph: string, out: TextSegment[]): void {
  let cursor = 0;
  PROTECTED.lastIndex = 0;
  for (const match of paragraph.matchAll(PROTECTED)) {
    const start = match.index ?? 0;
    const span = match[0];
    if (!span) continue;
    if (start > cursor) pushProse(out, paragraph.slice(cursor, start));
    push(out, 'keep', span);
    cursor = start + span.length;
  }
  if (cursor < paragraph.length) pushProse(out, paragraph.slice(cursor));
}

/**
 * Divide `text` em segmentos. Juntar `segments.map(s => s.text).join('')` reproduz `text` exatamente.
 * Parágrafos são separados por linha em branco e nunca são traduzidos juntos.
 */
export function segmentForTranslation(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  for (const part of text.split(PARAGRAPH_BREAK)) {
    if (!part) continue;
    // quebras de parágrafo (e partes só com espaços) são copiadas tal como estão
    if (part.trim() === '') {
      push(out, 'keep', part);
      continue;
    }
    segmentParagraph(part, out);
  }
  return out;
}

/** Trechos únicos a traduzir, na ordem de aparição (útil para lotes e cache). */
export function translatableRuns(segments: readonly TextSegment[]): string[] {
  const seen = new Set<string>();
  const runs: string[] = [];
  for (const s of segments) {
    if (s.kind !== 'translate' || seen.has(s.text)) continue;
    seen.add(s.text);
    runs.push(s.text);
  }
  return runs;
}

/**
 * Remonta o texto: cada trecho "translate" é trocado pelo resultado de `translated(trecho)`.
 * Se o tradutor não tiver resultado (undefined), o trecho original é mantido.
 */
export function assembleTranslation(
  segments: readonly TextSegment[],
  translated: (run: string) => string | undefined,
): string {
  return segments
    .map((s) => (s.kind === 'translate' ? (translated(s.text) ?? s.text) : s.text))
    .join('');
}

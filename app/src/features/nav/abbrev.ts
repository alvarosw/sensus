// Abreviações bíblicas em pt-BR. Índice = número canônico do livro - 1.
// Resolução (bookByAbbr): 1) forma exata com acentos ("Jó" é Jó, "Jo" é João);
// 2) forma sem acentos e sem espaços ("1co" é 1 Coríntios); 3) nome do livro via resolveBook do núcleo.
// Obs.: "Jn" é Jonas (pt-BR), não João; João é "Jo".
import { LAST_VERSE, normalizeKey, resolveBook, splitVid, type Book, type VerseRange } from '@sensus/core';

export const BOOK_ABBR_PT: readonly string[] = [
  'Gn', 'Êx', 'Lv', 'Nm', 'Dt', 'Js', 'Jz', 'Rt', '1Sm', '2Sm', '1Rs', '2Rs', '1Cr', '2Cr', 'Ed', 'Ne',
  'Et', 'Jó', 'Sl', 'Pv', 'Ec', 'Ct', 'Is', 'Jr', 'Lm', 'Ez', 'Dn', 'Os', 'Jl', 'Am', 'Ob', 'Jn',
  'Mq', 'Na', 'Hc', 'Sf', 'Ag', 'Zc', 'Ml', 'Mt', 'Mc', 'Lc', 'Jo', 'At', 'Rm', '1Co', '2Co', 'Gl',
  'Ef', 'Fp', 'Cl', '1Ts', '2Ts', '1Tm', '2Tm', 'Tt', 'Fm', 'Hb', 'Tg', '1Pe', '2Pe', '1Jo', '2Jo', '3Jo',
  'Jd', 'Ap',
];

const hasDiacritics = (s: string): boolean => s !== s.normalize('NFD').replace(/\p{M}/gu, '');

const EXACT = new Map<string, number>();
const LOOSE = new Map<string, number>();
BOOK_ABBR_PT.forEach((abbr, i) => {
  const num = i + 1;
  EXACT.set(abbr.toLowerCase().normalize('NFC'), num);
  const key = normalizeKey(abbr);
  // "Jó" e "Jo" colidem sem acento; a forma sem acento vence na busca aproximada.
  if (!LOOSE.has(key) || !hasDiacritics(abbr)) LOOSE.set(key, num);
});

/** Abreviação pt-BR de um livro pelo número. */
export function abbrOf(num: number): string {
  return BOOK_ABBR_PT[num - 1] ?? '';
}

/** Resolve abreviação ou nome (pt/en) para o livro. */
export function bookByAbbr(raw: string, books: readonly Book[]): Book | null {
  const clean = raw.trim().replace(/\.+$/, '').trim();
  if (!clean) return null;
  const num = EXACT.get(clean.toLowerCase().normalize('NFC')) ?? LOOSE.get(normalizeKey(clean));
  if (num !== undefined) return books.find((b) => b.num === num) ?? null;
  return resolveBook(clean, books);
}

/** Livros cujo nome ou abreviação começa com o texto digitado (sem acentos), do mais ao menos específico. */
export function suggestBooks(input: string, books: readonly Book[], limit = 8): Book[] {
  const key = normalizeKey(input);
  if (!key) return [];
  const typed = input.trim().toLowerCase().normalize('NFC');
  const scored: Array<[number, Book]> = [];
  for (const b of books) {
    const abbr = normalizeKey(abbrOf(b.num));
    const names = [normalizeKey(b.name_pt), normalizeKey(b.name_en)];
    // Ranking (menor é melhor; -1 = fora da lista). Abreviação digitada com os mesmos acentos
    // ("Jo" = João) vem antes da equivalente sem acento ("Jó").
    let score = -1;
    if (abbrOf(b.num).toLowerCase().normalize('NFC') === typed) score = 0;
    else if (abbr === key) score = 1;
    else if (abbr.startsWith(key)) score = 2;
    else if (names.some((n) => n.startsWith(key))) score = 3;
    else if (key.length >= 3 && names.some((n) => n.includes(key))) score = 4;
    if (score >= 0) scored.push([score, b]);
  }
  scored.sort((x, y) => x[0] - y[0] || x[1].num - y[1].num);
  return scored.slice(0, limit).map(([, b]) => b);
}

/** Forma curta para rótulos e botões: "Fp 2:5–8", "Fp 2:5", "Fp 2", "Fp 2:5–3:1". */
export function shortRef(range: VerseRange): string {
  const s = splitVid(range.start);
  const e = splitVid(range.end);
  const abbr = abbrOf(s.book);
  const startVerse = Math.max(s.verse, 1);
  if (s.chapter === e.chapter) {
    if (startVerse === 1 && e.verse >= LAST_VERSE) return `${abbr} ${s.chapter}`;
    if (startVerse === e.verse) return `${abbr} ${s.chapter}:${startVerse}`;
    return `${abbr} ${s.chapter}:${startVerse}–${e.verse}`;
  }
  const endPart = e.verse >= LAST_VERSE ? `${e.chapter}` : `${e.chapter}:${e.verse}`;
  return `${abbr} ${s.chapter}:${startVerse}–${endPart}`;
}

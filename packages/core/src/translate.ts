// Links para traduzir texto no Google Tradutor (sem API: o usuário abre o link no navegador).

/** Teto de tamanho da URL completa, com folga abaixo de limites comuns de navegadores. */
export const GOOGLE_TRANSLATE_MAX_URL = 5000;

interface Piece {
  text: string;
  /** Separador a usar antes desta peça quando ela segue a anterior no mesmo trecho. */
  sep: string;
}

/** Quebra um parágrafo por palavras (e por caracteres, se uma palavra for maior que o limite). */
function splitParagraph(paragraph: string, fits: (s: string) => boolean): string[] {
  if (fits(paragraph)) return [paragraph];
  const out: string[] = [];
  let cur = '';
  for (const word of paragraph.split(/\s+/).filter(Boolean)) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (fits(candidate)) {
      cur = candidate;
      continue;
    }
    if (cur) out.push(cur);
    if (fits(word)) {
      cur = word;
      continue;
    }
    let piece = '';
    for (const ch of word) {
      if (fits(piece + ch)) {
        piece += ch;
      } else {
        out.push(piece);
        piece = ch;
      }
    }
    cur = piece;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Gera uma ou mais URLs do Google Tradutor para `text`, quebrando por parágrafos ("\n\n")
 * e, se preciso, por palavras, de modo que cada URL fique abaixo de GOOGLE_TRANSLATE_MAX_URL.
 */
export function googleTranslateLinks(text: string, targetLang: string, sourceLang = 'auto'): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return [];

  const build = (chunk: string): string =>
    `https://translate.google.com/?sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&text=${encodeURIComponent(chunk)}&op=translate`;
  const fits = (chunk: string): boolean => build(chunk).length <= GOOGLE_TRANSLATE_MAX_URL;

  const pieces: Piece[] = [];
  for (const paragraph of paragraphs) {
    splitParagraph(paragraph, fits).forEach((part, i) => {
      pieces.push({ text: part, sep: i === 0 ? '\n\n' : ' ' });
    });
  }

  const chunks: string[] = [];
  let current: string | null = null;
  for (const piece of pieces) {
    if (current === null) {
      current = piece.text;
      continue;
    }
    const candidate: string = current + piece.sep + piece.text;
    if (fits(candidate)) {
      current = candidate;
    } else {
      chunks.push(current);
      current = piece.text;
    }
  }
  if (current !== null) chunks.push(current);

  return chunks.map(build);
}

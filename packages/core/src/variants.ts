// Variantes textuais por posição: alinha as leituras TR/BYZ e NA/SBL/WH de cada versículo.
import type { Token } from './types';
import { formatVerse } from './refs';
import { hasEdition } from './panel';

export interface VariantSite {
  vid: number;
  /** Referência em pt-BR do versículo, ex.: "Filipenses 2:5". */
  ref: string;
  /** Palavras da leitura TR/BYZ neste ponto (vazio = omitida no TR/BYZ). */
  trReading: Token[];
  /** Palavras da leitura NA/SBL/WH neste ponto (vazio = omitida no NA). */
  naReading: Token[];
}

/** Forma comparável: sem acentos e sem pontuação, minúscula. */
function key(surface: string): string {
  return surface.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/** Alinhamento LCS entre duas sequências de palavras; devolve pares (índice em A, índice em B) iguais. */
function alignPairs(a: readonly Token[], b: readonly Token[]): Array<[number, number]> {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] =
        key(a[i]!.surface) === key(b[j]!.surface)
          ? dp[i + 1]![j + 1]! + 1
          : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (key(a[i]!.surface) === key(b[j]!.surface)) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}

/**
 * Sítios de variação do NT grego (corpus gnt). Um sítio é um trecho entre palavras comuns às duas
 * leituras em que TR/BYZ e NA/SBL/WH diferem. Versículos sem diferença não geram sítios.
 */
export function variantSites(tokens: readonly Token[]): VariantSite[] {
  const sorted = tokens.filter((t) => t.corpus === 'gnt').sort((x, y) => x.vid - y.vid || x.pos - y.pos);
  const byVid = new Map<number, Token[]>();
  for (const t of sorted) {
    const list = byVid.get(t.vid) ?? [];
    list.push(t);
    byVid.set(t.vid, list);
  }

  const sites: VariantSite[] = [];
  for (const [vid, group] of byVid) {
    // Leitura TR (rotulada TR/BYZ no texto): palavras presentes no TR. Palavras só de BYZ/NA entram
    // na leitura NA quando faltam no TR.
    const tr = group.filter((t) => hasEdition(t, 'TR'));
    const na = group.filter((t) => hasEdition(t, 'NA'));
    const pairs = alignPairs(tr, na);
    let prevTr = 0;
    let prevNa = 0;
    for (const [pi, pj] of [...pairs, [tr.length, na.length] as [number, number]]) {
      const trGap = tr.slice(prevTr, pi);
      const naGap = na.slice(prevNa, pj);
      if (trGap.length > 0 || naGap.length > 0) {
        sites.push({ vid, ref: formatVerse(vid), trReading: trGap, naReading: naGap });
      }
      prevTr = pi + 1;
      prevNa = pj + 1;
    }
  }
  return sites;
}

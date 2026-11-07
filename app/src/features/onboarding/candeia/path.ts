// Geometria da leitura à luz da candeia, a partir do layout real das linhas do versículo (onTextLayout no
// aparelho, retângulos do DOM na web): os trechos que guardam brilho depois que a luz passa e o caminho que a
// candeia faz sozinha por cima das linhas. Tudo em coordenadas do parágrafo (origem no canto do texto).

/** Uma linha do parágrafo, como o layout de texto devolve. */
export interface TextLine {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

/** Trecho de uma linha (uma palavra, ou alguns caracteres em escrita sem espaços). */
export interface Segment {
  line: number;
  x0: number;
  x1: number;
  cx: number;
  cy: number;
}

/** Ponto do caminho automático: centro da luz no instante `t` (segundos). */
export interface PathPoint {
  x: number;
  y: number;
  t: number;
}

/** Caracteres por trecho quando a linha não tem espaços (chinês, japonês). */
const CHUNK = 3;
/** Folga horizontal nas pontas da linha (acentos e itálicos que passam da caixa). */
const EDGE = 6;

/** Linhas com texto visível, em ordem de cima para baixo. */
export function visibleLines(lines: readonly TextLine[]): TextLine[] {
  return lines.filter((l) => l.text.trim().length > 0 && l.width > 0).slice().sort((a, b) => a.y - b.y);
}

/**
 * Largura relativa de um caractere, para estimar onde cada palavra cai na linha (o layout nativo só dá a linha
 * inteira). Aproximação de uma serifada: letras estreitas, largas, maiúsculas e ideogramas de largura cheia.
 */
export function charWeight(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  if (code >= 0x2e80) return 1.9; // CJK e pontuação de largura cheia
  if (/\s/.test(ch)) return 0.5;
  if (/[.,;:!'’|ijlI]/.test(ch)) return 0.45;
  if (/[ftr()\-]/.test(ch)) return 0.62;
  if (/[mwMW]/.test(ch)) return 1.5;
  if (/[A-Z]/.test(ch)) return 1.25;
  return 1;
}

/** Trechos de uma linha já sem espaços nas pontas: [início, fim) em caracteres de cada palavra. */
function chunks(chars: readonly string[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let start = -1;
  for (let i = 0; i <= chars.length; i++) {
    const space = i === chars.length || /\s/.test(chars[i]!);
    if (!space && start < 0) start = i;
    if (space && start >= 0) {
      out.push([start, i]);
      start = -1;
    }
  }
  // Escrita sem espaços: corta em pedaços de poucos caracteres, para a luz revelar aos poucos.
  if (out.length === 1 && chars.length > CHUNK * 2) {
    out.length = 0;
    for (let i = 0; i < chars.length; i += CHUNK) out.push([i, Math.min(chars.length, i + CHUNK)]);
    const last = out[out.length - 1]!;
    if (last[1] - last[0] < 2 && out.length > 1) {
      out.pop();
      out[out.length - 1]![1] = chars.length;
    }
  }
  return out;
}

/**
 * Divide as linhas em trechos que cobrem a linha inteira, sem buracos: a fronteira entre duas palavras fica no
 * meio do espaço entre elas (onde um erro pequeno da estimativa não corta letra). A posição de cada palavra é
 * estimada pela largura relativa dos caracteres (charWeight); em rtl a linha começa pela direita.
 */
export function segmentLines(lines: readonly TextLine[], rtl = false): Segment[] {
  const out: Segment[] = [];
  visibleLines(lines).forEach((line, li) => {
    const chars = Array.from(line.text.trim());
    if (chars.length === 0) return;
    const cum = [0];
    for (const ch of chars) cum.push(cum[cum.length - 1]! + charWeight(ch));
    const total = cum[chars.length]!;
    const at = (i: number) => cum[i]! / total; // fração da linha antes do caractere i
    const parts = chunks(chars);
    const cy = line.y + line.height / 2;
    parts.forEach(([s, e], i) => {
      const prev = parts[i - 1];
      const next = parts[i + 1];
      let f0 = prev ? (at(prev[1]) + at(s)) / 2 : 0;
      let f1 = next ? (at(e) + at(next[0])) / 2 : 1;
      if (!prev) f0 -= EDGE / line.width;
      if (!next) f1 += EDGE / line.width;
      const x0 = rtl ? line.x + line.width * (1 - f1) : line.x + line.width * f0;
      const x1 = rtl ? line.x + line.width * (1 - f0) : line.x + line.width * f1;
      out.push({ line: li, x0, x1, cx: (x0 + x1) / 2, cy });
    });
  });
  return out;
}

/**
 * A luz em (lx, ly) já alcançou o trecho? A elipse da luz (rx, ry) precisa chegar a um quarto da largura da
 * palavra, para a palavra acender quando a luz de fato está sobre ela.
 */
export function litBy(seg: Segment, lx: number, ly: number, rx: number, ry: number): boolean {
  'worklet';
  const half = (seg.x1 - seg.x0) / 2;
  const dx = Math.max(0, Math.abs(lx - seg.cx) - half * 0.5) / rx;
  const dy = (ly - seg.cy) / ry;
  return dx * dx + dy * dy <= 1;
}

export interface PathOptions {
  rtl?: boolean;
  /** Velocidade de leitura sobre a linha (px/s). */
  readSpeed?: number;
  /** Velocidade média da volta ao começo da próxima linha (px/s). */
  returnSpeed?: number;
  /** Pausa no fim de cada linha (s). */
  dwell?: number;
  /** Quanto a luz começa antes e termina depois da linha (px). */
  lead?: number;
  /** Amostras por segundo do caminho. */
  rate?: number;
}

/** Suave nas pontas, quase linear no meio: a leitura não "patina" na largada nem freia de estalo. */
function readEase(u: number, first: boolean, last: boolean): number {
  const s = u * u * (3 - 2 * u);
  const w0 = first ? 0.5 : 0.18;
  const w1 = last ? 0.5 : 0.3;
  // mistura: começa com peso w0 da curva suave e termina com w1
  const w = w0 + (w1 - w0) * u;
  return u * (1 - w) + s * w;
}

function smoother(u: number): number {
  return u * u * u * (u * (u * 6 - 15) + 10);
}

/**
 * Caminho automático do centro da luz: lê cada linha no sentido da escrita (com uma ondulação leve, de mão) e
 * volta ao começo da próxima por cima da linha já lida, descendo só no fim, para não acender a linha de baixo
 * fora de ordem.
 */
export function planPath(lines: readonly TextLine[], opts: PathOptions = {}): PathPoint[] {
  const { rtl = false, readSpeed = 118, returnSpeed = 330, dwell = 0.18, lead = 10, rate = 60 } = opts;
  const ls = visibleLines(lines);
  const pts: PathPoint[] = [];
  let t = 0;
  const push = (x: number, y: number) => pts.push({ x, y, t });
  const dir = rtl ? -1 : 1;
  const startOf = (l: TextLine) => (rtl ? l.x + l.width + lead : l.x - lead);
  const endOf = (l: TextLine) => (rtl ? l.x - lead : l.x + l.width + lead);

  ls.forEach((line, i) => {
    const cy = line.y + line.height / 2;
    const x0 = startOf(line);
    const x1 = endOf(line);
    const len = Math.abs(x1 - x0);
    const dur = Math.max(0.6, len / readSpeed);
    const n = Math.max(2, Math.ceil(dur * rate));
    const phase = i * 1.7;
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const u = k / n;
      const e = readEase(u, i === 0, i === ls.length - 1);
      const x = x0 + (x1 - x0) * e;
      // ondulação de mão: alguns px, com comprimento de onda de uma palavra longa
      const wobble = Math.sin((Math.abs(x - x0) / 150) * Math.PI * 2 + phase) * 2.4 * Math.sin(Math.PI * u);
      if (k > 0) t += dur / n;
      push(x, cy + wobble);
    }
    const next = ls[i + 1];
    if (!next) return;
    t += dwell;
    push(x1, cy);
    // Volta: curva que fica sobre a linha lida e só desce perto do começo da seguinte.
    const ny = next.y + next.height / 2;
    const nx = startOf(next);
    const cx = nx + dir * 48;
    const cyCtl = cy - 8;
    const approx = Math.abs(x1 - nx) + Math.abs(ny - cy);
    const rdur = Math.max(0.5, approx / returnSpeed);
    const rn = Math.max(2, Math.ceil(rdur * rate));
    for (let k = 1; k <= rn; k++) {
      const u = smoother(k / rn);
      const a = (1 - u) * (1 - u);
      const b = 2 * (1 - u) * u;
      const c = u * u;
      t += rdur / rn;
      push(a * x1 + b * cx + c * nx, a * cy + b * cyCtl + c * ny);
    }
  });
  return pts;
}

/** Duração do caminho (s). */
export function pathDuration(path: readonly PathPoint[]): number {
  return path.length ? path[path.length - 1]!.t : 0;
}

/** Posição no caminho no instante t (fora do intervalo, fica na ponta mais próxima). */
export function samplePath(path: readonly PathPoint[], t: number): { x: number; y: number } {
  'worklet';
  const n = path.length;
  if (n === 0) return { x: 0, y: 0 };
  if (t <= path[0]!.t) return { x: path[0]!.x, y: path[0]!.y };
  const last = path[n - 1]!;
  if (t >= last.t) return { x: last.x, y: last.y };
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid]!.t <= t) lo = mid;
    else hi = mid;
  }
  const a = path[lo]!;
  const b = path[hi]!;
  const span = b.t - a.t;
  const u = span > 0 ? (t - a.t) / span : 0;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

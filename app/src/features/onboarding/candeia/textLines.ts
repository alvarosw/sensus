// Linhas do versículo como o layout de texto as quebrou. No aparelho vêm de onTextLayout; na web (onde o
// react-native-web não emite onTextLayout) saem dos retângulos de cada caractere no DOM.
import type { TextLayoutLine } from 'react-native';
import type { TextLine } from './path';

export function linesFromNative(lines: readonly TextLayoutLine[]): TextLine[] {
  return lines.map((l) => ({ x: l.x, y: l.y, width: l.width, height: l.height, text: l.text }));
}

/** Mede as linhas de um elemento de texto do DOM, relativas ao próprio elemento. */
export function linesFromDom(node: unknown): TextLine[] {
  if (typeof document === 'undefined' || !(node instanceof HTMLElement)) return [];
  const box = node.getBoundingClientRect();
  const lineHeight = parseFloat(getComputedStyle(node).lineHeight) || 0;
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const rows: { top: number; left: number; right: number; text: string }[] = [];
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const s = t.textContent ?? '';
    // Por ponto de código (não por unidade UTF-16), para não partir caracteres fora do plano básico.
    let i = 0;
    for (const ch of s) {
      range.setStart(t, i);
      range.setEnd(t, i + ch.length);
      i += ch.length;
      const r = range.getClientRects()[0];
      if (!r) continue;
      const top = r.top - box.top;
      const row = rows.find((w) => Math.abs(w.top - top) < Math.max(4, r.height / 2));
      const visible = /\S/.test(ch);
      if (row) {
        row.text += ch;
        if (visible) {
          row.left = Math.min(row.left, r.left - box.left);
          row.right = Math.max(row.right, r.right - box.left);
        }
      } else {
        rows.push({
          top,
          left: visible ? r.left - box.left : Infinity,
          right: visible ? r.right - box.left : -Infinity,
          text: ch,
        });
      }
    }
  }
  // Parágrafo de um estilo só: cada linha ocupa uma altura de linha inteira (o retângulo do caractere é só a
  // caixa da fonte, menor que a linha).
  const sorted = rows.filter((r) => r.right > r.left).sort((a, b) => a.top - b.top);
  const step = lineHeight || (sorted.length > 1 ? sorted[1]!.top - sorted[0]!.top : box.height);
  return sorted.map((r, i) => ({ x: r.left, y: i * step, width: r.right - r.left, height: step, text: r.text }));
}

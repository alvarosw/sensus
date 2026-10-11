// Texto simples de uma resposta estruturada: usado na visão "Selecionar texto" (seleção nativa no Android).
import type { Block, Inline } from '@sensus/core';

function inlineText(xs: Inline[]): string {
  return xs.map((x) => (x.type === 'cite' ? x.refs.map((r) => `(${r.label})`).join(' ') : x.text)).join('');
}

export function plainAnswer(blocks: Block[]): string {
  return blocks
    .map((b) =>
      b.type === 'list'
        ? b.items.map((it, i) => `${b.ordered ? `${i + 1}.` : '•'} ${inlineText(it.inlines)}`).join('\n')
        : inlineText(b.inlines),
    )
    .filter((s) => s.trim().length > 0)
    .join('\n\n');
}

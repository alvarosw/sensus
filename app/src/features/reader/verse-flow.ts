// Monta o fluxo de leitura de um capítulo: parágrafos e títulos de seção a partir de text_division.
import type { TextDivision, VerseText } from '@sensus/core';

export type FlowBlock =
  | { kind: 'heading'; key: string; title: string }
  | { kind: 'paragraph'; key: string; verses: VerseText[] };

/**
 * Versículos em fluxo contínuo. Um novo parágrafo começa no primeiro versículo, em cada divisão
 * `paragraph` e antes de cada `heading` (que vira bloco próprio). Divisões sem versículo correspondente
 * entram antes do próximo versículo.
 */
export function buildFlow(verses: readonly VerseText[], divisions: readonly TextDivision[]): FlowBlock[] {
  const breaks = divisions
    .filter((d) => d.kind === 'paragraph')
    .map((d) => d.vid)
    .sort((a, b) => a - b);
  const heads = divisions
    .filter((d): d is TextDivision & { title: string } => d.kind === 'heading' && !!d.title)
    .sort((a, b) => a.vid - b.vid);

  const blocks: FlowBlock[] = [];
  let current: VerseText[] | null = null;
  let bi = 0;
  let hi = 0;

  const flush = (): void => {
    if (current && current.length > 0) {
      blocks.push({ kind: 'paragraph', key: `p${current[0]?.vid}`, verses: current });
    }
    current = null;
  };

  for (const v of verses) {
    while (hi < heads.length && (heads[hi]?.vid ?? Infinity) <= v.vid) {
      const head = heads[hi];
      flush();
      if (head) blocks.push({ kind: 'heading', key: `h${head.vid}`, title: head.title });
      hi++;
    }
    let breakHere = current === null;
    while (bi < breaks.length && (breaks[bi] ?? Infinity) <= v.vid) {
      breakHere = true;
      bi++;
    }
    if (breakHere) flush();
    if (current === null) current = [];
    current.push(v);
  }
  flush();
  return blocks;
}

/** Fração (0..1) do texto de um parágrafo que vem antes do versículo alvo; usada para rolar até ele. */
export function verseFraction(block: FlowBlock, vid: number): number {
  if (block.kind !== 'paragraph') return 0;
  let before = 0;
  let total = 0;
  for (const v of block.verses) {
    const len = v.text.length + 4;
    if (v.vid < vid) before += len;
    total += len;
  }
  return total > 0 ? before / total : 0;
}

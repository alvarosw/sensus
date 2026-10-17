// Modelo puro da prévia ("espiar") da folha: fatos da seleção e escopo da perícope. Sem React e sem banco.
// Os fatos valem nos dois testamentos: a palavra rara e o hápax vêm de keyWordsOf (domínio: língua e testamento).
import {
  chapterStartVid,
  commentatorOf,
  isIntroCommentary,
  isIntroVid,
  splitVid,
  variantSites,
  type PanelData,
  type Vid,
} from '@sensus/core';
import { keyWordsOf, type KeyWord } from './format';

/** Um intervalo de versículos (início e fim inclusive). */
export interface Span {
  start: Vid;
  end: Vid;
}

export interface PeekFacts {
  /** Comentaristas distintos, sem contar as introduções. */
  authors: number;
  /** Versículos com variante entre as edições-base do NT. */
  variants: number;
  /** Referências cruzadas do trecho. */
  xrefs: number;
  /** Palavra em destaque: o hápax da seleção, ou a palavra mais rara. Ausente se não há palavra-chave. */
  word: KeyWord | undefined;
  /** A palavra escolhida é hápax (ocorre uma só vez no testamento). */
  hapax: boolean;
}

/** Fatos da prévia, calculados do painel da seleção. */
export function peekFacts(panel: PanelData): PeekFacts {
  const coms = panel.layers.interpretation.commentaries.filter((c) => !isIntroCommentary(c));
  const authors = new Set(coms.map((c) => commentatorOf(panel.sources[c.source_id], c)));
  const sites = variantSites(panel.layers.text.original);
  const words = keyWordsOf(panel);
  const hapax = words.find((w) => w.count === 1);
  const top = hapax ?? words[0];
  return {
    authors: authors.size,
    variants: sites.length,
    xrefs: panel.layers.intertext.xrefs.length,
    word: top,
    hapax: !!hapax,
  };
}

/** Início da perícope para exibição: a introdução do livro (x:0) não tem versículos, então começa no 1:1. */
export function unitStartOf(v: Vid): Vid {
  if (!isIntroVid(v)) return v;
  const p = splitVid(v);
  // Introdução do livro (capítulo 0) começa em 1:1, como a do capítulo começa em ch:1.
  return chapterStartVid(p.book, Math.max(1, p.chapter));
}

/**
 * Escopo da perícope na prévia: onde ela começa e se a seleção já cobre a perícope inteira (então o botão de
 * ampliar não aparece).
 */
export function peekScope(range: Span, unit: Span | null): { unitStart: Vid | null; whole: boolean } {
  const unitStart = unit ? unitStartOf(unit.start) : null;
  const whole = unit !== null && unitStart === range.start && unit.end === range.end;
  return { unitStart, whole };
}

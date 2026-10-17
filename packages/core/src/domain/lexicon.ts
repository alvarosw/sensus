// Léxico por língua: qual fonte usar e qual verbete escolher para uma forma.
// Regra única (referência para painel, estudo e IA): primeiro o verbete com a chave exata (sufixo incluído,
// ex.: H0935P); senão o primeiro verbete da mesma base na fonte principal; nunca verbete de outra língua.
import type { LexiconEntry } from '../types';
import type { Lang } from './language';
import { parseStrong, type Strong, type StrongBase } from './strong';

export interface LexiconSpec {
  /** Fonte principal (id em source). */
  primary: string;
  /** Fonte complementar (só o grego tem: LSJ). */
  secondary?: string;
  /** Rótulo curto para a interface (ex.: "TBESG"). */
  label: string;
}

export const LEXICONS: Record<Lang, LexiconSpec> = {
  grc: { primary: 'stepbible-tbesg', secondary: 'stepbible-tflsj', label: 'TBESG' },
  hbo: { primary: 'stepbible-tbesh', label: 'TBESH' },
  arc: { primary: 'stepbible-tbesh', label: 'TBESH' },
};

export interface LexiconPick {
  primary: LexiconEntry | null;
  secondary: LexiconEntry | null;
}

/** Léxicos longos (LSJ): entram só truncados e só para palavras de conteúdo. */
const LONG_LEXICON_SOURCES: ReadonlySet<string> = new Set(['stepbible-tflsj']);

export function isLongLexiconSource(sourceId: string): boolean {
  return LONG_LEXICON_SOURCES.has(sourceId);
}

/** Prefixo de Strong de cada língua (grego G; hebraico e aramaico H). */
const STRONG_PREFIX: Record<Lang, 'G' | 'H'> = { grc: 'G', hbo: 'H', arc: 'H' };

/** Verbete da fonte que pertence à língua (pela chave: o campo lang do verbete é o idioma da glosa, em inglês). */
function ofLang(e: LexiconEntry, lang: Lang): boolean {
  return e.key.startsWith(STRONG_PREFIX[lang]);
}

function pickFrom(
  entries: readonly LexiconEntry[],
  source: string,
  lang: Lang,
  strong: Strong | null,
): LexiconEntry | null {
  const list = entries.filter((e) => e.source_id === source && ofLang(e, lang));
  if (!strong) return list[0] ?? null;
  return list.find((e) => e.key === strong.raw) ?? list.find((e) => e.strong_base === strong.base) ?? null;
}

/**
 * Escolhe os verbetes de uma forma. `strong` pode vir como texto ("H0935P") ou já lido. Um Strong de outra língua
 * (ex.: G com lang "hbo") não devolve nada, para não mostrar verbete errado.
 */
export function pickLexicon(
  entries: readonly LexiconEntry[],
  strong: string | Strong | null,
  lang: Lang,
): LexiconPick {
  const s = typeof strong === 'string' ? parseStrong(strong) : strong;
  if (strong !== null && s === null) return { primary: null, secondary: null };
  if (s && s.prefix !== STRONG_PREFIX[lang]) return { primary: null, secondary: null };
  const spec = LEXICONS[lang];
  return {
    primary: pickFrom(entries, spec.primary, lang, s),
    secondary: spec.secondary ? pickFrom(entries, spec.secondary, lang, s) : null,
  };
}

/**
 * Verbete por base (sem sufixo) para uma lista de verbetes: a fonte principal tem precedência sobre a
 * complementar, e só entram verbetes da língua. Usado para rótulos de concordância, não para o verbete exato.
 */
export function lexiconByBase(entries: readonly LexiconEntry[], lang: Lang): Map<StrongBase, LexiconEntry> {
  const spec = LEXICONS[lang];
  const out = new Map<StrongBase, LexiconEntry>();
  for (const source of [spec.primary, spec.secondary]) {
    if (!source) continue;
    for (const e of entries) {
      if (e.source_id !== source || !e.strong_base || !ofLang(e, lang)) continue;
      const base = e.strong_base as StrongBase;
      if (!out.has(base)) out.set(base, e);
    }
  }
  return out;
}

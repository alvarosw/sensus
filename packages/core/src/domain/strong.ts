// Números de Strong: base, prefixo, número e sufixo estendido (H0935P -> base H0935, sufixo P).
// Mesma regra de pipeline/sensus/strong.py: 1 a 5 dígitos; base = prefixo + número com zeros até 4 dígitos
// (G430 -> G0430; G20001 -> G20001); sufixo de letras, mantido como na fonte, nunca entra na base.
import type { Testament } from './language';

/** Base de Strong sem sufixo, com 4 dígitos (ex.: "H0935"). Tipo marcado: só se obtém por parseStrong. */
export type StrongBase = string & { readonly __brand: 'StrongBase' };

export interface Strong {
  /** Forma canônica, com sufixo se houver (ex.: "H0935P"); chave de comparação com lexicon_entry.key. */
  raw: string;
  /** Base sem sufixo (ex.: "H0935"). */
  base: StrongBase;
  /** G = grego (NT); H = hebraico ou aramaico (o Strong não separa os dois). */
  prefix: 'G' | 'H';
  number: number;
  /** Sufixo estendido (letras), vazio se não houver. */
  suffix: string;
}

const STRONG_RE = /^([GH])(\d{1,5})([A-Za-z]*)$/;

/**
 * Lê um Strong como o pipeline (strong.py): aceita sem zeros à esquerda e normaliza a base para 4 dígitos,
 * mas mantém 5 dígitos quando existem. Devolve null para o que não é Strong.
 */
export function parseStrong(text: string): Strong | null {
  const m = STRONG_RE.exec(text);
  if (!m) return null;
  const prefix = m[1] as 'G' | 'H';
  const number = Number(m[2]);
  const suffix = m[3] ?? '';
  const digits = String(number).padStart(4, '0');
  return {
    raw: `${prefix}${digits}${suffix}`,
    base: `${prefix}${digits}` as StrongBase,
    prefix,
    number,
    suffix,
  };
}

/** Base do Strong ("H0935P" -> "H0935"); null se não for Strong. */
export function strongBaseOf(text: string): StrongBase | null {
  return parseStrong(text)?.base ?? null;
}

function asStrong(strong: string | Strong): Strong | null {
  return typeof strong === 'string' ? parseStrong(strong) : strong;
}

/** Testamento pelo prefixo: G é do NT, H é do AT. Null se não for Strong. */
export function testamentOfStrong(strong: string | Strong): Testament | null {
  const s = asStrong(strong);
  if (!s) return null;
  return s.prefix === 'G' ? 'NT' : 'OT';
}

/**
 * Língua pelo prefixo: G -> grc, H -> hbo. O aramaico não se distingue pelo Strong (ele também começa com H);
 * para isso use langOfToken, que lê a morfologia. Null se não for Strong.
 */
export function langOfStrong(strong: string | Strong): 'grc' | 'hbo' | null {
  const s = asStrong(strong);
  if (!s) return null;
  return s.prefix === 'G' ? 'grc' : 'hbo';
}

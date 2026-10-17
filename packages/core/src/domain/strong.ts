// Números de Strong: base, prefixo, número e sufixo estendido (H0935P -> base H0935, sufixo P).
// Mesma regra do pipeline (tagnt.py e tahot.py: strong_base = primeiros 5 caracteres, 'G'|'H' + 4 dígitos).
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

const STRONG_RE = /^([GH])(\d{1,4})([A-Z]*)$/;

/**
 * Lê um Strong. Aceita sem zeros à esquerda ("h935p") e normaliza para 4 dígitos.
 * Devolve null para o que não é Strong (vazio, número zero, prefixo diferente de G/H).
 */
export function parseStrong(text: string): Strong | null {
  const m = STRONG_RE.exec(text.trim().toUpperCase());
  if (!m) return null;
  const prefix = m[1] as 'G' | 'H';
  const number = Number(m[2]);
  if (number < 1) return null;
  const digits = String(number).padStart(4, '0');
  const suffix = m[3] ?? '';
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

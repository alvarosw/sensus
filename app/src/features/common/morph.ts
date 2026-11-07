// Morfologia a partir de token.morph_desc ("Verb; Tense=Present; Voice=Active; ...").
// O TAGNT descreve em inglês; os termos gramaticais saem do idioma do app (MORPH, morph-strings.ts).
// O hebraico (TAHOT) tem outro formato e outro mapa, em morph-hb.ts; morphChipsOf junta os dois para os cards.
import type { Testament } from '@sensus/core';
import { hebrewMorphPt } from './morph-hb';
import { MORPH } from './morph-strings';

/** Traduz cada termo ("Masculine + Noun" → "masculino + substantivo"); desconhecidos ficam como estão. */
export function morphTerm(raw: string): string {
  return raw
    .split(' + ')
    .map((part) => termPt(part.trim()))
    .join(' + ');
}

function termPt(v: string): string {
  const atoms: Record<string, string> = MORPH.atoms;
  if (Object.hasOwn(atoms, v)) return atoms[v]!;
  const nth = /^(1st|2nd|3rd)\s+(.+)$/.exec(v); // "2nd Imperfect" -> "imperfeito 2º"
  if (nth && Object.hasOwn(atoms, nth[2]!)) {
    return MORPH.ordinal.replace('{0}', atoms[nth[2]!]!).replace('{1}', nth[1]![0]!);
  }
  return v;
}

/**
 * Rótulos das pílulas do card (classe gramatical opcional, depois tempo, voz, modo, caso...). Mesmo dicionário e mesma
 * função que o painel: um termo sai com o mesmo rótulo nos dois lugares.
 */
export function morphLabelsPt(desc: string | null | undefined, withClass = false): string[] {
  if (!desc) return [];
  const [cls, ...rest] = desc.split(';').map((s) => s.trim());
  const out: string[] = [];
  if (withClass && cls) out.push(capitalize(morphTerm(cls)));
  for (const part of rest) {
    const eq = part.indexOf('=');
    if (eq < 0 || /^(Name type|Extra)/.test(part)) continue;
    out.push(morphTerm(part.slice(eq + 1)));
  }
  return out;
}

/**
 * Etiquetas de morfologia dos cards: a classe primeiro (NT e AT), depois os termos. No NT (grego), o mesmo rótulo de
 * morphParts; no AT (hebraico e aramaico), o mesmo mapa do painel (hebrewMorphPt), partido em termos. Se algum termo
 * do TAHOT ficar fora do mapa, a descrição original vai como uma etiqueta só.
 */
export function morphChipsOf(desc: string | null | undefined, testament: Testament): string[] {
  if (testament === 'NT') return morphLabelsPt(desc, true);
  if (!desc || !desc.trim()) return [];
  const hb = hebrewMorphPt(desc);
  return hb.complete ? topLevelTerms(hb.text) : [desc.trim()];
}

/** Parte um texto em termos nas vírgulas e nos " + " que estão fora de parênteses ("Verbo Qal (simples, ativa), perfeito"). */
function topLevelTerms(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (depth === 0 && ch === ',') {
      out.push(cur.trim());
      cur = '';
    } else if (depth === 0 && text.startsWith(' + ', i)) {
      out.push(cur.trim());
      cur = '';
      i += 2;
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out.filter(Boolean);
}

export interface MorphPart {
  key: string;
  value: string;
}

/** Partes da análise: a primeira é a classe (rótulo "Classe" no idioma do app); as demais, chave/valor. */
export function morphParts(desc: string | null | undefined): MorphPart[] {
  if (!desc) return [];
  const [pos, ...rest] = desc.split(';').map((s) => s.trim()).filter(Boolean);
  if (!pos) return [];
  const out: MorphPart[] = [{ key: MORPH.keys.Classe, value: capitalize(morphTerm(pos)) }];
  for (const item of rest) {
    const eq = item.indexOf('=');
    if (eq < 0) {
      out.push({ key: MORPH.keys.Extra, value: morphTerm(item) });
      continue;
    }
    const value = item.slice(eq + 1).trim();
    if (!value) continue;
    const name = item.slice(0, eq).trim();
    out.push({ key: Object.hasOwn(MORPH.keys, name) ? (MORPH.keys as Record<string, string>)[name]! : name, value: morphTerm(value) });
  }
  return out;
}

/** Valores sem a classe, para as pílulas (proto: .morph span). */
export function morphPills(desc: string | null | undefined): string[] {
  return morphParts(desc).slice(1).map((p) => p.value);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

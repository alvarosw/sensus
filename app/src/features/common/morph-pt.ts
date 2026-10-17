// Morfologia em português a partir de token.morph_desc ("Verb; Tense=Present; Voice=Active; ...").
// O TAGNT descreve em inglês; aqui só traduzimos os termos gramaticais para exibição.
// O hebraico (TAHOT) tem outro formato e outro mapa, em morph-hb.ts; morphChipsOf junta os dois para os cards.
import type { Testament } from '@sensus/core';
import { hebrewMorphPt } from './morph-hb';

const ATOMS: Record<string, string> = {
  Noun: 'Substantivo',
  Verb: 'Verbo',
  Adjective: 'Adjetivo',
  Adverb: 'Advérbio',
  Conjunction: 'Conjunção',
  Preposition: 'Preposição',
  Interjection: 'Interjeição',
  Particle: 'Partícula',
  'Negative Particle': 'Partícula negativa',
  'Interrogative Particle': 'Partícula interrogativa',
  'Particle or Disjunctive': 'Partícula ou disjuntiva',
  'Definite article': 'Artigo',
  'Personal pronoun': 'Pronome pessoal',
  'Relative pronoun': 'Pronome relativo',
  'Demonstrative pronoun': 'Pronome demonstrativo',
  'Interrogative pronoun': 'Pronome interrogativo',
  'Reflexive pronoun': 'Pronome reflexivo',
  'Reciprocal pronoun': 'Pronome recíproco',
  'Possessive pronoun': 'Pronome possessivo',
  'Indefinite pronoun': 'Pronome indefinido',
  'Correlative pronoun': 'Pronome correlativo',
  'Correlative or Interrogative pronoun': 'Pronome correlativo ou interrogativo',
  'Adverb or adverb and particle combined': 'Advérbio (ou advérbio com partícula)',
  Present: 'presente',
  Aorist: 'aoristo',
  '2nd Aorist': 'aoristo 2º',
  Imperfect: 'imperfeito',
  Perfect: 'perfeito',
  '2nd Perfect': 'perfeito 2º',
  Future: 'futuro',
  '2nd Future': 'futuro 2º',
  Pluperfect: 'mais-que-perfeito',
  '2nd Pluperfect': 'mais-que-perfeito 2º',
  '2nd Present': 'presente 2º',
  Active: 'ativa',
  Passive: 'passiva',
  Middle: 'média',
  'Passive Deponent': 'passiva depoente',
  'Middle Deponent': 'média depoente',
  Deponent: 'depoente',
  'Middle or Passive': 'média/passiva',
  'Middle or Passive Deponent': 'média/passiva depoente',
  Indicative: 'indicativo',
  Subjunctive: 'subjuntivo',
  Imperative: 'imperativo',
  Optative: 'optativo',
  Participle: 'particípio',
  Infinitive: 'infinitivo',
  Nominative: 'nominativo',
  Genitive: 'genitivo',
  Dative: 'dativo',
  Accusative: 'acusativo',
  Vocative: 'vocativo',
  Singular: 'singular',
  Plural: 'plural',
  Masculine: 'masculino',
  Feminine: 'feminino',
  Neuter: 'neutro',
  '1st': '1ª pessoa',
  '2nd': '2ª pessoa',
  '3rd': '3ª pessoa',
  '1st Person': '1ª pessoa',
  '2nd Person': '2ª pessoa',
  '2nd Singular': '2ª pessoa singular',
  Negative: 'negativo',
  Superlative: 'superlativo',
  Comparative: 'comparativo',
  Interrogative: 'interrogativo',
  Title: 'título',
  Individual: 'indivíduo',
  Location: 'lugar',
  Gentilic: 'gentílico',
  Type: 'tipo',
  'Contracted form': 'forma contraída',
  'Attic Greek form': 'forma ática',
  'Indeclinable Letter': 'letra indeclinável',
  Abbreviated: 'abreviado',
  'Indeclinable Numeral': 'numeral indeclinável',
  'Transcribed from Hebrew': 'transcrito do hebraico',
  'Transcribed from Aramaic': 'transcrito do aramaico',
};

const KEYS: Record<string, string> = {
  Tense: 'Tempo',
  Voice: 'Voz',
  Mood: 'Modo',
  Form: 'Forma',
  Case: 'Caso',
  Number: 'Número',
  Gender: 'Gênero',
  Person: 'Pessoa',
  'Name type': 'Tipo de nome',
  Extra: 'Extra',
  'Adj.Numb.': 'Numeral',
  'Original language': 'Origem',
};

/** Traduz cada termo ("Masculine + Noun" → "masculino + substantivo"); desconhecidos ficam como estão. */
export function morphTerm(raw: string): string {
  return raw
    .split(' + ')
    .map((part) => termPt(part.trim()))
    .join(' + ');
}

function termPt(v: string): string {
  if (ATOMS[v]) return ATOMS[v]!;
  const nth = /^(1st|2nd|3rd)\s+(.+)$/.exec(v); // "2nd Imperfect" -> "imperfeito 2º"
  if (nth && ATOMS[nth[2]!]) return `${ATOMS[nth[2]!]} ${nth[1]![0]}º`;
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

/** Partes da análise: a primeira é a classe ("Classe"); as demais, chave/valor em português. */
export function morphParts(desc: string | null | undefined): MorphPart[] {
  if (!desc) return [];
  const [pos, ...rest] = desc.split(';').map((s) => s.trim()).filter(Boolean);
  if (!pos) return [];
  const out: MorphPart[] = [{ key: 'Classe', value: capitalize(morphTerm(pos)) }];
  for (const item of rest) {
    const eq = item.indexOf('=');
    if (eq < 0) {
      out.push({ key: 'Extra', value: morphTerm(item) });
      continue;
    }
    const value = item.slice(eq + 1).trim();
    if (!value) continue;
    out.push({ key: KEYS[item.slice(0, eq).trim()] ?? item.slice(0, eq).trim(), value: morphTerm(value) });
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

// Verificação determinística de afirmações gramaticais feitas pela IA contra a análise morfológica.
import type { CitedSegment, MorphConflict, Token } from '../types';

type Category = 'mood' | 'tense' | 'voice' | 'case' | 'person' | 'number';

/** Valores de um token por categoria, em forma canônica (inglês minúsculo, como no morph_desc). */
export type MorphValues = Partial<Record<Category, Set<string>>>;

const KEY_CATEGORY: Record<string, Category | undefined> = {
  Mood: 'mood',
  Form: 'mood', // infinitivo e particípio aparecem como "Form=" no TEGMC
  Tense: 'tense',
  Voice: 'voice',
  Case: 'case',
  Person: 'person',
  Number: 'number',
};

const VOICE_WORDS = new Set(['active', 'middle', 'passive', 'deponent']);

/** Lê o morph_desc do token ("Verb; Tense=Present; Mood=Imperative; ..."). Sem desc, não há valores. */
export function morphValues(desc: string | null | undefined): MorphValues {
  const out: MorphValues = {};
  if (!desc) return out;
  const add = (cat: Category, value: string): void => {
    (out[cat] ??= new Set()).add(value);
  };
  for (const part of desc.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const cat = KEY_CATEGORY[part.slice(0, eq).trim()];
    const raw = part.slice(eq + 1).trim();
    if (!cat || !raw) continue;
    const lower = raw.toLowerCase();
    if (cat === 'tense') {
      add(cat, lower.replace(/^(1st|2nd|3rd)\s+/, ''));
    } else if (cat === 'voice') {
      for (const word of lower.split(/\s+/)) if (VOICE_WORDS.has(word)) add(cat, word);
    } else if (cat === 'person') {
      const m = /^([123])/.exec(lower);
      if (m) add(cat, `${m[1]}${m[1] === '1' ? 'st' : m[1] === '2' ? 'nd' : 'rd'}`);
    } else if (cat === 'number') {
      const word = lower.split(/\s+/)[0] ?? '';
      if (word === 'singular' || word === 'plural') add(cat, word);
    } else {
      add(cat, lower.split(/\s+/)[0] ?? lower);
    }
  }
  return out;
}

interface ClaimPattern {
  re: RegExp;
  category: Category;
  values: string[];
  /** Termo em português, usado na mensagem de conflito. */
  label: string;
}

// Padrões sobre o texto normalizado (minúsculo, sem acentos). Ordem importa: padrões mais longos antes.
const CLAIMS: ClaimPattern[] = [
  { re: /\bmedia\/passiva\b|\bmiddle or passive\b/g, category: 'voice', values: ['middle', 'passive'], label: 'média/passiva' },
  { re: /\bdeponente\b|\bdeponent\b/g, category: 'voice', values: ['deponent'], label: 'depoente' },
  { re: /\bativ(o|a|os|as)\b|\bactive\b/g, category: 'voice', values: ['active'], label: 'ativa' },
  { re: /\bmedia\b|\bmiddle\b/g, category: 'voice', values: ['middle'], label: 'média' },
  { re: /\bpassiv(o|a|os|as)\b|\bpassive\b/g, category: 'voice', values: ['passive'], label: 'passiva' },

  { re: /\bindicativ(o|a|os|as)\b|\bindicative\b/g, category: 'mood', values: ['indicative'], label: 'indicativo' },
  { re: /\bimperativ(o|a|os|as)\b|\bimperative\b/g, category: 'mood', values: ['imperative'], label: 'imperativo' },
  { re: /\bsubjuntiv(o|a|os|as)\b|\bsubjunctive\b/g, category: 'mood', values: ['subjunctive'], label: 'subjuntivo' },
  { re: /\boptativ(o|a|os|as)\b|\boptative\b/g, category: 'mood', values: ['optative'], label: 'optativo' },
  { re: /\binfinitiv(o|a|os|as)\b|\binfinitive\b/g, category: 'mood', values: ['infinitive'], label: 'infinitivo' },
  { re: /\bparticipi(o|a|os|as)\b|\bparticiple\b/g, category: 'mood', values: ['participle'], label: 'particípio' },

  { re: /\bmais-que-perfeito\b|\bpluperfect\b/g, category: 'tense', values: ['pluperfect'], label: 'mais-que-perfeito' },
  { re: /\bpresente\b|\bpresent\b/g, category: 'tense', values: ['present'], label: 'presente' },
  { re: /\bimperfeito\b|\bimperfect\b/g, category: 'tense', values: ['imperfect'], label: 'imperfeito' },
  { re: /\bfuturo\b|\bfuture\b/g, category: 'tense', values: ['future'], label: 'futuro' },
  { re: /\baoristo\b|\baorist\b/g, category: 'tense', values: ['aorist'], label: 'aoristo' },
  { re: /(?<!que-)\bperfeito\b|\bperfect\b/g, category: 'tense', values: ['perfect'], label: 'perfeito' },

  { re: /\bnominativ(o|a|os|as)\b|\bnominative\b/g, category: 'case', values: ['nominative'], label: 'nominativo' },
  { re: /\bgenitiv(o|a|os|as)\b|\bgenitive\b/g, category: 'case', values: ['genitive'], label: 'genitivo' },
  { re: /\bdativ(o|a|os|as)\b|\bdative\b/g, category: 'case', values: ['dative'], label: 'dativo' },
  { re: /\bacusativ(o|a|os|as)\b|\baccusative\b/g, category: 'case', values: ['accusative'], label: 'acusativo' },
  { re: /\bvocativ(o|a|os|as)\b|\bvocative\b/g, category: 'case', values: ['vocative'], label: 'vocativo' },

  { re: /\b1(st|a|o|ª)?\s+pessoa\b|\bfirst person\b/g, category: 'person', values: ['1st'], label: '1ª pessoa' },
  { re: /\b2(nd|a|o|ª)?\s+pessoa\b|\bsecond person\b/g, category: 'person', values: ['2nd'], label: '2ª pessoa' },
  { re: /\b3(rd|a|o|ª)?\s+pessoa\b|\bthird person\b/g, category: 'person', values: ['3rd'], label: '3ª pessoa' },
  { re: /\bprimeira\s+pessoa\b/g, category: 'person', values: ['1st'], label: '1ª pessoa' },
  { re: /\bsegunda\s+pessoa\b/g, category: 'person', values: ['2nd'], label: '2ª pessoa' },
  { re: /\bterceira\s+pessoa\b/g, category: 'person', values: ['3rd'], label: '3ª pessoa' },

  { re: /\bsingular\b/g, category: 'number', values: ['singular'], label: 'singular' },
  { re: /\bplural\b/g, category: 'number', values: ['plural'], label: 'plural' },
];

/** Nome em português de um valor canônico, para a mensagem de conflito. */
const VALUE_LABEL: Record<string, string> = {
  indicative: 'indicativo',
  imperative: 'imperativo',
  subjunctive: 'subjuntivo',
  optative: 'optativo',
  infinitive: 'infinitivo',
  participle: 'particípio',
  present: 'presente',
  imperfect: 'imperfeito',
  future: 'futuro',
  aorist: 'aoristo',
  perfect: 'perfeito',
  pluperfect: 'mais-que-perfeito',
  active: 'ativa',
  middle: 'média',
  passive: 'passiva',
  deponent: 'depoente',
  nominative: 'nominativo',
  genitive: 'genitivo',
  dative: 'dativo',
  accusative: 'acusativo',
  vocative: 'vocativo',
  '1st': '1ª pessoa',
  '2nd': '2ª pessoa',
  '3rd': '3ª pessoa',
  singular: 'singular',
  plural: 'plural',
};

export interface MorphClaim {
  term: string;
  category: Category;
  values: string[];
}

function normalizeForClaims(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Afirmações gramaticais presentes no texto. Cada trecho casado é removido antes do próximo padrão. */
export function extractMorphClaims(text: string): MorphClaim[] {
  let work = normalizeForClaims(text);
  const claims: MorphClaim[] = [];
  for (const pattern of CLAIMS) {
    for (const match of work.matchAll(pattern.re)) {
      claims.push({ term: pattern.label, category: pattern.category, values: pattern.values });
      work = work.slice(0, match.index) + ' '.repeat(match[0].length) + work.slice(match.index + match[0].length);
    }
  }
  return claims;
}

/** Índice de tokens por cite_id. */
export function tokenIndex(tokens: Iterable<Token>): Map<string, Token> {
  const out = new Map<string, Token>();
  for (const t of tokens) out.set(t.cite_id, t);
  return out;
}

/**
 * Para cada trecho com citações de tok:, compara as afirmações gramaticais do texto com a análise
 * dos tokens citados. Conflito = a categoria tem valor na análise de algum token citado, mas nenhum
 * token citado tem o valor afirmado. Trechos sem conflito voltam inalterados.
 */
export function checkMorphClaims(
  segments: readonly CitedSegment[],
  tokens: ReadonlyMap<string, Token>,
): CitedSegment[] {
  return segments.map((segment) => {
    const cited = segment.cites
      .map((id) => tokens.get(id))
      .filter((t): t is Token => t !== undefined)
      .map((t) => morphValues(t.morph_desc));
    if (cited.length === 0) return segment;

    const conflicts: MorphConflict[] = [];
    const seen = new Set<string>();
    // Agrupa por categoria: se o trecho menciona duas leituras (ex.: "indicativo ou imperativo"),
    // basta que uma delas bata com algum token citado.
    const claims = extractMorphClaims(segment.text);
    const categories = [...new Set(claims.map((c) => c.category))];
    for (const category of categories) {
      const inCategory = claims.filter((c) => c.category === category);
      const withInfo = cited.map((v) => v[category]).filter((set): set is Set<string> => !!set && set.size > 0);
      if (withInfo.length === 0) continue; // nenhum token citado tem essa categoria: nada a comparar
      const agrees = inCategory.some((claim) => withInfo.some((set) => claim.values.some((v) => set.has(v))));
      if (agrees) continue;
      const expected = [...new Set(withInfo.flatMap((set) => [...set]))]
        .map((v) => VALUE_LABEL[v] ?? v)
        .join(' / ');
      for (const claim of inCategory) {
        const key = `${claim.term}|${expected}`;
        if (seen.has(key)) continue;
        seen.add(key);
        conflicts.push({ term: claim.term, expected });
      }
    }
    return conflicts.length > 0 ? { ...segment, morphConflicts: conflicts } : segment;
  });
}

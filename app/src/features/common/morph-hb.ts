// Classe hebraica no idioma do app a partir de token.morph_desc do TAHOT, por exemplo:
// "Consecutive Conjunction + Verb : Hiphil (Causative/declarative, Active) Consecutive Imperfect (Past/present Indicative) Third Singular Masculine"
// Determinística: cada termo conhecido vira o equivalente no idioma (MORPH, morph-strings.ts). Se sobrar algum termo fora
// do mapa, complete = false e quem chama mostra o original (a tradução automática entra como reserva).
import { MORPH } from './morph-strings';

/** Tabela de termos vista como dicionário (chaves de origem). */
const T = (table: object): Record<string, string> => table as Record<string, string>;

export interface HebrewMorph {
  /** Classe no idioma do app (vazio quando complete = false). */
  text: string;
  /** Todos os termos foram traduzidos pelo mapa. */
  complete: boolean;
}

/**
 * Hastes (binyanim) do TAHOT: a grafia de origem leva à haste hebraica. As formas aramaicas (Esdras, Daniel, Jr 10:11)
 * saem com a marca "aramaico": a equivalente hebraica quando há uma clara (Peal = Qal), senão a forma transliterada.
 */
const STEM_SRC: Record<string, readonly [stem: string, aramaic: boolean]> = {
  Qal: ['Qal', false],
  Niphal: ['Niphal', false],
  Piel: ['Piel', false],
  Pual: ['Pual', false],
  Hiphil: ['Hiphil', false],
  Hophal: ['Hophal', false],
  Hithpael: ['Hithpael', false],
  // o TAHOT grafa a mesma haste de duas formas
  Hitpael: ['Hithpael', false],
  Peal: ['Qal', true],
  Peil: ['Pual', true],
  Pael: ['Piel', true],
  Haphel: ['Hiphil', true],
  Aphel: ['Hiphil', true],
  Hitpaal: ['Hithpael', true],
  Hitpeel: ['Hithpael', true],
  Hothpaal: ['Hithpael', true],
  Shaphel: ['Shafel', true],
  Ishtaphel: ['Hishtafel', true],
  Hishtaphel: ['Hishtafel', true],
  Tiphil: ['Tifil', true],
  Nithpael: ['Nitpael', true],
};

/** Atributos (número, gênero, estado, pessoa, uso do nome), do termo mais longo ao mais curto. */
const ATTR_SRC: readonly string[] = [
  'Either gender', 'First', 'Second', 'Third', 'Singular', 'Plural', 'Dual', 'Masculine', 'Feminine', 'individual',
  'Construct', 'Absolute', 'Definite', 'Title', 'Gentilic', 'Location', 'Aramaic',
];

/** Usos do nome que vão depois de vírgula ("substantivo próprio, título"), não entre espaços. */
const USAGE_SRC = /^(Title|Location|Gentilic|individual)\b/;

/** Tempos e formas verbais do TAHOT (chaves de origem; o texto sai de MORPH.hbTense). */
const TENSE_SRC = ['Perfect', 'Imperfect', 'Consecutive Perfect', 'Consecutive Imperfect', 'Imperative', 'Participle', 'Participle passive', 'Infinitive Construct', 'Infinitive Absolute'];
/** Classes sem verbo do TAHOT (o texto sai de MORPH.hbHead). */
const HEAD_SRC = [
  'Noun', 'Proper Noun', 'Adjective', 'Numerical Adjective', 'Numerical position Adjective', 'Pronoun', 'Interrogative Pronoun',
  'Preposition', 'Conjunction', 'Consecutive Conjunction', 'Definite article', 'Object indicator', 'Suffix', 'Directional Suffix',
  'Paragogic Nun', 'Paragogic Hé', 'Interrogative Particle', 'Relative Particle', 'Conditional Particle', 'Negative Particle',
  'Demonstrative Particle', 'Interjection', 'Adverb',
];

const byLengthDesc = (a: string, b: string): number => b.length - a.length;
const STEMS = Object.keys(STEM_SRC).sort(byLengthDesc);
const TENSES = [...TENSE_SRC].sort(byLengthDesc);
const HEADS = [...HEAD_SRC].sort(byLengthDesc);
const ATTRS = [...ATTR_SRC].sort(byLengthDesc);

/** Consome um termo do início (com fronteira de palavra); devolve o resto sem espaços à esquerda. */
function takeWord(s: string, words: readonly string[]): { word: string; rest: string } | null {
  for (const w of words) {
    if (s === w || s.startsWith(`${w} `)) return { word: w, rest: s.slice(w.length).trimStart() };
  }
  return null;
}

/** Consome um parêntese do início: "(Singular Masculine, Absolute) resto". */
function takeParen(s: string): { content: string | null; rest: string } {
  const m = /^\(([^)]*)\)\s*/.exec(s);
  return m ? { content: m[1]!, rest: s.slice(m[0].length) } : { content: null, rest: s };
}

/** Atributos separados por espaço ("Third Singular Masculine") no idioma do app; null se sobrar termo desconhecido. */
function attrsPt(text: string): string | null {
  const out: string[] = [];
  let rest = text.trim();
  while (rest) {
    const hit = ATTRS.find((en) => rest === en || rest.startsWith(`${en} `));
    if (!hit) return null;
    out.push(T(MORPH.hbAttr)[hit]!);
    rest = rest.slice(hit.length).trimStart();
  }
  return out.join(' ');
}

/** Grupos de um parêntese ("Singular Masculine, Construct") no idioma do app; null se algum grupo falhar. */
function groupsPt(content: string): string | null {
  const groups = content.split(',').map((g) => attrsPt(g.trim()));
  return groups.every((g): g is string => g !== null && g !== '') ? groups.join(', ') : null;
}

/**
 * Modo do tempo, pelo parêntese depois do tempo: "(Future/present Jussive)" = jussivo. Os indicativos (e as formas
 * ambíguas "Indicative/jussive") não trazem modo: ''. undefined = o parêntese não é de modo; null = desconhecido.
 */
function moodPt(content: string): string | null | undefined {
  if (!/Indicative|Jussive|Cohortative/.test(content)) return undefined;
  if (content === 'Future/present Jussive') return MORPH.hbWords.jussive;
  if (content === 'Future/present Cohortative') return MORPH.hbWords.cohortative;
  if (/Indicative/.test(content)) return '';
  return null;
}

/** Haste com a glosa: "Hiphil (causativa/declarativa, ativa)". */
function stemPt(s: string): { text: string; rest: string } | null {
  const hit = takeWord(s, STEMS);
  if (!hit) return null;
  const paren = takeParen(hit.rest);
  const [stem, aramaic] = STEM_SRC[hit.word]!;
  let text = T(MORPH.hbStem)[stem]!;
  if (aramaic) text += ` ${MORPH.hbAttr.Aramaic}`;
  if (paren.content !== null) {
    const gloss = paren.content.split(',').map((g) => Object.hasOwn(MORPH.hbGloss, g.trim()) ? T(MORPH.hbGloss)[g.trim()] : undefined);
    if (gloss.some((g) => g === undefined)) return null;
    text += ` (${gloss.join(', ')})`;
  }
  return { text, rest: paren.rest };
}

/** Forma verbal: [Verb : haste] [Conjunction] tempo [(modo ou atributos)] [pessoa, número, gênero]. */
function verbPt(s: string): string | null {
  let rest = s;
  let head: string = MORPH.hbWords.verb;
  if (/^Verb\s*:/.test(rest)) {
    const stem = stemPt(rest.replace(/^Verb\s*:\s*/, ''));
    if (!stem) return null;
    head = `${MORPH.hbWords.verb} ${stem.text}`;
    rest = stem.rest;
  }
  // tempo com conjunção ("conjunção + imperfeito") e modo ("imperfeito jussivo") formam um bloco; o resto vem depois
  const tenseWords: string[] = [];
  const conj = takeWord(rest, ['Conjunction']);
  if (conj) {
    tenseWords.push(MORPH.hbWords.conj);
    rest = conj.rest;
  }
  const tense = takeWord(rest, TENSES);
  if (tense) {
    tenseWords.push(T(MORPH.hbTense)[tense.word]!);
    rest = tense.rest;
  }
  let tenseBlock = tenseWords.join(' + ');
  const others: string[] = [];
  const paren = takeParen(rest);
  rest = paren.rest;
  if (paren.content !== null) {
    const mood = moodPt(paren.content);
    if (mood === null) return null;
    if (mood === undefined) {
      const attrs = groupsPt(paren.content);
      if (attrs === null) return null;
      others.push(attrs);
    } else if (mood !== '') {
      tenseBlock = tenseBlock ? `${tenseBlock} ${mood}` : mood;
    }
  }
  if (rest) {
    const persons = attrsPt(rest);
    if (persons === null) return null;
    others.push(persons);
  }
  const pieces = [tenseBlock, ...others].filter(Boolean);
  return pieces.length > 0 ? `${head}, ${pieces.join(', ')}` : head;
}

/** Classe sem verbo: "Noun (Singular Masculine, Construct)" -> "substantivo singular masculino, estado construto". */
function headPt(s: string): string | null {
  const hit = takeWord(s, HEADS);
  if (!hit) return null;
  const paren = takeParen(hit.rest);
  if (paren.rest) return null;
  const base = T(MORPH.hbHead)[hit.word]!;
  if (paren.content === null || paren.content === 'Hebrew') return base;
  if (hit.word === 'Preposition' && paren.content === 'Definite') return MORPH.hbHead.prepDefinite!;
  const groups = groupsPt(paren.content);
  if (groups === null) return null;
  // uso do nome ("substantivo próprio, título") separa com vírgula; número, gênero e estado vêm depois do nome
  return USAGE_SRC.test(paren.content) ? `${base}, ${groups}` : `${base} ${groups}`;
}

/** Um segmento (separado por " + "): forma verbal (com ou sem "Verb :") ou classe sem verbo. */
function segmentPt(seg: string): string | null {
  const s = seg.trim();
  // forma verbal: "Verb : ..." ou começando por tempo ("Imperfect Third Plural Masculine")
  if (/^Verb\s*:/.test(s) || takeWord(s, TENSES)) return verbPt(s);
  return headPt(s);
}

/** Maiúscula na primeira letra, como no morphParts do grego. */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Classe hebraica no idioma do app; complete = false quando algum termo não está no mapa (use o original ou a tradução). */
export function hebrewMorphPt(desc: string | null | undefined): HebrewMorph {
  if (!desc || !desc.trim()) return { text: '', complete: true };
  // "Conjunction+Imperfect" (sem espaços) é uma só forma verbal
  const segs = desc.replace(/Conjunction\+/g, 'Conjunction ').split(/\s*\+\s*/);
  const out: string[] = [];
  for (const seg of segs) {
    const t = segmentPt(seg);
    if (t === null) return { text: '', complete: false };
    out.push(t);
  }
  return { text: capitalize(out.join(' + ')), complete: true };
}

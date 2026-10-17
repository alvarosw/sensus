// Classe hebraica em português a partir de token.morph_desc do TAHOT, por exemplo:
// "Consecutive Conjunction + Verb : Hiphil (Causative/declarative, Active) Consecutive Imperfect (Past/present Indicative) Third Singular Masculine"
// Determinística: cada termo conhecido vira o equivalente em português. Se sobrar algum termo fora do mapa,
// complete = false e quem chama mostra o original (a tradução automática entra como reserva).

export interface HebrewMorph {
  /** Classe em português (vazio quando complete = false). */
  text: string;
  /** Todos os termos foram traduzidos pelo mapa. */
  complete: boolean;
}

/**
 * Hastes (binyanim). As formas aramaicas (Esdras, Daniel, Jr 10:11) saem com a marca "aramaico": a equivalente
 * hebraica quando há uma clara (Peal = Qal), senão a forma transliterada.
 */
const STEM_PT: Record<string, string> = {
  Qal: 'Qal',
  Niphal: 'Niphal',
  Piel: 'Piel',
  Pual: 'Pual',
  Hiphil: 'Hiphil',
  Hophal: 'Hophal',
  Hithpael: 'Hithpael',
  // o TAHOT grafa a mesma haste de duas formas
  Hitpael: 'Hithpael',
  Peal: 'Qal aramaico',
  Peil: 'Pual aramaico',
  Pael: 'Piel aramaico',
  Haphel: 'Hiphil aramaico',
  Aphel: 'Hiphil aramaico',
  Hitpaal: 'Hithpael aramaico',
  Hitpeel: 'Hithpael aramaico',
  Hothpaal: 'Hithpael aramaico',
  Shaphel: 'Shafel aramaico',
  Ishtaphel: 'Hishtafel aramaico',
  Hishtaphel: 'Hishtafel aramaico',
  Tiphil: 'Tifil aramaico',
  Nithpael: 'Nitpael aramaico',
};

/** Glosas entre parênteses da haste: "(Simple, Active)", "(Causative/declarative, Active)"... */
const STEM_GLOSS_PT: Record<string, string> = {
  Simple: 'simples',
  'Causative/declarative': 'causativa/declarativa',
  'Intensive/resultive/transtive': 'intensiva/resultativa/transitiva',
  'Reflexive/iterative': 'reflexiva/iterativa',
  Active: 'ativa',
  Passive: 'passiva',
};

/** Tempos e formas verbais. */
const TENSE_PT: Record<string, string> = {
  Perfect: 'perfeito',
  Imperfect: 'imperfeito',
  'Consecutive Perfect': 'perfeito consecutivo',
  'Consecutive Imperfect': 'imperfeito consecutivo',
  Imperative: 'imperativo',
  Participle: 'particípio',
  'Participle passive': 'particípio passivo',
  'Infinitive Construct': 'infinitivo construto',
  'Infinitive Absolute': 'infinitivo absoluto',
};

/** Classes de palavra que não são verbo (com o parêntese, quando há, tratado em headPt). */
const HEAD_PT: Record<string, string> = {
  Noun: 'substantivo',
  'Proper Noun': 'substantivo próprio',
  Adjective: 'adjetivo',
  'Numerical Adjective': 'adjetivo numeral',
  'Numerical position Adjective': 'adjetivo numeral ordinal',
  Pronoun: 'pronome',
  'Interrogative Pronoun': 'pronome interrogativo',
  Preposition: 'preposição',
  Conjunction: 'conjunção',
  'Consecutive Conjunction': 'conjunção consecutiva',
  'Definite article': 'artigo definido',
  'Object indicator': 'marcador de objeto',
  Suffix: 'sufixo pronominal',
  'Directional Suffix': 'sufixo direcional',
  'Paragogic Nun': 'nun paragógico',
  'Paragogic Hé': 'hé paragógico',
  'Interrogative Particle': 'partícula interrogativa',
  'Relative Particle': 'partícula relativa',
  'Conditional Particle': 'partícula condicional',
  'Negative Particle': 'partícula negativa',
  'Demonstrative Particle': 'partícula demonstrativa',
  Interjection: 'interjeição',
  Adverb: 'advérbio',
};

/** Atributos (número, gênero, estado, pessoa, uso do nome), do termo mais longo ao mais curto. */
const ATTR_PT: readonly (readonly [string, string])[] = [
  ['Either gender', 'qualquer gênero'],
  ['First', '1ª pessoa'],
  ['Second', '2ª pessoa'],
  ['Third', '3ª pessoa'],
  ['Singular', 'singular'],
  ['Plural', 'plural'],
  ['Dual', 'dual'],
  ['Masculine', 'masculino'],
  ['Feminine', 'feminino'],
  ['individual', 'indivíduo'],
  ['Construct', 'estado construto'],
  ['Absolute', 'estado absoluto'],
  ['Definite', 'estado determinado'],
  ['Title', 'título'],
  ['Gentilic', 'gentílico'],
  ['Location', 'lugar'],
  ['Aramaic', 'aramaico'],
];

const byLengthDesc = (a: string, b: string): number => b.length - a.length;
const STEMS = Object.keys(STEM_PT).sort(byLengthDesc);
const TENSES = Object.keys(TENSE_PT).sort(byLengthDesc);
const HEADS = Object.keys(HEAD_PT).sort(byLengthDesc);

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

/** Atributos separados por espaço ("Third Singular Masculine") em português; null se sobrar termo desconhecido. */
function attrsPt(text: string): string | null {
  const out: string[] = [];
  let rest = text.trim();
  while (rest) {
    const hit = ATTR_PT.find(([en]) => rest === en || rest.startsWith(`${en} `));
    if (!hit) return null;
    out.push(hit[1]);
    rest = rest.slice(hit[0].length).trimStart();
  }
  return out.join(' ');
}

/** Grupos de um parêntese ("Singular Masculine, Construct") em português; null se algum grupo falhar. */
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
  if (content === 'Future/present Jussive') return 'jussivo';
  if (content === 'Future/present Cohortative') return 'coortativo';
  if (/Indicative/.test(content)) return '';
  return null;
}

/** Haste com a glosa: "Hiphil (causativa/declarativa, ativa)". */
function stemPt(s: string): { text: string; rest: string } | null {
  const hit = takeWord(s, STEMS);
  if (!hit) return null;
  const paren = takeParen(hit.rest);
  let text = STEM_PT[hit.word]!;
  if (paren.content !== null) {
    const gloss = paren.content.split(',').map((g) => STEM_GLOSS_PT[g.trim()]);
    if (gloss.some((g) => g === undefined)) return null;
    text += ` (${gloss.join(', ')})`;
  }
  return { text, rest: paren.rest };
}

/** Forma verbal: [Verb : haste] [Conjunction] tempo [(modo ou atributos)] [pessoa, número, gênero]. */
function verbPt(s: string): string | null {
  let rest = s;
  let head = 'verbo';
  if (/^Verb\s*:/.test(rest)) {
    const stem = stemPt(rest.replace(/^Verb\s*:\s*/, ''));
    if (!stem) return null;
    head = `verbo ${stem.text}`;
    rest = stem.rest;
  }
  // tempo com conjunção ("conjunção + imperfeito") e modo ("imperfeito jussivo") formam um bloco; o resto vem depois
  const tenseWords: string[] = [];
  const conj = takeWord(rest, ['Conjunction']);
  if (conj) {
    tenseWords.push('conjunção');
    rest = conj.rest;
  }
  const tense = takeWord(rest, TENSES);
  if (tense) {
    tenseWords.push(TENSE_PT[tense.word]!);
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
  const base = HEAD_PT[hit.word]!;
  if (paren.content === null || paren.content === 'Hebrew') return base;
  if (hit.word === 'Preposition' && paren.content === 'Definite') return 'preposição com artigo';
  const groups = groupsPt(paren.content);
  if (groups === null) return null;
  // uso do nome ("substantivo próprio, título") separa com vírgula; número, gênero e estado vêm depois do nome
  return /^(título|lugar|gentílico|indivíduo)/.test(groups) ? `${base}, ${groups}` : `${base} ${groups}`;
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

/** Classe hebraica em português; complete = false quando algum termo não está no mapa (use o original ou a tradução). */
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

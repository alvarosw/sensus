// Extração e validação de citações [[cite_id]] na resposta da IA.
import type { CitedSegment } from '../types';

const SENTINEL = '';
// Prefixos do schema (pipeline/schema.sql): txt, tok, lex, com, dic, xr, ent (xr tem dois caracteres).
const CITE_ID = '(?:txt|tok|lex|com|dic|xr|ent):[A-Za-z0-9:._-]+';

// [[id]] ou [[id1, id2]] (qualquer conteúdo sem colchetes) e [id] ou [id1, id2] com prefixo de cite_id.
const MARKER_RE = new RegExp(
  `\\[\\[([^\\[\\]\\n]*)\\]\\]|\\[(${CITE_ID}(?:\\s*[,;]\\s*${CITE_ID})*)\\]`,
  'g',
);
// Marcador já completo no início do trecho (usado para o corte em streaming).
const COMPLETE_AT_START = new RegExp(`^(?:\\[\\[[^\\[\\]\\n]*\\]\\]|\\[${CITE_ID}(?:\\s*[,;]\\s*${CITE_ID})*\\])`);
// Ponto-e-vírgula também separa cláusulas ("Filipenses 2:6 — ...; ἁρπαγμὸν ..."): cada cláusula tem sua citação.
const TERMINAL = /[.!?…;]/;

/**
 * Abreviações comuns (sem o ponto, minúsculas) após as quais o ponto não encerra a sentença:
 * referências bíblicas (vv., cf., Dt.), capítulos, séculos, "p. ex.", "a.C.", "d.C.".
 * Uma letra isolada também é abreviação ("a.C.", iniciais).
 */
const ABBREVIATIONS: ReadonlySet<string> = new Set([
  'vv', 'v', 'cf', 'cap', 'caps', 'p', 'pp', 'ex', 'p.ex', 'séc', 'secs', 'sec', 'a.c', 'd.c', 'ref', 'refs',
  'art', 'sr', 'sra', 'dr', 'ibid', 'op', 'cit', 'trad', 'ed', 'vol', 'aprox', 'pág', 'págs', 'ver', 'vs',
  'gn', 'ex', 'lv', 'nm', 'dt', 'js', 'jz', 'rt', 'sm', 'rs', 'cr', 'ne', 'et', 'jó', 'sl', 'pv', 'ec', 'ct',
  'is', 'jr', 'lm', 'ez', 'dn', 'os', 'jl', 'am', 'mq', 'na', 'hc', 'sf', 'ag', 'zc', 'ml',
  'mt', 'mc', 'lc', 'jo', 'at', 'rm', 'co', 'fp', 'fl', 'cl', 'ts', 'tm', 'fm', 'hb', 'tg', 'pe', 'jd',
  'ap', 'nº', 'n', 'etc',
  // Abreviações gramaticais (morfologia em português): "3ª sing.", "masc. pl.", "acus.".
  'sing', 'pl', 'masc', 'fem', 'neut', 'nom', 'gen', 'dat', 'acus', 'ac', 'imp', 'ind', 'subj', 'opt',
  'inf', 'part', 'pres', 'aor', 'perf', 'fut', 'imperf', 'pass', 'med', 'dep', 'ativ', 'ex',
]);

/** O ponto que acaba `buf` pertence a uma abreviação (ex.: "vv", "p.ex", ou uma letra isolada). */
function endsWithAbbreviation(buf: string): boolean {
  const word = /([\p{L}.]+)$/u.exec(buf)?.[1]?.toLowerCase().replace(/\.$/, '');
  if (!word) return false;
  return word.length === 1 || ABBREVIATIONS.has(word);
}
const INFERENCE_RE = /^\(\s*infer[êe]ncia\s*\)/i;

/** Texto sem marcação de Markdown nem marcadores de lista/título no início. */
function plainCore(text: string): string {
  return text
    .trim()
    .replace(/^(?:[-*•>]\s*|#+\s*|\d+[.)]\s+)+/, '')
    .replace(/\*\*|__/g, '')
    .trim();
}

/** Aviso de ausência ("O contexto não traz registros para esta seção."), não é afirmação sobre a Escritura. */
const ABSENCE_RE =
  /\b(?:n[ãa]o\s+(?:traz|tem|cont[ée]m|h[áa]|apresenta)\s+(?:\S+\s+)?(?:registros?|informa[çc][õo]es|material|dados|fontes?|entradas?)|sem\s+(?:registros?|informa[çc][õo]es|material|dados))\b(?=.*\b(contexto|se[çc][ãa]o|camada|tema|passagem|banco)\b|\s*\.?$)/i;

/**
 * Classifica um segmento:
 * - inference: começa com "(Inferência)";
 * - structure: título (#), rótulo de seção em negrito ("**1. Texto**"), rótulo "Algo:" curto,
 *   ou aviso de ausência, sem citação válida;
 * - source: tem ao menos uma citação válida; senão uncited.
 */
function classify(text: string, hasValidCite: boolean): CitedSegment['kind'] {
  const core = plainCore(text);
  if (INFERENCE_RE.test(core)) return 'inference';
  if (hasValidCite) return 'source';
  const trimmed = text.trim();
  const isHeading = /^#{1,6}\s/.test(trimmed);
  const isBoldLabel = /^\*\*[^*]+\*\*:?$/.test(trimmed);
  const isShortLabel = core.length <= 80 && /:$/.test(core);
  const isAbsence = core.length <= 160 && ABSENCE_RE.test(core);
  if (isHeading || isBoldLabel || isShortLabel || isAbsence) return 'structure';
  return 'uncited';
}

function splitIds(body: string): string[] {
  return body
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Remove os marcadores de citação, deixando só o texto. */
export function stripCitations(text: string): string {
  return text.replace(MARKER_RE, '').replace(/[ \t]+([.,;:!?])/g, '$1').replace(/[ \t]{2,}/g, ' ');
}

interface RawSentence {
  text: string;
  ids: string[];
}

/** Divide cada linha em sentenças. Marcadores ficam com a sentença que os precede. */
function splitSentences(flat: string, markers: string[][]): RawSentence[] {
  const out: RawSentence[] = [];
  let markerIndex = 0;

  for (const line of flat.split('\n')) {
    let buf = '';
    let ids: string[] = [];
    let state: 'none' | 'punct' | 'space' = 'none';

    const flush = (): void => {
      const text = buf
        .split(SENTINEL)
        .join('')
        .replace(/\s+/g, ' ')
        .replace(/ ([.,;:!?…])/g, '$1')
        .trim();
      if (text || ids.length > 0) out.push({ text, ids });
      buf = '';
      ids = [];
      state = 'none';
    };

    let lastVisible = '';
    for (const ch of line) {
      if (ch === SENTINEL) {
        ids.push(...(markers[markerIndex] ?? []));
        markerIndex++;
        buf += ch;
        continue;
      }
      if (/\s/.test(ch)) {
        if (state === 'punct') state = 'space';
        buf += ch;
        continue;
      }
      // Ponto depois de número ("1. Texto", "2.") não encerra sentença.
      const numberPeriod = ch === '.' && /\d/.test(lastVisible);
      const abbreviationPeriod = ch === '.' && endsWithAbbreviation(buf);
      if (TERMINAL.test(ch) && !numberPeriod && !abbreviationPeriod) {
        buf += ch;
        state = 'punct';
        lastVisible = ch;
        continue;
      }
      // Caractere visível: fecha a sentença só se houve pontuação final seguida de espaço.
      if (state === 'space') flush();
      else state = 'none';
      buf += ch;
      lastVisible = ch;
    }
    flush();
  }
  return out;
}

/**
 * Converte a resposta em segmentos (sentenças) com suas citações.
 * - cites: ids válidos (presentes em validIds); invalidCites: ids citados mas ausentes do contexto.
 * - kind: 'inference' se começa com "(Inferência)"; 'source' se tem ao menos um id válido; senão 'uncited'.
 * Marcadores sem texto (uma linha só com [[id]]) são anexados ao segmento anterior.
 */
export function parseCited(text: string, validIds: ReadonlySet<string>): CitedSegment[] {
  const markers: string[][] = [];
  const flat = text.replace(MARKER_RE, (_match: string, double: string | undefined, single: string | undefined) => {
    markers.push(splitIds(double ?? single ?? ''));
    return SENTINEL;
  });

  const segments: CitedSegment[] = [];
  for (const raw of splitSentences(flat, markers)) {
    const cited = [...new Set(raw.ids)];
    const valid = cited.filter((id) => validIds.has(id));
    const invalid = cited.filter((id) => !validIds.has(id));

    if (!raw.text) {
      const last = segments[segments.length - 1];
      if (last) {
        last.cites = [...new Set([...last.cites, ...valid])];
        last.invalidCites = [...new Set([...last.invalidCites, ...invalid])];
      }
      continue;
    }

    const kind = classify(raw.text, valid.length > 0);
    segments.push({ text: raw.text, cites: valid, invalidCites: invalid, kind });
  }
  return segments;
}

/**
 * Quantos caracteres do início de `text` podem ser interpretados sem cortar um marcador
 * que ainda está chegando (ex.: "[[txt:blivre:5000" ou "[[txt:blivre:50002005]").
 */
export function safeParseLength(text: string): number {
  let start = text.lastIndexOf('[');
  if (start < 0) return text.length;
  if (start > 0 && text[start - 1] === '[') start -= 1;
  const tail = text.slice(start);
  const pending = !tail.includes(']') || (tail.startsWith('[[') && !tail.includes(']]'));
  return pending ? start : text.length;
}

/**
 * Acumula o streaming e devolve os segmentos já seguros. Use `finish()` no fim para
 * parsear o texto completo, inclusive um marcador que tenha ficado pendente.
 */
export class CitationStream {
  private buffer = '';
  private readonly validIds: ReadonlySet<string>;

  constructor(validIds: ReadonlySet<string>) {
    this.validIds = validIds;
  }

  /** Texto acumulado até agora (bruto, com marcadores). */
  get text(): string {
    return this.buffer;
  }

  push(chunk: string): CitedSegment[] {
    this.buffer += chunk;
    return parseCited(this.buffer.slice(0, safeParseLength(this.buffer)), this.validIds);
  }

  finish(): CitedSegment[] {
    return parseCited(this.buffer, this.validIds);
  }
}

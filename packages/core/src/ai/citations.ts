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
/**
 * Rótulo de inferência, em todas as grafias que o modelo usa: "(Inferência)", "(inferência):",
 * "**(Inferência)**", "*(Inferência)*", "_Inferência:_", "**Inferência:**", "Inferência:".
 * A forma sem parênteses exige dois-pontos (para não pegar "inferência" no meio de uma frase comum).
 */
const W = 'infer[eê]ncia';
const EMPH = '(?:\\*\\*|__|\\*|_)';
const EMPH_OPT = `${EMPH}?\\s*`;
const PAREN_LABEL = `\\(\\s*${W}\\s*\\)\\s*:?`;
const COLON_LABEL = `${W}\\s*${EMPH}?\\s*:`;
/** Rótulo no início da frase (depois de marcadores de lista, títulos e aspas; pode vir depois de um negrito inicial). */
const BOLD_LEAD_IN = `${EMPH}[^*_\\n]{1,80}${EMPH}\\s*`;
const LABEL_START_RE = new RegExp(`^(?:${BOLD_LEAD_IN})?${EMPH_OPT}(?:${PAREN_LABEL}|${COLON_LABEL})\\s*${EMPH_OPT}`, 'iu');
/** Rótulo no fim da frase, só na forma entre parênteses ("... texto. (Inferência)"). */
const LABEL_END_RE = new RegExp(`(?:^|[\\s.!?…;])${EMPH_OPT}\\(\\s*${W}\\s*\\)\\s*${EMPH}?\\s*[.!?…]?\\s*$`, 'iu');

/** Remove rótulos no meio do texto (uso na exibição de um bloco que já é inferência). */
/** Rótulo envolvido por ênfase igual dos dois lados ("**(Inferência)**", "_Inferência:_"): sai inteiro. */
const PAIRED_LABEL_RE = new RegExp(`(\\*\\*|__|\\*|_)\\s*(?:\\(\\s*${W}\\s*\\)\\s*:?|${W}\\s*:)\\s*\\1`, 'giu');
/** Rótulo solto no meio do texto. A ênfase que o antecede (ex.: "**(Inferência) texto**") fica para o Markdown. */
const PAREN_LABEL_INLINE_RE = new RegExp(`(^|[\\s.!?…;\\]"“«'‘*_])${PAREN_LABEL}\\s*`, 'giu');
const COLON_LABEL_INLINE_RE = new RegExp(`(^|[.!?…;]\\s+|[\\]"“«'‘]\\s*)${COLON_LABEL}\\s*`, 'giu');

/** Marcadores de lista, títulos e aspas no início do trecho (sem tocar em ênfase). */
function leadingStrip(text: string): string {
  return text.trim().replace(/^(?:(?:[-*•+>]|#+|\d+[.)])\s+|["“«'‘]\s*)+/u, '').trim();
}

/** Texto sem marcação de Markdown nem marcadores de lista/título no início. */
function plainCore(text: string): string {
  return leadingStrip(text).replace(/\*\*|__/g, '').trim();
}

/** A frase é inferência: começa com rótulo, ou termina com "(Inferência)". */
function isInferenceText(text: string): boolean {
  const core = leadingStrip(text);
  return LABEL_START_RE.test(core) || LABEL_END_RE.test(core);
}

/** Frase que é só o rótulo ("(Inferência)" sozinho, depois de um ponto): marca a frase anterior. */
function isLabelOnly(text: string): boolean {
  const core = leadingStrip(text);
  const rest = core.replace(LABEL_START_RE, '').replace(LABEL_END_RE, '');
  return isInferenceText(text) && rest.replace(/[\s*_.:;!?…]/g, '') === '';
}

/** Aviso de ausência ("O contexto não traz registros para esta seção."), não é afirmação sobre a Escritura. */
const ABSENCE_RE =
  /\b(?:n[ãa]o\s+(?:traz|tem|cont[ée]m|h[áa]|apresenta)\s+(?:\S+\s+)?(?:registros?|informa[çc][õo]es|material|dados|fontes?|entradas?)|sem\s+(?:registros?|informa[çc][õo]es|material|dados))\b(?=.*\b(contexto|se[çc][ãa]o|camada|tema|passagem|banco)\b|\s*\.?$)/i;

/** Frase sobre o próprio material ("O contexto traz…", "A seção não traz…"): meta, não é afirmação sobre a Escritura. */
const META_RE =
  /^(?:(?:o|a|este|esta|esse|essa|nesta|neste)\s+)?(?:contexto|banco|se[çc][ãa]o|camada|painel)\s+(?:n[ãa]o\s+)?(?:traz|tem|cont[ée]m|fornece|apresenta|inclui|re[úu]ne|registra|oferece|permite|mostra)\b|^(?:abaixo|acima|a\s+seguir)\b/i;

/**
 * Classifica um segmento:
 * - inference: começa com um rótulo de inferência (ver LABEL_START_RE) ou termina com "(Inferência)";
 * - source: tem ao menos uma citação válida;
 * - structure (não é fato): título (#), rótulo de seção em negrito ("**1. Texto**"), rótulo "Algo:" curto,
 *   pergunta, aviso de ausência ou frase sobre o contexto, sem citação válida;
 * - uncited: afirmação factual sem citação (pode ser coberta por uma citação depois, ver attributeCitations).
 */
function classify(text: string, hasValidCite: boolean): CitedSegment['kind'] {
  if (isInferenceText(text)) return 'inference';
  if (hasValidCite) return 'source';
  const core = plainCore(text);
  // Rótulo inicial ("Observação: ...") não muda se a frase é sobre o contexto.
  const body = core.replace(/^[^:.!?]{1,40}:\s+/u, '');
  const trimmed = text.trim();
  const isHeading = /^#{1,6}\s/.test(trimmed);
  const isBoldLabel = /^\*\*.+\*\*:?$/.test(trimmed) && core.length <= 120 && !/[.!?]$/.test(core);
  const isShortLabel = core.length <= 80 && /:$/.test(core);
  const isAbsence = body.length <= 160 && ABSENCE_RE.test(body);
  const isMeta = META_RE.test(body);
  const isQuestion = /\?[\s*_]*$/.test(core);
  if (isHeading || isBoldLabel || isShortLabel || isAbsence || isMeta || isQuestion) return 'structure';
  return 'uncited';
}

/**
 * Atribuição das citações: um grupo de citações vale para a frase que ele fecha e para as frases
 * factuais sem citação que a precedem no mesmo parágrafo (desde a citação anterior). Essas frases
 * passam a 'source', com as citações do grupo. Inferências, estruturas e perguntas não contam como
 * sem fonte; um rótulo "(Inferência)" sozinho depois de frases sem citação marca essas frases como inferência.
 */
function attributeCitations(segments: CitedSegment[], lineOf: readonly number[]): void {
  // Rótulo no início do parágrafo: as frases sem citação que seguem (até a primeira citação) são inferência,
  // como manda o prompt ("parágrafo de inferência começa com (Inferência)").
  let line = -1;
  let inherit = false;
  segments.forEach((seg, i) => {
    if (lineOf[i] !== line) {
      line = lineOf[i]!;
      inherit = seg.kind === 'inference' && LABEL_START_RE.test(leadingStrip(seg.text));
    } else if (inherit) {
      if (seg.kind === 'uncited') seg.kind = 'inference';
      else if (seg.cites.length > 0) inherit = false;
    }
  });

  let pending: CitedSegment[] = [];
  line = -1;
  segments.forEach((seg, i) => {
    if (lineOf[i] !== line) {
      pending = [];
      line = lineOf[i]!;
    }
    // Rótulo no fim ("... texto. (Inferência)"): vale para as frases sem citação que o precedem, como a citação.
    if (isLabelOnly(seg.text)) {
      for (const p of pending) p.kind = 'inference';
      pending = [];
    }
    if (seg.kind === 'uncited') {
      pending.push(seg);
    } else if (seg.cites.length > 0) {
      for (const p of pending) {
        p.kind = 'source';
        p.cites = [...seg.cites];
      }
      pending = [];
    }
  });
}

/** Rótulo de inferência para exibição: remove "(Inferência)" e variantes (use só quando o bloco inteiro é inferência). */
export function stripInferenceLabels(text: string): string {
  // O grupo 1 é a pontuação que antecede o rótulo: volta com um espaço depois, para não colar as frases.
  const keep = (_match: string, before: string): string => (before === '' || /[\s*_]/.test(before) ? before : `${before} `);
  return text
    .replace(PAIRED_LABEL_RE, '')
    .replace(PAREN_LABEL_INLINE_RE, keep)
    .replace(COLON_LABEL_INLINE_RE, keep)
    .replace(/(\*\*|__)\s+/g, '$1')
    .replace(/ ([.!?…;:,])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
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
  /** Linha de origem: a atribuição de citações não cruza linhas (parágrafos). */
  line: number;
}

/** Divide cada linha em sentenças. Marcadores ficam com a sentença que os precede. */
function splitSentences(flat: string, markers: string[][]): RawSentence[] {
  const out: RawSentence[] = [];
  let markerIndex = 0;

  const lines = flat.split('\n');
  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const line = lines[lineNo]!;
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
      if (text || ids.length > 0) out.push({ text, ids, line: lineNo });
      buf = '';
      ids = [];
      state = 'none';
    };

    let depth = 0; // dentro de parênteses, pontuação não encerra a frase
    for (const ch of line) {
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
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
      // Ponto depois de número que abre a frase ("1. Texto", "**2.**") não encerra sentença; "v. 4. Sem…" encerra.
      const numberPeriod = ch === '.' && /^[\s*_>#]*\d+$/.test(buf);
      const abbreviationPeriod = ch === '.' && endsWithAbbreviation(buf);
      if (TERMINAL.test(ch) && !numberPeriod && !abbreviationPeriod && depth === 0) {
        buf += ch;
        state = 'punct';
        continue;
      }
      // Caractere visível: fecha a sentença só se houve pontuação final seguida de espaço.
      if (state === 'space') flush();
      else state = 'none';
      buf += ch;
    }
    flush();
  }
  return out;
}

/**
 * Converte a resposta em segmentos (sentenças) com suas citações.
 * - cites: ids válidos (presentes em validIds); invalidCites: ids citados mas ausentes do contexto.
 * - kind: 'inference' se começa (ou termina) com "(Inferência)"; 'source' se tem ao menos um id válido;
 *   senão 'uncited' (ou 'structure', ver classify). Depois, attributeCitations cobre as frases sem citação
 *   que precedem um grupo de citações no mesmo parágrafo.
 * Marcadores sem texto (uma linha só com [[id]]) são anexados ao segmento anterior.
 */
export function parseCited(text: string, validIds: ReadonlySet<string>): CitedSegment[] {
  const markers: string[][] = [];
  const flat = text.replace(MARKER_RE, (_match: string, double: string | undefined, single: string | undefined) => {
    markers.push(splitIds(double ?? single ?? ''));
    return SENTINEL;
  });

  // Marcador sem texto (linha própria) vai para a sentença anterior.
  const sentences: RawSentence[] = [];
  for (const raw of splitSentences(flat, markers)) {
    const last = sentences[sentences.length - 1];
    if (!raw.text) {
      if (last) last.ids.push(...raw.ids);
      continue;
    }
    sentences.push(raw);
  }

  const segments: CitedSegment[] = [];
  const lineOf: number[] = [];
  for (const raw of sentences) {
    const cited = [...new Set(raw.ids)];
    const valid = cited.filter((id) => validIds.has(id));
    const invalid = cited.filter((id) => !validIds.has(id));
    segments.push({ text: raw.text, cites: valid, invalidCites: invalid, kind: classify(raw.text, valid.length > 0) });
    lineOf.push(raw.line);
  }
  attributeCitations(segments, lineOf);
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

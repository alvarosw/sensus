// Parsers do resumo estruturado e das respostas (marcadores de linha @secao), tolerantes a streaming.
import { stripCitations } from './citations';
import { parseRichText } from './rich-text';
import {
  SECTION_KEYS,
  type RichTextContext,
  type SectionKey,
  type StructuredAnswer,
  type StructuredSummary,
} from './structured-types';

/** Marcadores do resumo: visão geral, uma linha por seção, perguntas e fim. */
export const SUMMARY_MARKERS: readonly string[] = [
  'visao',
  ...SECTION_KEYS,
  'perguntas',
  'fim',
];

/**
 * Linha de marcador: "@texto", "## @texto", "**@texto**", "@Texto:". Aceita conteúdo na mesma linha.
 * O nome é letras (com acentos); a comparação é feita sem acentos e em minúsculas.
 */
const MARKER_LINE_RE = /^\s*(?:#{1,6}\s*)?(?:\*\*|__)?\s*@\s*(\p{L}+)\s*(?:\*\*|__)?\s*:?\s*(?:\*\*|__)?\s*(.*)$/u;
/** Início de marcador ainda incompleto (ex.: "@tex", "## @", "**@te"): não mostrar até chegar o resto. */
const PARTIAL_MARKER_RE = /^\s*(?:#{1,6}\s*)?(?:\*\*|__)?\s*@\s*\p{L}*\s*(?:\*\*|__)?\s*:?\s*$/u;

export function markerKey(word: string): string {
  return word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export interface MarkerSplit {
  /** Linhas antes do primeiro marcador conhecido. */
  preamble: string[];
  /** Linhas de cada marcador conhecido (sem a linha do marcador, exceto o conteúdo na mesma linha). */
  parts: Map<string, string[]>;
  /** true quando o marcador @fim foi recebido. */
  complete: boolean;
}

/** Separa o texto pelos marcadores conhecidos. Para no @fim; oculta um marcador parcial no fim do stream. */
export function splitMarkers(text: string, known: readonly string[]): MarkerSplit {
  const knownSet = new Set(known);
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const open = text.length > 0 && !text.endsWith('\n');
  const preamble: string[] = [];
  const parts = new Map<string, string[]>();
  let current: string | null = null;
  let complete = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const isLast = i === lines.length - 1;
    const m = MARKER_LINE_RE.exec(line);
    const key = m ? markerKey(m[1]!) : '';
    if (m && knownSet.has(key)) {
      if (key === 'fim') {
        complete = true;
        break;
      }
      current = key;
      if (!parts.has(key)) parts.set(key, []);
      if (m[2]!.trim()) parts.get(key)!.push(m[2]!.trim());
      continue;
    }
    if (isLast && open && PARTIAL_MARKER_RE.test(line)) break;
    if (current === null) preamble.push(line);
    else parts.get(current)!.push(line);
  }
  return { preamble, parts, complete };
}

/** Perguntas: linhas com marcador de lista (ou linhas simples), sem citações e sem negrito. */
export function extractQuestions(lines: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    const text = stripCitations(t)
      .replace(/^(?:[-*•]|\d+[.)])\s+/, '')
      .replace(/\*\*|__/g, '')
      .replace(/^\*+|\*+$/g, '')
      .trim();
    if (text && text !== '@fim') out.push(text);
  }
  return out;
}

/** Perguntas por lente: no máximo duas linhas começando com "? " por seção. */
export const MAX_LENS_QUESTIONS = 2;

/**
 * Separa as linhas "? pergunta" (perguntas da lente) do texto da seção. Linhas com só "?" (início de
 * stream) são descartadas. O restante volta como corpo da seção.
 */
export function splitLensQuestions(lines: readonly string[]): { body: string[]; questions: string[] } {
  const body: string[] = [];
  const questions: string[] = [];
  for (const line of lines) {
    const m = /^\s*\?(\s+(.*))?$/.exec(line);
    if (!m) {
      body.push(line);
      continue;
    }
    const q = extractQuestions([m[2] ?? ''])[0];
    if (q && questions.length < MAX_LENS_QUESTIONS) questions.push(q);
  }
  return { body, questions };
}

/** Linha que começa com "=" (marca da palavra escolhida em @lingua). Sai do texto, mesmo incompleta no stream. */
const KEYWORD_LINE_RE = /^\s*=(?:\s|\[|$)/;
/** Linha "= [[cite_id]]": o id entre os colchetes duplos. */
const KEYWORD_CITE_RE = /^\s*=\s*\[\[([^[\]\n]+)\]\]/;

/**
 * Separa a linha "= [[tok:…]]" das linhas da seção @lingua. Só um cite_id de token que existe no contexto é
 * aceito; as demais linhas com "=" são descartadas sem aparecer no texto.
 */
export function splitKeyWordLine(lines: readonly string[], ctx: RichTextContext): { body: string[]; citeId?: string } {
  const body: string[] = [];
  let citeId: string | undefined;
  for (const line of lines) {
    if (!KEYWORD_LINE_RE.test(line)) {
      body.push(line);
      continue;
    }
    const id = KEYWORD_CITE_RE.exec(line)?.[1]?.trim();
    if (!citeId && id && isKeyWordCite(id, ctx)) citeId = id;
  }
  return citeId ? { body, citeId } : { body };
}

function isKeyWordCite(id: string, ctx: RichTextContext): boolean {
  if (!id.startsWith('tok:') || !ctx.citeIds.has(id)) return false;
  return ctx.tokens ? ctx.tokens.some((t) => t.cite_id === id) : true;
}

/**
 * Resumo: "@visao" (2–3 frases), uma seção por marcador, "@perguntas" e "@fim".
 * Cada lente pode trazer linhas "? pergunta" (sectionQuestions); a visão geral usa a chave 'visao'.
 * A seção @lingua pode começar com "= [[tok:…]]" (keyWordCiteId): a palavra que move o trecho.
 */
export function parseStructuredSummary(text: string, ctx: RichTextContext): StructuredSummary {
  const split = splitMarkers(text, SUMMARY_MARKERS);
  const sectionQuestions: NonNullable<StructuredSummary['sectionQuestions']> = {};
  let keyWordCiteId: string | undefined;

  const overviewLines = splitLensQuestions([...split.preamble, ...(split.parts.get('visao') ?? [])]);
  const overview = parseRichText(overviewLines.body.join('\n'), ctx);
  if (overviewLines.questions.length > 0) sectionQuestions.visao = overviewLines.questions;

  const sections: StructuredSummary['sections'] = {};
  for (const key of SECTION_KEYS as readonly SectionKey[]) {
    const raw = split.parts.get(key);
    if (!raw) continue;
    let part = raw;
    if (key === 'lingua') {
      const kw = splitKeyWordLine(raw, ctx);
      part = kw.body;
      keyWordCiteId = kw.citeId;
    }
    const lens = splitLensQuestions(part);
    sections[key] = parseRichText(lens.body.join('\n'), ctx);
    if (lens.questions.length > 0) sectionQuestions[key] = lens.questions;
  }
  return {
    overview,
    sections,
    questions: extractQuestions(split.parts.get('perguntas') ?? []),
    complete: split.complete,
    sectionQuestions,
    ...(keyWordCiteId ? { keyWordCiteId } : {}),
  };
}

/**
 * Resposta de pergunta ou aprofundamento: texto rico antes de "@perguntas", perguntas de seguimento
 * depois, e "@fim" ao final. Marcadores desconhecidos são tratados como texto comum.
 */
export function parseStructuredAnswer(text: string, ctx: RichTextContext): StructuredAnswer {
  const split = splitMarkers(text, ['perguntas', 'fim']);
  const body = [...split.preamble];
  return {
    blocks: parseRichText(body.join('\n'), ctx),
    followUps: extractQuestions(split.parts.get('perguntas') ?? []),
    complete: split.complete,
  };
}

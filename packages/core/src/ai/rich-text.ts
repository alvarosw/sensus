// Texto rico da resposta da IA: subconjunto de markdown + citações inline, tolerante a streaming.
import type { MorphConflict, Token } from '../types';
import { checkMorphClaims } from './morphcheck';
import { parseCited, safeParseLength, stripInferenceLabels } from './citations';
import type { Block, CiteRef, ClaimInfo, Inline, RichTextContext } from './structured-types';

export type { RichTextContext } from './structured-types';

const CITE_PREFIX = 'txt|tok|lex|com|dic|xr|ent';
const MARKER = `\\[\\[[^\\[\\]\\n]*\\]\\]|\\[(?:${CITE_PREFIX}):[^\\[\\]\\n]*\\]`;
/** Uma sequência de citações consecutivas (separadas só por espaço ou vírgula) forma um grupo. */
const RUN_RE = new RegExp(`(?:${MARKER})(?:[\\s,;]*(?:${MARKER}))*`, 'g');
const ONE_MARKER_RE = new RegExp(MARKER, 'g');
/** Palavras em grego (inclui polytonismo e elisão) ou hebraico. */
const SCRIPT_WORD_RE = /[Ͱ-Ͽἀ-῿֐-׿][Ͱ-Ͽἀ-῿֐-׿\p{M}’']*/gu;
const HEBREW_RE = /[֐-׿]/;
const LINK_RE = /\[([^\]\n]+)\]\(([^)\s\n]*)\)/g;
/** Resto de marcador ao final de um trecho (não deve aparecer como texto). */
const TRAILING_PARTIAL_RE = /\[{1,2}(?:(?:txt|tok|lex|com|dic|xr|ent)(?::[^\[\]\n]*)?)?$/;

/** Normalização para casar palavras do texto com tokens: NFC, sem pontuação, minúsculas. */
export function wordKey(text: string): string {
  return text.normalize('NFC').replace(/[\p{P}\p{S}\s]/gu, '').toLowerCase();
}

function citeIdsOf(marker: string): string[] {
  const inner = marker.startsWith('[[') ? marker.slice(2, -2) : marker.slice(1, -1);
  return inner
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Ano-verso de um id txt (txt:fonte:vid); undefined para os demais. */
function verseOf(citeId: string): { source: string; vid: number } | undefined {
  const m = /^txt:([^:]+):(\d+)$/.exec(citeId);
  return m ? { source: m[1]!, vid: Number(m[2]) } : undefined;
}

/** Monta os chips de um grupo de citações, unindo versículos consecutivos da mesma fonte ("Bíblia Livre 2:5–8"). */
function buildRefs(ids: string[], ctx: RichTextContext): CiteRef[] {
  const refs: CiteRef[] = [];
  let lastVid: number | undefined;
  let lastSource: string | undefined;
  for (const id of [...new Set(ids)]) {
    const valid = ctx.citeIds.has(id);
    const entry = ctx.citeIndex.get(id);
    const verse = verseOf(id);
    const last = refs[refs.length - 1];
    if (
      valid &&
      verse &&
      last &&
      last.valid &&
      lastVid !== undefined &&
      lastSource === verse.source &&
      verse.vid === lastVid + 1 &&
      entry?.short &&
      entry.table === 'verse_text' &&
      ctx.citeIndex.get(last.citeId)?.refLabel
    ) {
      const first = ctx.citeIndex.get(last.citeId)!;
      last.citeIds = [...(last.citeIds ?? [last.citeId]), id];
      last.label = `${first.short} ${first.refLabel}–${verse.vid % 1000}`;
      lastVid = verse.vid;
      continue;
    }
    refs.push({ citeId: id, label: entry?.label ?? id, valid, citeIds: [id] });
    lastVid = verse && valid ? verse.vid : undefined;
    lastSource = verse?.source;
  }
  return refs.map((r) => (r.citeIds && r.citeIds.length === 1 ? { ...r, citeIds: undefined } : r));
}

interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

/** Negrito, itálico e código dentro de um trecho sem citações. */
function emphasisSpans(text: string): Span[] {
  const spans: Span[] = [];
  const parts = text.split(/`([^`\n]+)`/);
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      spans.push({ text: part });
      return;
    }
    const cleaned = part.replace(LINK_RE, '$1').replace(/<[^>]+>/g, '');
    const re = /\*\*(.+?)\*\*|__(.+?)__|(?<![\p{L}\p{N}])\*([^*\n]+?)\*(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])_([^_\n]+?)_(?![\p{L}\p{N}])/gu;
    let last = 0;
    for (const m of cleaned.matchAll(re)) {
      if (m.index > last) spans.push({ text: cleaned.slice(last, m.index) });
      if (m[1] !== undefined || m[2] !== undefined) spans.push({ text: (m[1] ?? m[2])!, bold: true });
      else spans.push({ text: (m[3] ?? m[4])!, italic: true });
      last = m.index + m[0].length;
    }
    if (last < cleaned.length) spans.push({ text: cleaned.slice(last) });
  });
  return spans;
}

/** Divide um trecho de texto em palavras originais (grego/hebraico, com token quando casa) e texto comum. */
function scriptInlines(span: Span, tokenByKey: ReadonlyMap<string, string>): Inline[] {
  const out: Inline[] = [];
  const flags = { ...(span.bold ? { bold: true } : {}), ...(span.italic ? { italic: true } : {}) };
  const text = span.text.replace(TRAILING_PARTIAL_RE, '');
  let last = 0;
  for (const m of text.matchAll(SCRIPT_WORD_RE)) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index), ...flags });
    const word = m[0];
    out.push({
      type: 'original',
      text: word,
      lang: HEBREW_RE.test(word) ? 'hbo' : 'grc',
      ...(tokenByKey.has(wordKey(word)) ? { tokenCiteId: tokenByKey.get(wordKey(word)) } : {}),
      ...flags,
    });
    last = m.index + word.length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last), ...flags });
  return out;
}

/** Junta textos vizinhos com a mesma formatação. */
function mergeText(inlines: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const inl of inlines) {
    const prev = out[out.length - 1];
    if (
      inl.type === 'text' &&
      prev?.type === 'text' &&
      !!prev.bold === !!inl.bold &&
      !!prev.italic === !!inl.italic
    ) {
      prev.text += inl.text;
    } else if (inl.type !== 'text' || inl.text) {
      out.push({ ...inl });
    }
  }
  return out;
}

/** Último grupo de citações do trecho, se só houver espaços depois dele. Iguais ao novo grupo = duplicata. */
function sameAsPreviousCite(out: readonly Inline[], refs: CiteRef[]): boolean {
  for (let i = out.length - 1; i >= 0; i--) {
    const inl = out[i]!;
    if (inl.type === 'text' && !inl.text.trim()) continue;
    if (inl.type !== 'cite') return false;
    const key = (rs: readonly CiteRef[]) => rs.map((r) => `${r.citeId}|${r.label}|${r.valid}`).join(',');
    return key(inl.refs) === key(refs);
  }
  return false;
}

/** Converte um trecho inline (com citações, negrito, itálico) em Inlines. */
export function parseInline(raw: string, ctx: RichTextContext, tokenByKey: ReadonlyMap<string, string>): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  const pushText = (chunk: string): void => {
    for (const span of emphasisSpans(chunk)) out.push(...scriptInlines(span, tokenByKey));
  };
  for (const m of raw.matchAll(RUN_RE)) {
    pushText(raw.slice(last, m.index));
    const ids = [...m[0].matchAll(ONE_MARKER_RE)].flatMap((x) => citeIdsOf(x[0]));
    if (ids.length > 0) {
      const refs = buildRefs(ids, ctx);
      // Mesma fonte repetida logo em seguida (só espaço entre elas): um chip só, não dois lado a lado.
      if (!sameAsPreviousCite(out, refs)) out.push({ type: 'cite', refs });
    }
    last = m.index + m[0].length;
  }
  pushText(raw.slice(last));
  return mergeText(out);
}

/**
 * Classificação de confiabilidade do bloco a partir das frases (ver parseCited e attributeCitations).
 * - inference: não há frase factual; há frase de inferência (o bloco inteiro ganha a moldura);
 * - source: há frases factuais e nenhuma sem citação (frases de inferência, se houver, são destacadas);
 * - mixed: há ao menos uma frase factual sem citação; `uncited` lista exatamente essas frases;
 * - structure: só títulos, rótulos, perguntas e avisos.
 */
export function claimOf(raw: string, ctx: RichTextContext, tokenMap: ReadonlyMap<string, Token>): ClaimInfo {
  const segments = parseCited(raw, ctx.citeIds);
  const checked = checkMorphClaims(segments, tokenMap);
  const conflicts: MorphConflict[] = [];
  for (const s of checked) {
    for (const c of s.morphConflicts ?? []) {
      if (!conflicts.some((x) => x.term === c.term && x.expected === c.expected)) conflicts.push(c);
    }
  }
  const factual = segments.filter((s) => s.kind === 'source' || s.kind === 'uncited');
  const uncited = segments.filter((s) => s.kind === 'uncited').map((s) => s.text);
  const inference = segments.filter((s) => s.kind === 'inference').map((s) => s.text);
  let kind: ClaimInfo['kind'];
  if (factual.length === 0) kind = inference.length > 0 ? 'inference' : 'structure';
  else kind = uncited.length > 0 ? 'mixed' : 'source';
  return { kind, uncited, inference, morphConflicts: conflicts };
}

/** Texto a exibir de uma afirmação: sem o rótulo quando a moldura de inferência já o mostra. */
function displayText(text: string, claim: ClaimInfo): string {
  const shown = claim.kind === 'inference' ? stripInferenceLabels(text) : text;
  return shown.replace(/[ \t]{2,}/g, ' ');
}

type Acc =
  | { kind: 'para' | 'quote'; lines: string[] }
  | { kind: 'list'; ordered: boolean; items: string[] };

/**
 * Converte texto da IA em blocos. Subconjunto de markdown: títulos (#, ##, ###), **negrito**, *itálico*,
 * listas (-, *, 1.), citações (>), parágrafos. Tabelas viram parágrafos; cercas de código viram texto.
 * Streaming: a última linha sem quebra é tratada como em andamento (marcadores incompletos são ocultos).
 */
export function parseRichText(text: string, ctx: RichTextContext): Block[] {
  const tokenMap = new Map<string, Token>((ctx.tokens ?? []).map((t) => [t.cite_id, t]));
  const tokenByKey = new Map<string, string>();
  for (const t of ctx.tokens ?? []) {
    const key = wordKey(t.surface);
    if (key && !tokenByKey.has(key)) tokenByKey.set(key, t.cite_id);
  }

  const lines = text.normalize('NFC').replace(/\r\n?/g, '\n').split('\n');
  if (text.length > 0 && !text.endsWith('\n')) {
    const i = lines.length - 1;
    lines[i] = lines[i]!.slice(0, safeParseLength(lines[i]!));
  }

  const blocks: Block[] = [];
  let acc: Acc | null = null;
  let inFence = false;

  const flush = (): void => {
    if (!acc) return;
    if (acc.kind === 'list') {
      const items = acc.items
        .filter((t) => t.trim())
        .map((t) => {
          const claim = claimOf(t, ctx, tokenMap);
          return { inlines: parseInline(displayText(t, claim), ctx, tokenByKey), claim };
        })
        .filter((i) => i.inlines.length > 0);
      if (items.length > 0) blocks.push({ type: 'list', ordered: acc.ordered, items });
    } else {
      const joined = acc.lines.join(' ').trim();
      if (joined) {
        const claim = claimOf(joined, ctx, tokenMap);
        const inlines = parseInline(displayText(joined, claim), ctx, tokenByKey);
        if (inlines.length > 0) {
          blocks.push(acc.kind === 'quote' ? { type: 'quote', inlines, claim } : { type: 'paragraph', inlines, claim });
        }
      }
    }
    acc = null;
  };

  for (const raw of lines) {
    if (/^\s*```/.test(raw)) {
      flush();
      inFence = !inFence;
      continue;
    }
    const t = raw.trim();
    if (inFence) {
      if (!t) flush();
      else if (!acc || acc.kind !== 'para') {
        flush();
        acc = { kind: 'para', lines: [t] };
      } else acc.lines.push(t);
      continue;
    }
    if (!t) {
      flush();
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      flush();
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(t);
    if (heading) {
      flush();
      const inlines = parseInline(heading[2]!.replace(/\s+#+\s*$/, ''), ctx, tokenByKey);
      if (inlines.length > 0) {
        blocks.push({ type: 'heading', level: Math.min(3, heading[1]!.length) as 1 | 2 | 3, inlines });
      }
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(t);
    if (quote) {
      if (acc?.kind !== 'quote') {
        flush();
        acc = { kind: 'quote', lines: [] };
      }
      acc.lines.push(quote[1]!);
      continue;
    }
    const bullet = /^[-*+•]\s+(.*)$/.exec(t);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(t);
    if (bullet || numbered) {
      const ordered = !!numbered;
      if (acc?.kind !== 'list' || acc.ordered !== ordered) {
        flush();
        acc = { kind: 'list', ordered, items: [] };
      }
      acc.items.push((bullet ?? numbered)![1]!);
      continue;
    }
    if (acc?.kind === 'list' && /^\s{2,}\S/.test(raw) && acc.items.length > 0) {
      acc.items[acc.items.length - 1] += ` ${t}`;
      continue;
    }
    if (t.startsWith('|')) {
      if (/^\|?[\s:|-]+\|?$/.test(t) && t.includes('-')) continue; // linha separadora de tabela
      // Cada linha de tabela vira um parágrafo próprio, com as células separadas por "; ".
      const cells = t.split('|').map((c) => c.trim()).filter(Boolean).join('; ');
      flush();
      if (cells) acc = { kind: 'para', lines: [cells] };
      continue;
    }
    if (acc?.kind !== 'para') {
      flush();
      acc = { kind: 'para', lines: [] };
    }
    acc.lines.push(t);
  }
  flush();
  return blocks;
}

/** Texto puro de um bloco (citações viram "[rótulo]"), para o terminal ou para cópia. */
export function blocksToPlainText(blocks: readonly Block[]): string {
  const inlinesText = (inlines: Inline[]): string =>
    inlines
      .map((i) => {
        if (i.type === 'cite') return `[${i.refs.map((r) => (r.valid ? r.label : `inválida: ${r.citeId}`)).join('; ')}]`;
        return i.text;
      })
      .join('');
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'heading':
          return `${'#'.repeat(b.level)} ${inlinesText(b.inlines)}`;
        case 'paragraph':
          return inlinesText(b.inlines);
        case 'quote':
          return `> ${inlinesText(b.inlines)}`;
        case 'list':
          return b.items.map((it, i) => `${b.ordered ? `${i + 1}.` : '-'} ${inlinesText(it.inlines)}`).join('\n');
      }
    })
    .join('\n\n');
}

/** Todos os blocos de parágrafo, item e citação (com classificação), para validação. */
export function claimsOf(blocks: readonly Block[]): ClaimInfo[] {
  return blocks.flatMap((b) => {
    if (b.type === 'heading') return [];
    if (b.type === 'list') return b.items.map((i) => i.claim);
    return [b.claim];
  });
}

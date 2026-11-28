// Texto que sai ao copiar ou compartilhar: o trecho bíblico (com ou sem números) e a síntese da IA em texto simples.
// Funções puras: a tela só mostra a prévia e entrega o texto à área de transferência ou à folha do sistema.
// Formato aprovado em docs/design/1a-copiar-compartilhar.html.
import {
  DEFAULT_APP_LANG,
  bookAbbrOf,
  splitVid,
  type AppLang,
  type Block,
  type CiteIndexEntry,
  type CiteRef,
  type Inline,
  type Vid,
} from '@sensus/core';

const SUPERSCRIPT = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'] as const;

/** Número em algarismos sobrescritos: 12 → "¹²". */
export function superscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUPERSCRIPT[Number(d)] ?? d)
    .join('');
}

/**
 * Referência curta no idioma pedido, com travessão: "Fp 2:5", "Fp 2:5–8", "Fp 1:27–2:4", "Fp 4:23 – Cl 1:1".
 * A abreviação do livro vem do domínio (bookAbbrOf).
 */
export function shareRef(start: Vid, end: Vid, lang: AppLang = DEFAULT_APP_LANG): string {
  const s = splitVid(start);
  const e = splitVid(end);
  const a = bookAbbrOf(s.book, lang);
  if (s.book !== e.book) return `${a} ${s.chapter}:${s.verse} – ${bookAbbrOf(e.book, lang)} ${e.chapter}:${e.verse}`;
  if (s.chapter !== e.chapter) return `${a} ${s.chapter}:${s.verse}–${e.chapter}:${e.verse}`;
  if (s.verse === e.verse) return `${a} ${s.chapter}:${s.verse}`;
  return `${a} ${s.chapter}:${s.verse}–${e.verse}`;
}

export interface ShareVerse {
  vid: Vid;
  text: string;
}

export interface VerseShareInput {
  verses: readonly ShareVerse[];
  start: Vid;
  end: Vid;
  /** Sigla da Bíblia ("BLivre", "KJV"). */
  bible: string;
  /** Números dos versículos (sobrescritos). */
  numbers: boolean;
  lang?: AppLang;
}

/** Espaços e quebras do texto da edição viram um espaço só (ex.: título de salmo com linha em branco). */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Trecho para copiar ou compartilhar: o texto e, na linha de baixo, "Fp 2:5–8 (BLivre)". Com números, cada versículo
 * começa com o número sobrescrito; quando o trecho passa de capítulo, o primeiro versículo do capítulo novo leva
 * "capítulo:versículo" para o capítulo não se perder.
 */
export function verseShareText({ verses, start, end, bible, numbers, lang = DEFAULT_APP_LANG }: VerseShareInput): string {
  let prevChapter: number | null = null;
  const parts: string[] = [];
  for (const v of verses) {
    const text = oneLine(v.text);
    if (!text) continue;
    const { chapter, verse } = splitVid(v.vid);
    if (numbers) {
      const mark = prevChapter !== null && chapter !== prevChapter ? `${chapter}:${verse}` : superscript(verse);
      parts.push(`${mark} ${text}`);
    } else {
      parts.push(text);
    }
    prevChapter = chapter;
  }
  return `${parts.join(' ')}\n${shareRef(start, end, lang)} (${bible})`;
}

// ---- síntese da IA ------------------------------------------------------------------------------------

/** Uma parte da síntese: título opcional (passo do fio) e os blocos da IA. */
export interface SynthPart {
  heading?: string;
  blocks: readonly Block[];
}

/** Textos fixos da síntese, no idioma do app. */
export interface SynthLabels {
  sources: string;
  inference: string;
  aiFooter: string;
  via: string;
}

export interface SynthShareInput {
  /** Primeira linha, ex.: "Fp 2:5–11 · Visão geral". */
  title: string;
  parts: readonly SynthPart[];
  labels: SynthLabels;
  /** Linha da fonte em "Fontes" (padrão: o rótulo da citação). */
  describe?: (ref: CiteRef) => string;
}

/**
 * Linha de uma fonte em "Fontes": o rótulo da citação e, quando ele não a diz, a obra ("Henry · Matthew Henry's
 * Complete Commentary…"). Sem registro no índice, só o rótulo.
 */
export function describeCiteEntry(entry: CiteIndexEntry | undefined, label: string): string {
  const title = entry?.sourceTitle?.trim();
  if (!title || label.toLowerCase().includes(title.toLowerCase())) return label;
  return `${label} · ${title}`;
}

/** Numeração das fontes na ordem em que aparecem; a mesma fonte citada de novo repete o número. */
class SourceList {
  private readonly order = new Map<string, { n: number; ref: CiteRef }>();

  number(ref: CiteRef): number {
    const key = ref.citeIds?.join('|') ?? ref.citeId;
    let entry = this.order.get(key);
    if (!entry) {
      entry = { n: this.order.size + 1, ref };
      this.order.set(key, entry);
    }
    return entry.n;
  }

  lines(describe: (ref: CiteRef) => string): string[] {
    return [...this.order.values()].map(({ n, ref }) => `[${n}] ${describe(ref)}`);
  }

  get size(): number {
    return this.order.size;
  }
}

/** Inlines em texto simples; citações viram [n] (as inválidas somem). */
function inlinesText(inlines: readonly Inline[], sources: SourceList): string {
  let out = '';
  let lastWasCite = false;
  for (const il of inlines) {
    if (il.type === 'cite') {
      const marks = il.refs.filter((r) => r.valid).map((r) => `[${sources.number(r)}]`);
      if (marks.length === 0) continue;
      if (!lastWasCite) out = `${out.replace(/\s+$/, '')} `;
      out += marks.join('');
      lastWasCite = true;
      continue;
    }
    out += il.text;
    lastWasCite = false;
  }
  return out.replace(/[ \t]+/g, ' ').trim();
}

function blockText(block: Block, sources: SourceList, inference: string): string {
  switch (block.type) {
    case 'heading':
      return inlinesText(block.inlines, sources);
    case 'paragraph':
    case 'quote': {
      const text = inlinesText(block.inlines, sources);
      return block.claim.kind === 'inference' ? `${inference} ${text}` : text;
    }
    case 'list':
      return block.items
        .map((item, i) => {
          const text = inlinesText(item.inlines, sources);
          const mark = block.ordered ? `${i + 1}.` : '-';
          return `${mark} ${item.claim.kind === 'inference' ? `${inference} ${text}` : text}`;
        })
        .join('\n');
  }
}

/**
 * Síntese em texto simples: título, as partes (cada uma com o seu título, quando há), "Fontes" numeradas na ordem
 * de citação, a linha de IA e "via Sensus". Partes sem blocos são omitidas; sem citações, não há "Fontes".
 */
export function synthShareText({ title, parts, labels, describe = (r) => r.label }: SynthShareInput): string {
  const sources = new SourceList();
  const chunks: string[] = [title];
  for (const part of parts) {
    const body = part.blocks.map((b) => blockText(b, sources, labels.inference)).filter((t) => t.length > 0);
    if (body.length === 0) continue;
    chunks.push(part.heading ? `${part.heading}\n${body.join('\n\n')}` : body.join('\n\n'));
  }
  if (sources.size > 0) chunks.push(`${labels.sources}\n${sources.lines(describe).join('\n')}`);
  chunks.push(`${labels.aiFooter}\n${labels.via}`);
  return chunks.join('\n\n');
}

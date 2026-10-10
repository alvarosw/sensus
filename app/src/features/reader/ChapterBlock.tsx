// Um capítulo do leitor contínuo: cabeçalho do livro (no capítulo 1), marcador de capítulo e os
// parágrafos. Versículos são texto aninhado (fluxo contínuo, como no protótipo).
// Posição dos versículos: na web, marcadores inline no DOM; no nativo, as linhas do texto disposto
// (onTextLayout) dão y exato de cada linha e x aproximado pela contagem de caracteres. Marcadores inline
// de View no nativo quebrariam o realce de seleção (lacunas) e não são medidos de forma confiável.
import { memo, useCallback, useEffect, useMemo, useRef, type ReactElement } from 'react';
import { Platform, Text, View, type LayoutChangeEvent } from 'react-native';
import { BOOK_TABLE, splitVid, type Token, type VerseText, type Vid } from '@sensus/core';
import { fontFamilies, gutter, radius, type, useTheme } from '@/design';
import type { FlowBlock } from '../nav/verse-flow';
import type { ChapterData } from './chapters';
import { LINE, type ReaderGeometry } from './geometry';
import { READER } from './strings';

const WJ = '⁠'; // junta o marcador inline ao texto vizinho (sem quebra de linha entre eles)
const SUP = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
/** Número do versículo em dígitos sobrescritos (mesma aparência em todas as plataformas). */
export function supNumber(n: number): string {
  return String(n).replace(/\d/g, (d) => SUP[Number(d)] ?? d);
}
/** Os dígitos sobrescritos de Manrope são ~60% do corpo: escalamos o corpo do token `verseNumber`. */
const SUP_SIZE = Math.round(type.verseNumber.fontSize * 1.75 * 2) / 2;

type Item =
  | { kind: 'heading'; key: string; title: string }
  | { kind: 'run'; key: string; verses: VerseText[]; endsParagraph: boolean }
  | { kind: 'greek'; key: string; vid: Vid; tokens: Token[]; endsParagraph: boolean };

/** Divide os parágrafos em trechos; o grego do TR abre um bloco sob o versículo selecionado. */
function buildItems(blocks: FlowBlock[], greek: Record<number, Token[]> | undefined, selStart: Vid, selEnd: Vid): Item[] {
  const out: Item[] = [];
  for (const b of blocks) {
    if (b.kind === 'heading') {
      out.push({ kind: 'heading', key: b.key, title: b.title });
      continue;
    }
    let cur: VerseText[] = [];
    for (const v of b.verses) {
      cur.push(v);
      const toks = greek && v.vid >= selStart && v.vid <= selEnd ? greek[v.vid] : undefined;
      if (toks && toks.length > 0) {
        out.push({ kind: 'run', key: `r${cur[0]!.vid}`, verses: cur, endsParagraph: false });
        out.push({ kind: 'greek', key: `g${v.vid}`, vid: v.vid, tokens: toks, endsParagraph: false });
        cur = [];
      }
    }
    if (cur.length > 0) out.push({ kind: 'run', key: `r${cur[0]!.vid}`, verses: cur, endsParagraph: true });
    else {
      const last = out[out.length - 1];
      if (last && last.kind === 'greek') last.endsParagraph = true;
    }
  }
  return out;
}

export interface ChapterBlockProps {
  data: ChapterData;
  geo: ReaderGeometry;
  sourceName: string;
  /** Seleção recortada ao capítulo (0 = sem seleção aqui). */
  selStart: Vid;
  selEnd: Vid;
  flashVid: Vid;
  greek?: Record<number, Token[]>;
  onVerse: (vid: Vid) => void;
  onWord: (citeId: string) => void;
}

export const ChapterBlock = memo(function ChapterBlock({ data, geo, sourceName, selStart, selEnd, flashVid, greek, onVerse, onWord }: ChapterBlockProps) {
  const { c } = useTheme();
  const items = useMemo(() => buildItems(data.blocks, greek, selStart, selEnd), [data.blocks, greek, selStart, selEnd]);
  const book = BOOK_TABLE[data.book - 1]!;
  const first = data.chapter === 1;
  const prev = first && data.book > 1 ? BOOK_TABLE[data.book - 2] : undefined;

  useEffect(() => () => geo.clearCell(data.idx), [geo, data.idx]);

  return (
    <View testID={`chapter-${data.book}-${data.chapter}`} style={{ paddingHorizontal: 0 }}>
      {first && (
        <View>
          {prev && (
            <Text style={{ fontFamily: fontFamilies.ui, fontSize: 12, color: c.muted, textAlign: 'center', paddingTop: 10, paddingBottom: 18, letterSpacing: 0.24 }}>
              {READER.bookEdge(prev.name_pt, prev.chapters)}
            </Text>
          )}
          <Text accessibilityRole="header" style={{ ...type.bookTitle, color: c.text, textAlign: 'center', marginTop: prev ? 4 : 0, marginBottom: 2 }}>
            {book.name_pt}
          </Text>
          <Text style={{ fontFamily: fontFamilies.ui, fontSize: 12, lineHeight: 18, color: c.muted, textAlign: 'center', marginBottom: 18 }}>
            {READER.bookSub(sourceName)}
          </Text>
        </View>
      )}
      <ChapterMarker book={book.name_pt} chapter={data.chapter} onY={(y) => geo.setMarker(data.idx, y)} first={first} geo={geo} idx={data.idx} />
      {items.map((it) =>
        it.kind === 'heading' ? (
          <Text key={it.key} style={{ fontFamily: fontFamilies.readItalic, fontSize: 15.5, lineHeight: 24, color: c.muted, paddingHorizontal: gutter.reader, marginBottom: 8 }}>
            {it.title}
          </Text>
        ) : it.kind === 'run' ? (
          <Run key={it.key} runKey={`${data.idx}:${it.key}`} verses={it.verses} endsParagraph={it.endsParagraph} geo={geo} selStart={selStart} selEnd={selEnd} flashVid={flashVid} onVerse={onVerse} />
        ) : (
          <GreekLine key={it.key} tokens={it.tokens} endsParagraph={it.endsParagraph} onWord={onWord} />
        ),
      )}
    </View>
  );
});

function ChapterMarker({ book, chapter, onY, first, geo, idx }: { book: string; chapter: number; onY: (y: number) => void; first: boolean; geo: ReaderGeometry; idx: number }) {
  const { c } = useTheme();
  return (
    <View
      ref={Platform.OS === 'web' ? (n) => geo.setWebNode('chapter', idx, n as unknown as HTMLElement | null) : undefined}
      onLayout={(e: LayoutChangeEvent) => onY(e.nativeEvent.layout.y)}
      accessibilityRole="header"
      accessibilityLabel={`${book} ${chapter}`}
      style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: first ? 0 : 30, marginBottom: 8, paddingHorizontal: gutter.reader }}
    >
      <Text style={{ ...type.chapterNumber, lineHeight: 34, color: c.accent }}>{chapter}</Text>
      <Text style={{ fontFamily: fontFamilies.ui, fontSize: 12, lineHeight: 16, letterSpacing: 0.96, textTransform: 'uppercase', color: c.muted }}>
        {book} {chapter}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
    </View>
  );
}

// ---- posição dos versículos ----

/** Texto do trecho exatamente como é renderizado (para casar com as linhas do nativo). */
interface Flow {
  flat: string;
  /** Índice do primeiro caractere (marcador de junção) de cada versículo. */
  first: number[];
  /** Índice do último caractere (marcador de junção) de cada versículo. */
  last: number[];
}

function flowOf(verses: VerseText[]): Flow {
  let flat = '';
  const first: number[] = [];
  const last: number[] = [];
  verses.forEach((v, i) => {
    first.push(flat.length);
    flat += WJ + supNumber(splitVid(v.vid).verse) + ' ' + v.text + WJ;
    last.push(flat.length - 1);
    if (i < verses.length - 1) flat += ' ';
  });
  return { flat, first, last };
}

interface LayoutLine {
  text?: string;
  x: number;
  y: number;
  width: number;
}

const isWs = (ch: string): boolean => ch === ' ' || ch === ' ' || ch === '\n' || ch === '\t';
const isSkippable = (ch: string): boolean => isWs(ch) || ch === WJ;

/**
 * Intervalo [a, b) de cada linha dentro de `flat`. Casa o texto da linha com o texto do trecho, caractere
 * a caractere; espaços e marcadores de junção que a quebra de linha descarta são pulados.
 */
function lineSpans(lines: LayoutLine[], flat: string): Array<{ a: number; b: number }> {
  const spans: Array<{ a: number; b: number }> = [];
  let p = 0;
  for (const line of lines) {
    const a = p;
    const text = line.text ?? '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]!;
      const same = (x: string) => x === ch || (isWs(x) && isWs(ch));
      let q = p;
      while (q < flat.length && !same(flat[q]!) && isSkippable(flat[q]!)) q++;
      if (q < flat.length && same(flat[q]!)) p = q + 1;
    }
    spans.push({ a, b: p });
  }
  return spans;
}

function lineIndexOf(spans: Array<{ a: number; b: number }>, k: number): number {
  for (let i = 0; i < spans.length; i++) if (k >= spans[i]!.a && k < spans[i]!.b) return i;
  return Math.max(0, spans.length - 1);
}

/** Posição (x relativo ao trecho, y da linha de base) de cada versículo, a partir das linhas dispostas. */
function versePoints(lines: LayoutLine[], flow: Flow, count: number): Array<{ sx: number; sy: number; ex: number; ey: number } | null> {
  const spans = lineSpans(lines, flow.flat);
  const at = (k: number, boundary: boolean) => {
    const i = lineIndexOf(spans, k);
    const line = lines[i];
    const span = spans[i];
    if (!line || !span) return null;
    const len = Math.max(1, span.b - span.a);
    // Fração da linha até o caractere (borda esquerda) ou até o fim dele (borda direita).
    const frac = Math.min(1, Math.max(0, (k + (boundary ? 1 : 0) - span.a) / len));
    return { x: line.x + frac * line.width, y: line.y + LINE.baseline - 1 };
  };
  const out: Array<{ sx: number; sy: number; ex: number; ey: number } | null> = [];
  for (let i = 0; i < count; i++) {
    const s = at(flow.first[i]! + 1, false);
    const e = at(flow.last[i]! - 1, true);
    out.push(s && e ? { sx: s.x, sy: s.y, ex: e.x, ey: e.y } : null);
  }
  return out;
}

/** Trecho de texto de um parágrafo; cada versículo é texto aninhado com realce próprio. */
const Run = memo(function Run({
  runKey,
  verses,
  endsParagraph,
  geo,
  selStart,
  selEnd,
  flashVid,
  onVerse,
}: {
  runKey: string;
  verses: VerseText[];
  endsParagraph: boolean;
  geo: ReaderGeometry;
  selStart: Vid;
  selEnd: Vid;
  flashVid: Vid;
  onVerse: (vid: Vid) => void;
}) {
  const { c } = useTheme();
  useEffect(() => () => geo.removeRun(runKey), [geo, runKey]);
  const flow = useMemo(() => flowOf(verses), [verses]);

  // Nativo: ao dispor o texto, grava a posição de início e fim de cada versículo (relativa ao trecho).
  const onTextLayout = useCallback(
    (e: { nativeEvent: { lines: LayoutLine[] } }) => {
      if (Platform.OS === 'web') return;
      const pts = versePoints(e.nativeEvent.lines, flow, verses.length);
      verses.forEach((v, i) => {
        const p = pts[i];
        if (!p) return;
        geo.setMark('start', v.vid, runKey, gutter.reader + p.sx, p.sy);
        geo.setMark('end', v.vid, runKey, gutter.reader + p.ex, p.ey);
      });
    },
    [geo, runKey, flow, verses],
  );

  const nodes: ReactElement[] = [];
  verses.forEach((v, i) => {
    const n = splitVid(v.vid).verse;
    const selected = selStart > 0 && v.vid >= selStart && v.vid <= selEnd;
    const flash = v.vid === flashVid;
    // Na web, marcadores inline medem a posição pelo DOM; no nativo a posição vem de onTextLayout.
    if (Platform.OS === 'web') nodes.push(<Marker key={`s${v.vid}`} geo={geo} kind="start" vid={v.vid} run={runKey} />);
    nodes.push(
      <Text
        key={`v${v.vid}`}
        testID={`verse-${v.vid}`}
        // Na web, role=button vira <button> (atômico, não quebra entre linhas).
        accessibilityRole={Platform.OS === 'web' ? undefined : 'button'}
        accessibilityLabel={`${READER.verse(n)}. ${v.text}`}
        accessibilityState={{ selected }}
        onPress={() => onVerse(v.vid)}
        style={{ backgroundColor: selected ? c.selected : flash ? c.highlight : undefined, borderRadius: radius.xs }}
      >
        {WJ}
        <Text style={{ fontFamily: fontFamilies.uiBold, fontSize: SUP_SIZE, lineHeight: SUP_SIZE, color: selected ? c.accent : c.muted }}>{supNumber(n)}{' '}</Text>
        {v.text}
        {WJ}
      </Text>,
    );
    if (Platform.OS === 'web') nodes.push(<Marker key={`e${v.vid}`} geo={geo} kind="end" vid={v.vid} run={runKey} />);
    if (i < verses.length - 1) {
      // O espaço entre versículos também é pintado quando os dois lados estão selecionados (sem fresta branca).
      const next = verses[i + 1]!;
      const joined = selected && selStart > 0 && next.vid >= selStart && next.vid <= selEnd;
      nodes.push(
        <Text key={`sp${v.vid}`} style={joined ? { backgroundColor: c.selected } : undefined}>
          {' '}
        </Text>,
      );
    }
  });
  return (
    <View onLayout={(e) => geo.setRun(runKey, e.nativeEvent.layout.y)} style={{ paddingHorizontal: gutter.reader, marginBottom: endsParagraph ? 14 : 0 }}>
      <Text selectable={false} onTextLayout={onTextLayout} style={{ ...type.scripture, color: c.text }}>
        {nodes}
      </Text>
    </View>
  );
});

/** Marcador inline de 1×1 no início/fim de um versículo (somente web: posição pelo DOM). */
function Marker({ geo, kind, vid, run }: { geo: ReaderGeometry; kind: 'start' | 'end'; vid: Vid; run: string }) {
  useEffect(
    () => () => {
      geo.removeMark(kind, vid, run);
    },
    [geo, kind, vid, run],
  );
  return (
    <View
      ref={(n) => geo.setWebNode(kind, vid, n as unknown as HTMLElement | null)}
      accessible={false}
      importantForAccessibility="no"
      style={{ width: 1, height: 1, display: 'inline-flex' } as object}
    />
  );
}

function GreekLine({ tokens, endsParagraph, onWord }: { tokens: Token[]; endsParagraph: boolean; onWord: (citeId: string) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ paddingHorizontal: gutter.reader, marginTop: 2, marginBottom: endsParagraph ? 14 : 6 }}>
      <View style={{ paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: c.border }}>
        <Text testID="greek-line" selectable={false} style={{ fontFamily: fontFamilies.greek, fontSize: 16, lineHeight: 25.6, color: c.muted }}>
          {tokens.map((t, i) => (
            <Text key={t.cite_id} testID={`greek-${t.cite_id}`} accessibilityRole={Platform.OS === 'web' ? undefined : 'button'} accessibilityLabel={t.surface} onPress={() => onWord(t.cite_id)} style={{ color: c.text }}>
              {t.surface}
              {i < tokens.length - 1 ? ' ' : ''}
            </Text>
          ))}
        </Text>
      </View>
    </View>
  );
}

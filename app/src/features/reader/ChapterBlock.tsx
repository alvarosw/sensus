// Um capítulo do leitor contínuo: cabeçalho do livro (no capítulo 1), marcador de capítulo e os
// parágrafos. Versículos são texto aninhado (fluxo contínuo, como no protótipo); marcadores inline
// de 1×1 no início e no fim de cada versículo informam a posição para alças e rolagem.
import { memo, useEffect, useMemo, type ReactElement } from 'react';
import { Platform, Text, View, type LayoutChangeEvent } from 'react-native';
import { BOOK_TABLE, splitVid, type Token, type VerseText, type Vid } from '@sensus/core';
import { fontFamilies, gutter, radius, type, useTheme } from '@/design';
import { abbrOf } from '../nav/abbrev';
import type { FlowBlock } from '../nav/verse-flow';
import type { ChapterData } from './chapters';
import type { ReaderGeometry } from './geometry';
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
          <Run key={it.key} idx={data.idx} runKey={`${data.idx}:${it.key}`} verses={it.verses} endsParagraph={it.endsParagraph} geo={geo} selStart={selStart} selEnd={selEnd} flashVid={flashVid} onVerse={onVerse} />
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

// Na web a View é `display:flex` (bloco): precisa ser inline para não quebrar a linha.
const MARKER_STYLE = (Platform.OS === 'web' ? { width: 1, height: 1, display: 'inline-flex' } : { width: 1, height: 1 }) as object;

function Marker({ geo, kind, vid, run }: { geo: ReaderGeometry; kind: 'start' | 'end'; vid: Vid; run: string }) {
  useEffect(
    () => () => {
      geo.removeMark(kind, vid, run);
    },
    [geo, kind, vid, run],
  );
  return (
    <View
      ref={Platform.OS === 'web' ? (n) => geo.setWebNode(kind, vid, n as unknown as HTMLElement | null) : undefined}
      accessible={false}
      importantForAccessibility="no"
      onLayout={(e) => geo.setMark(kind, vid, run, gutter.reader + e.nativeEvent.layout.x, e.nativeEvent.layout.y)}
      style={MARKER_STYLE}
    />
  );
}

const Run = memo(function Run({
  idx,
  runKey,
  verses,
  endsParagraph,
  geo,
  selStart,
  selEnd,
  flashVid,
  onVerse,
}: {
  idx: number;
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
  const nodes: ReactElement[] = [];
  verses.forEach((v, i) => {
    const n = splitVid(v.vid).verse;
    const selected = selStart > 0 && v.vid >= selStart && v.vid <= selEnd;
    const flash = v.vid === flashVid;
    nodes.push(<Marker key={`s${v.vid}`} geo={geo} kind="start" vid={v.vid} run={runKey} />);
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
        <Text style={{ fontFamily: fontFamilies.uiBold, fontSize: SUP_SIZE, lineHeight: SUP_SIZE, color: selected ? c.accent : c.muted }}>{supNumber(n)}{'\u00A0'}</Text>
        {v.text}
        {WJ}
      </Text>,
    );
    nodes.push(<Marker key={`e${v.vid}`} geo={geo} kind="end" vid={v.vid} run={runKey} />);
    if (i < verses.length - 1) nodes.push(<Text key={`sp${v.vid}`}> </Text>);
  });
  return (
    <View onLayout={(e) => geo.setRun(runKey, e.nativeEvent.layout.y)} style={{ paddingHorizontal: gutter.reader, marginBottom: endsParagraph ? 14 : 0 }}>
      <Text selectable={false} style={{ ...type.scripture, color: c.text }}>
        {nodes}
      </Text>
    </View>
  );
});

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

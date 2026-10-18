// Cronologia do trecho (tela cheia, a partir de "Abrir na linha do tempo" da lente Histórico): os eventos do livro
// do trecho (ou da Bíblia inteira) em ordem, com os períodos da fonte recolhíveis, a régua de anos à direita e a
// prévia de cada evento. A lista começa no evento do trecho. Nada navega sem "Ler no texto" (ver EventPreview).
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Pressable, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { splitVid } from '@sensus/core';
import { refShort } from '@/features/common/format';
import { useBooks } from '@/features/common/hooks';
import { Txt, size, space, useTheme } from '@/design';
import { TimelineTranslationNote } from '@/translate/TimelineTranslationNote';
import { useTimelineNames, useTimelineTexts, useTimelineTitles } from '@/translate/timeline-translate';
import { eventYear } from './model';
import { TL } from './strings';
import { useAllTimelineEvents } from './useTimeline';
import { Chip, SourceFooter, TimelineGate } from './parts';
import { EventPreview } from './EventPreview';
import { openInReader } from './actions';
import { useContextReturn } from './context-return';
import {
  anchorIndex,
  contextItems,
  contextRows,
  rowAtYear,
  rulerMarks,
  scopeEvents,
  type ContextRow,
  type ContextScope,
  type VerseSpan,
} from './context-model';
import { ContextRuler, RULER_MIN_GAP, RULER_W, type RulerTick } from './ContextRuler';

/** Folga acima do evento de destino quando a lista rola até ele. */
const ANCHOR_GAP = 16;

export function ContextView({ span, initialScope }: { span: VerseSpan | null; initialScope: ContextScope }) {
  return <TimelineGate>{span ? <ContextBody span={span} initialScope={initialScope} /> : <InvalidSpan />}</TimelineGate>;
}

function InvalidSpan() {
  return (
    <Txt v="bodySm" color="muted" center style={{ marginHorizontal: space[8], marginTop: space[8] }}>
      {TL.contextInvalid}
    </Txt>
  );
}

function ContextBody({ span, initialScope }: { span: VerseSpan; initialScope: ContextScope }) {
  const { c, st } = useTheme();
  const books = useBooks();
  const all = useAllTimelineEvents();
  const { start, end } = span;
  const trecho = useMemo<VerseSpan>(() => ({ start, end }), [start, end]);
  const book = splitVid(start).book;
  const bookName = books.find((b) => b.num === book)?.name_pt ?? '';

  const [scope, setScope] = useState<ContextScope>(initialScope);
  // Grupos que o leitor abriu ou fechou; sem toque, vale o padrão (aberto só o que contém o trecho).
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<string | null>(null);
  const [, redraw] = useReducer((n: number) => n + 1, 0);

  const events = useMemo(() => (all ? scopeEvents(all, scope, book) : null), [all, scope, book]);
  const rows = useMemo<ContextRow[]>(
    () => (events ? contextRows(contextItems(events, trecho), trecho, overrides) : []),
    [events, trecho, overrides],
  );
  const anchor = useMemo(() => anchorIndex(rows, trecho), [rows, trecho]);
  const marks = useMemo(() => rulerMarks(events ? events.map((e) => e.sortKey) : []), [events]);
  const groupNames = useMemo(() => rows.flatMap((r) => (r.kind === 'group' ? [r.group.name] : [])), [rows]);
  const tr = useTimelineTexts(groupNames);
  const eventsShown = useMemo(() => rows.flatMap((r) => (r.kind === 'group' ? [] : [r.event])), [rows]);
  const trTitle = useTimelineTitles(eventsShown);
  const participants = useMemo(() => eventsShown.flatMap((e) => e.participants), [eventsShown]);
  const trName = useTimelineNames(participants);

  // Rolagem: começa no evento do trecho (ou, na volta da pílula, onde o leitor parou). Medidas das linhas em
  // coordenadas do conteúdo; a régua usa as mesmas medidas.
  const scrollRef = useRef<ScrollView>(null);
  const layouts = useRef(new Map<string, { y: number; h: number }>());
  const anchorKey = anchor >= 0 ? rows[anchor]!.key : null;
  const anchorRef = useRef<string | null>(null);
  anchorRef.current = anchorKey;
  const pendingScroll = useRef<number | 'anchor' | null>('anchor');
  const scrollYRef = useRef(0);
  const [viewH, setViewH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [scrollY, setScrollY] = useState(0);

  // Volta da pílula: restaura o ponto de rolagem (consumido uma vez; a tela também limpa a pílula ao abrir).
  useEffect(() => {
    const back = useContextReturn.getState().takeResume();
    if (back) pendingScroll.current = back.scrollY;
  }, []);

  const measure = (key: string) => (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    layouts.current.set(key, { y, h: height });
    if (key === anchorRef.current && pendingScroll.current === 'anchor') {
      pendingScroll.current = null;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - ANCHOR_GAP), animated: false });
    }
  };

  const onContentSize = (_w: number, h: number) => {
    setContentH(h);
    redraw();
    const pending = pendingScroll.current;
    if (pending === 'anchor') {
      const a = anchorRef.current ? layouts.current.get(anchorRef.current) : undefined;
      if (a) {
        pendingScroll.current = null;
        scrollRef.current?.scrollTo({ y: Math.max(0, a.y - ANCHOR_GAP), animated: false });
      }
    } else if (typeof pending === 'number' && rows.length > 0) {
      // Só com as linhas na tela: com a lista ainda carregando, o conteúdo é curto e a rolagem cairia no topo.
      pendingScroll.current = null;
      scrollRef.current?.scrollTo({ y: pending, animated: false });
    }
  };

  const changeScope = (next: ContextScope) => {
    if (next === scope) return;
    pendingScroll.current = 'anchor';
    setScope(next);
  };

  const toggleGroup = (id: string, open: boolean) => setOverrides((o) => ({ ...o, [id]: !open }));

  const onJump = (y: number) => scrollRef.current?.scrollTo({ y: Math.max(0, y - ANCHOR_GAP), animated: true });

  // Régua: uma marca por passo de anos, na linha em que o ano começa; faixa do trecho pelas linhas dele.
  // Anos sem linha própria (ou na mesma altura da marca anterior) não ganham rótulo: ficariam empilhados.
  const ticks: RulerTick[] = [];
  let lastY = -Infinity;
  for (const m of marks) {
    const i = rowAtYear(rows, m.year);
    const y = i >= 0 ? layouts.current.get(rows[i]!.key)?.y : undefined;
    if (y === undefined || y - lastY < RULER_MIN_GAP) continue;
    ticks.push({ year: m.year, count: m.count, y });
    lastY = y;
  }
  let firstT = -1;
  let lastT = -1;
  rows.forEach((r, i) => {
    if (r.kind === 'event' && r.inTrecho) {
      if (firstT < 0) firstT = i;
      lastT = i;
    }
  });
  const firstBox = firstT >= 0 ? layouts.current.get(rows[firstT]!.key) : undefined;
  const lastBox = lastT >= 0 ? layouts.current.get(rows[lastT]!.key) : undefined;
  const band = firstBox && lastBox ? { top: firstBox.y, bottom: lastBox.y + lastBox.h } : null;

  // Ler no texto: guarda o ponto da lista (para a pílula) e só então leva o leitor aos versículos.
  const readAt = (first: number, last: number) => {
    useContextReturn.getState().remember({ span: trecho, scope, scrollY: scrollYRef.current });
    openInReader(first, last);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ gap: space[4], paddingHorizontal: space[8], paddingTop: space[5], paddingBottom: space[4], borderBottomWidth: 1, borderBottomColor: c.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <Chip testID="ctx-scope-book" label={`${TL.scopeBook}${bookName ? ` · ${bookName}` : ''}`} on={scope === 'book'} onPress={() => changeScope('book')} />
          <Chip testID="ctx-scope-bible" label={TL.scopeBible} on={scope === 'bible'} onPress={() => changeScope('bible')} />
        </View>
        <TimelineTranslationNote testID="ctx-note" />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          testID="ctx-list"
          onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
          onContentSizeChange={onContentSize}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            scrollYRef.current = y;
            setScrollY(y);
          }}
          scrollEventThrottle={64}
          contentContainerStyle={{ paddingTop: space[4], paddingBottom: space[12] }}
        >
          {all === null && <Txt v="meta" color="muted" style={{ marginHorizontal: space[8] }}>{TL.noDataYet}</Txt>}
          {all !== null && rows.length === 0 && (
            <Txt v="bodySm" color="muted" center style={{ marginHorizontal: space[8], marginTop: space[6] }}>{TL.contextEmpty}</Txt>
          )}
          {rows.map((row) => {
            if (row.kind === 'group') {
              const { group, open } = row;
              const first = group.events[0]!;
              return (
                <View key={row.key} onLayout={measure(row.key)}>
                  <Pressable
                    testID={`ctx-group-${group.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    accessibilityLabel={`${tr(group.name)}, ${TL.groupEvents(group.events.length)}`}
                    onPress={() => toggleGroup(group.id, open)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space[4],
                      minHeight: size.minTouch,
                      paddingLeft: space[8],
                      paddingRight: RULER_W,
                      backgroundColor: group.inTrecho ? c.selected : undefined,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Txt v="mono" color="muted" style={{ width: 64, textAlign: 'right', fontSize: 11, lineHeight: 16 }} numberOfLines={1}>
                      {eventYear(first)}
                    </Txt>
                    <View style={{ width: 18, alignItems: 'center' }}>
                      <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: st.ent, backgroundColor: open ? st.ent : c.bg }} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt v="bodySm" bold numberOfLines={2}>{tr(group.name)}</Txt>
                      <Txt v="meta" color="muted" style={{ fontSize: 11.5 }}>
                        {`${TL.groupEvents(group.events.length)}${group.inTrecho ? ` · ${TL.inTrecho}` : ''} · ${open ? '▾' : '▸'}`}
                      </Txt>
                    </View>
                  </Pressable>
                </View>
              );
            }
            const { event, inTrecho, inGroup } = row;
            const people = [...new Set(event.participants.map((p) => trName(p)).filter(Boolean))];
            return (
              <View key={row.key} onLayout={measure(row.key)}>
                <Pressable
                  testID={`ctx-event-${event.cite_id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${trTitle(event)}, ${eventYear(event)}, ${refShort(event.first_vid, event.last_vid, books, true)}`}
                  onPress={() => setPreview(event.cite_id)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    gap: space[4],
                    paddingLeft: space[8] + (inGroup ? space[6] : 0),
                    paddingRight: RULER_W,
                    backgroundColor: inTrecho ? c.selected : undefined,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Txt v="mono" color="muted" style={{ width: 64, textAlign: 'right', fontSize: 11, lineHeight: 16, paddingTop: 2 }} numberOfLines={1}>
                    {eventYear(event)}
                  </Txt>
                  <View style={{ width: 18, alignItems: 'center' }}>
                    <View style={{ width: inTrecho ? 12 : 10, height: inTrecho ? 12 : 10, marginTop: 5, borderRadius: 6, backgroundColor: inTrecho ? c.accent : st.ent }} />
                    <View style={{ flex: 1, width: 2, marginTop: 2, backgroundColor: c.border }} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, paddingBottom: space[6], gap: 2 }}>
                    <Txt v="bodySm" bold numberOfLines={2}>{trTitle(event)}</Txt>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: space[3] }}>
                      <Txt v="meta" color="muted" style={{ fontSize: 11.5 }}>{refShort(event.first_vid, event.last_vid, books, true)}</Txt>
                      {inTrecho && <Txt v="meta" color="accent" style={{ fontSize: 11 }}>{TL.inTrecho}</Txt>}
                    </View>
                    {people.length > 0 && (
                      <Txt v="meta" color="muted" style={{ fontSize: 11.5 }} numberOfLines={1}>{people.join(', ')}</Txt>
                    )}
                  </View>
                </Pressable>
              </View>
            );
          })}
          <View style={{ paddingRight: RULER_W }}>
            <SourceFooter />
          </View>
        </ScrollView>
        {viewH > 0 && (
          <ContextRuler viewH={viewH} contentH={contentH} scrollY={scrollY} band={band} ticks={ticks} onJump={onJump} />
        )}
      </View>

      {preview && (
        <EventPreview citeId={preview} confirm={{ onRead: readAt }} onClose={() => setPreview(null)} />
      )}
    </View>
  );
}

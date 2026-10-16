// EM PARALELO: eixo de anos horizontal, uma faixa por linha do tempo (rótulos fixos à esquerda), faixa do topo com a
// densidade de todos os eventos e eras como fundo alternado. Arrastar e pinça mudam o intervalo; − + e os atalhos
// (Bíblia inteira, Patriarcas, Reinos, Novo Testamento) também. Tocar no gráfico põe o cursor de ano e mostra, em
// baixo, o evento mais próximo de cada faixa; tocar num ponto abre a prévia; tocar num rótulo destaca a faixa.
// "Faixas" escolhe quais linhas aparecem. Sem animação: o salto de atalho é imediato (vale para "reduzir movimento").
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Stack, useRouter } from 'expo-router';
import {
  densityBins,
  normalizeSearch,
  TIMELINE_ERAS,
  type TimelineLine,
  type TimelineLineEvent,
} from '@sensus/core';
import { Txt, fontFamilies, radius, space, useTheme } from '@/design';
import { useRepo } from '@/data/db-context';
import { useAppPrefs } from '@/settings/app-prefs';
import {
  PARALLEL_PRESETS,
  clampView,
  cursorTolerance,
  eventYear,
  nearestPerLane,
  tickStep,
  xOfYear,
  yearAtX,
  yearText,
  zoomView,
} from './model';
import { TL, TL_ERA_SHORT } from './strings';
import { lineEventsOf, useSortKeys, useTimelineLines } from './useTimeline';
import { Chip, ChipRow, KindMark, SearchField, SourceFooter, TimelineGate, kindColor } from './parts';
import { EventPreview } from './EventPreview';

/** Linhas que aparecem quando o usuário não escolheu outras (nomes da fonte). */
const DEFAULT_LANES: ReadonlyArray<readonly [TimelineLine['kind'], string]> = [
  ['person', 'Abraham'],
  ['person', 'Moses'],
  ['person', 'Jesus Christ'],
  ['person', 'Paul'],
  ['place', 'Egypt'],
  ['period', 'United Kingdom'],
  ['period', 'Southern Kingdom (Judah)'],
  ['period', 'Northern Kingdom (Israel)'],
  ['place', 'Jerusalem'],
  ['place', 'Samaria'],
  ['period', 'Holy Week'],
];

/** Geometria: coluna de rótulos, eixo, faixa de densidade e altura de cada faixa (pixels). */
const LABEL_W = 96;
const AXIS_H = 22;
const DENS_H = 40;
const LANE_H = 34;
const ROW0 = AXIS_H + DENS_H + 4;
const DENS_BINS = 72;
/** Distância máxima (px) entre o toque e um ponto para abrir o evento. */
const HIT_PX = 9;
/** Ano inicial do cursor na Bíblia inteira (onde Judá e Israel correm lado a lado). */
const START_CURSOR = -760;

type View2 = { lo: number; hi: number };

export function ParallelView({ lineId, preset }: { lineId?: string; preset?: string }) {
  const { c, st } = useTheme();
  const repo = useRepo();
  const lines = useTimelineLines();
  const sortKeys = useSortKeys();
  const favLineIds = useAppPrefs((s) => s.timelineLines);
  const favEventIds = useAppPrefs((s) => s.timelineEvents);
  const favEventSet = useMemo(() => new Set(favEventIds), [favEventIds]);

  const [laneIds, setLaneIds] = useState<string[] | null>(null);
  const [view, setView] = useState<View2>({ lo: PARALLEL_PRESETS[0]!.from, hi: PARALLEL_PRESETS[0]!.to });
  const [cursor, setCursor] = useState(START_CURSOR);
  const [presetId, setPresetId] = useState<string | null>(preset ?? 'bible');
  const [focus, setFocus] = useState<string | null>(null);
  const [laneEvents, setLaneEvents] = useState<Record<string, TimelineLineEvent[]>>({});
  const [width, setWidth] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [lanesOpen, setLanesOpen] = useState(false);
  const initialised = useRef(false);

  const viewRef = useRef(view);
  viewRef.current = view;
  const startRef = useRef<View2 | null>(null);

  // Linhas iniciais: a da tela de origem (se houver), os favoritos e a seleção padrão, em ordem cronológica.
  useEffect(() => {
    if (!lines || laneIds !== null) return;
    const byId = new Map(lines.map((l) => [l.id, l]));
    const picked = new Set<string>();
    if (lineId && byId.has(lineId)) picked.add(lineId);
    for (const id of favLineIds) if (byId.has(id)) picked.add(id);
    for (const [kind, name] of DEFAULT_LANES) {
      const l = lines.find((x) => x.kind === kind && x.name === name);
      if (l) picked.add(l.id);
    }
    const ordered = [...picked].sort((a, b) => byId.get(a)!.from - byId.get(b)!.from || (a < b ? -1 : 1));
    setLaneIds(ordered);
    // Enquadramento inicial: a linha de origem (com margem), ou o atalho pedido.
    if (!initialised.current) {
      initialised.current = true;
      const origin = lineId ? byId.get(lineId) : undefined;
      if (origin) {
        const pad = Math.max(4, (origin.to - origin.from) * 0.15);
        setView(clampView(origin.from - pad, origin.to + pad));
        setCursor((origin.from + origin.to) / 2);
        setPresetId(null);
      } else {
        const p = PARALLEL_PRESETS.find((x) => x.id === preset) ?? PARALLEL_PRESETS[0]!;
        setView(clampView(p.from, p.to));
        setCursor(START_CURSOR);
        setPresetId(p.id);
      }
    }
    // Só na primeira carga das linhas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  // Eventos de cada faixa (cache por banco; a faixa aparece quando chegam).
  useEffect(() => {
    if (!laneIds) return;
    let alive = true;
    for (const id of laneIds) {
      if (laneEvents[id]) continue;
      lineEventsOf(repo, id).then(
        (events) => {
          if (alive) setLaneEvents((m) => ({ ...m, [id]: events }));
        },
        () => undefined,
      );
    }
    return () => {
      alive = false;
    };
    // laneEvents entra só para não pedir de novo o que já chegou.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laneIds, repo]);

  const lanes = useMemo(() => {
    const byId = new Map((lines ?? []).map((l) => [l.id, l]));
    return (laneIds ?? []).flatMap((id) => {
      const line = byId.get(id);
      return line ? [{ line, events: laneEvents[id] ?? null }] : [];
    });
  }, [lines, laneIds, laneEvents]);

  const PW = Math.max(0, width - LABEL_W);
  const H = ROW0 + lanes.length * LANE_H + 8;
  const { lo, hi } = view;
  const xOf = (y: number) => xOfYear(y, lo, hi, 0, PW);
  const yearOf = (x: number) => yearAtX(x, lo, hi, 0, PW);

  const density = useMemo(() => (sortKeys && PW > 0 ? densityBins(sortKeys, lo, hi, DENS_BINS) : []), [sortKeys, lo, hi, PW]);
  const densMax = Math.max(1, ...density);

  // ---- gestos: arrastar (horizontal), pinça e toque ----
  const onTap = (x: number, y: number) => {
    if (y >= ROW0) {
      const i = Math.floor((y - ROW0) / LANE_H);
      const lane = lanes[i];
      if (lane?.events) {
        let best: TimelineLineEvent | null = null;
        let bestD = HIT_PX;
        for (const e of lane.events) {
          const d = Math.abs(xOf(e.sortKey) - x);
          if (d <= bestD) {
            best = e;
            bestD = d;
          }
        }
        if (best) {
          setCursor(best.sortKey);
          setPreview(best.cite_id);
          return;
        }
      }
    }
    setPresetId(null);
    setCursor(yearOf(x));
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(4)
    .activeOffsetX([-6, 6])
    .failOffsetY([-10, 10])
    .onStart(() => {
      startRef.current = viewRef.current;
    })
    .onUpdate((e) => {
      const s = startRef.current;
      if (!s || PW <= 0) return;
      const shift = (-e.translationX / PW) * (s.hi - s.lo);
      setPresetId(null);
      setView(clampView(s.lo + shift, s.hi + shift));
    });
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      startRef.current = viewRef.current;
    })
    .onUpdate((e) => {
      const s = startRef.current;
      if (!s || PW <= 0) return;
      setPresetId(null);
      setView(zoomView(s.lo, s.hi, 1 / e.scale, yearAtX(e.focalX, s.lo, s.hi, 0, PW)));
    });
  const tap = Gesture.Tap()
    .runOnJS(true)
    .maxDuration(260)
    .onEnd((e, success) => {
      if (success) onTap(e.x, e.y);
    });
  const gesture = Gesture.Exclusive(Gesture.Simultaneous(pan, pinch), tap);

  const zoom = (factor: number) => {
    setPresetId(null);
    setView((v) => zoomView(v.lo, v.hi, factor, (v.lo + v.hi) / 2));
  };
  const jump = (p: (typeof PARALLEL_PRESETS)[number]) => {
    setView(clampView(p.from, p.to));
    setCursor((c0) => (c0 < p.from || c0 > p.to ? (p.from + p.to) / 2 : c0));
    setPresetId(p.id);
  };
  const toggleLane = (id: string) =>
    setLaneIds((ids) => {
      const cur = ids ?? [];
      if (cur.includes(id)) {
        if (focus === id) setFocus(null);
        return cur.filter((x) => x !== id);
      }
      const byId = new Map((lines ?? []).map((l) => [l.id, l]));
      const next = [...cur, id];
      return next.sort((a, b) => (byId.get(a)?.from ?? 0) - (byId.get(b)?.from ?? 0));
    });

  // Cursor: evento mais próximo de cada faixa dentro da tolerância.
  const tol = cursorTolerance(lo, hi);
  const nearest = nearestPerLane(
    lanes.map((l) => ({ id: l.line.id, events: l.events ?? [] })),
    cursor,
    tol,
  );
  const hitCount = nearest.filter((n) => n.event).length;
  const laneById = new Map(lanes.map((l) => [l.line.id, l.line]));

  const cursorX = xOf(cursor);
  const cursorLabel = `≈ ${yearText(cursor)}`;
  const labelW = cursorLabel.length * 6.6 + 12;

  return (
    <TimelineGate>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Stack.Screen options={{ title: TL.parallelTitle }} />
        <View style={{ gap: space[4], paddingTop: space[5], paddingBottom: space[4], paddingHorizontal: space[4], borderBottomWidth: 1, borderBottomColor: c.border }}>
          <ChipRow>
            {PARALLEL_PRESETS.map((p) => (
              <Chip key={p.id} testID={`tl-preset-${p.id}`} label={TL.presets[p.id]} on={presetId === p.id} onPress={() => jump(p)} />
            ))}
          </ChipRow>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4] }}>
            <Chip testID="tl-lanes" label={TL.lanes} on={false} onPress={() => setLanesOpen(true)} />
            <View style={{ flexDirection: 'row', gap: space[3] }}>
              <ZoomButton testID="tl-zoom-out" label="−" accessibilityLabel={TL.zoomOut} onPress={() => zoom(1 / 0.6)} />
              <ZoomButton testID="tl-zoom-in" label="+" accessibilityLabel={TL.zoomIn} onPress={() => zoom(0.6)} />
            </View>
          </View>
        </View>

        <ScrollView testID="tl-parallel" contentContainerStyle={{ paddingBottom: space[12] }}>
          <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ height: H, flexDirection: 'row' }}>
            {width > 0 && (
              <>
                {/* Rótulos fixos à esquerda; tocar destaca a faixa. */}
                <View style={{ width: LABEL_W, height: H, borderRightWidth: 1, borderRightColor: c.border, backgroundColor: c.bg }}>
                  <Txt v="meta" color="muted" style={{ position: 'absolute', top: AXIS_H + 6, left: space[4], right: space[2], fontSize: 10, lineHeight: 12 }} numberOfLines={2}>
                    {TL.allEvents}
                  </Txt>
                  {lanes.map((l, i) => {
                    const color = kindColor(l.line.kind, st);
                    const on = focus === l.line.id;
                    return (
                      <Pressable
                        key={l.line.id}
                        testID={`tl-lane-label-${l.line.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={TL.focusLane(l.line.name)}
                        accessibilityState={{ selected: on }}
                        onPress={() => setFocus(on ? null : l.line.id)}
                        style={{ position: 'absolute', top: ROW0 + i * LANE_H, left: 0, width: LABEL_W, height: LANE_H, justifyContent: 'center', paddingLeft: space[4], paddingRight: space[2], backgroundColor: on ? c.selected : c.bg }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
                          <Txt v="meta" tint={on ? c.accent : c.text} bold numberOfLines={1} style={{ fontSize: 11, lineHeight: 13, flex: 1 }}>
                            {l.line.name}
                          </Txt>
                        </View>
                        <Txt v="meta" color="muted" style={{ fontSize: 9.5, lineHeight: 12, paddingLeft: 10 }}>
                          {l.events ? TL.laneEvents(l.events.length) : ''}
                        </Txt>
                      </Pressable>
                    );
                  })}
                </View>

                <GestureDetector gesture={gesture}>
                  <View accessibilityLabel={TL.parallelTitle} style={{ width: PW, height: H }}>
                    <Svg width={PW} height={H}>
                      <Rect x={0} y={0} width={PW} height={H} fill={c.bg} />
                      {/* Eras: fundo alternado; a lacuna fica sem preenchimento. */}
                      {TIMELINE_ERAS.map((era, i) => {
                        const x0 = Math.max(0, xOf(era.from));
                        const x1 = Math.min(PW, xOf(era.to));
                        if (x1 <= x0) return null;
                        return (
                          <Rect key={era.id} x={x0} y={AXIS_H} width={x1 - x0} height={H - AXIS_H} fill={i % 2 === 0 && !era.gap ? c.surfaceAlt : 'none'} opacity={0.55} />
                        );
                      })}
                      {TIMELINE_ERAS.map((era) => {
                        const x0 = Math.max(0, xOf(era.from));
                        const x1 = Math.min(PW, xOf(era.to));
                        if (x1 - x0 < 46) return null;
                        return (
                          <SvgText key={`lbl-${era.id}`} x={x0 + 4} y={H - 6} fill={c.muted} fontSize={8.5} fontFamily={fontFamilies.uiBold} opacity={0.85}>
                            {(TL_ERA_SHORT[era.id] ?? era.name).toUpperCase()}
                          </SvgText>
                        );
                      })}
                      {/* Eixo de anos. */}
                      {axisTicks(lo, hi, PW).map((t) => (
                        <Line key={`t-${t}`} x1={xOf(t)} x2={xOf(t)} y1={AXIS_H - 4} y2={H - 14} stroke={c.border} strokeWidth={1} />
                      ))}
                      {axisTicks(lo, hi, PW).map((t) => (
                        <SvgText key={`n-${t}`} x={xOf(t)} y={14} fill={c.muted} fontSize={10} fontFamily={fontFamilies.mono} textAnchor="middle">
                          {yearText(t)}
                        </SvgText>
                      ))}
                      {/* Densidade de todos os eventos. */}
                      {density.map((n, b) => {
                        if (!n) return null;
                        const bw = PW / DENS_BINS;
                        const h = Math.max(2, (n / densMax) * (DENS_H - 6));
                        return <Rect key={`d-${b}`} x={b * bw} y={AXIS_H + DENS_H - 3 - h} width={Math.max(1, bw - 1)} height={h} fill={st.ent} opacity={0.55} />;
                      })}
                      {/* Faixas. */}
                      {lanes.map((l, i) => {
                        const top = ROW0 + i * LANE_H;
                        const cy = top + LANE_H / 2;
                        const color = kindColor(l.line.kind, st);
                        const on = focus === l.line.id;
                        const evs = l.events ?? [];
                        const first = evs[0];
                        const last = evs[evs.length - 1];
                        return (
                          <G key={l.line.id}>
                            {on && <Rect x={0} y={top} width={PW} height={LANE_H} fill={c.selected} opacity={0.7} />}
                            <Line x1={0} x2={PW} y1={cy} y2={cy} stroke={c.border} strokeWidth={1} />
                            {first && last && (
                              <Rect x={xOf(first.sortKey)} y={cy - 3} width={Math.max(2, xOf(last.sortKey) - xOf(first.sortKey))} height={6} fill={color} opacity={0.18} />
                            )}
                            {evs.map((e) => {
                              const x = xOf(e.sortKey);
                              if (x < -4 || x > PW + 4) return null;
                              const fav = favEventSet.has(e.cite_id);
                              return <Circle key={e.cite_id} cx={x} cy={cy} r={fav ? 4.5 : 3.2} fill={fav ? c.accent : color} />;
                            })}
                          </G>
                        );
                      })}
                      {/* Cursor de ano. */}
                      {cursorX >= 0 && cursorX <= PW && (
                        <>
                          <Line x1={cursorX} x2={cursorX} y1={AXIS_H - 6} y2={H - 14} stroke={c.accent} strokeWidth={1.5} />
                          <Rect x={Math.min(Math.max(cursorX - labelW / 2, 0), PW - labelW)} y={2} width={labelW} height={18} rx={6} fill={c.accent} />
                          <SvgText
                            x={Math.min(Math.max(cursorX, labelW / 2), PW - labelW / 2)}
                            y={15}
                            fill={c.accentText}
                            fontSize={10.5}
                            fontFamily={fontFamilies.uiBold}
                            textAnchor="middle"
                          >
                            {cursorLabel}
                          </SvgText>
                        </>
                      )}
                    </Svg>
                  </View>
                </GestureDetector>
              </>
            )}
          </View>

          <View style={{ paddingHorizontal: space[8], paddingTop: space[4], gap: space[2] }}>
            <Txt v="eyebrow" color="muted">{TL.cursorHead(yearText(cursor))}</Txt>
            <Txt v="meta" color="muted">{TL.cursorCount(hitCount, lanes.length)}</Txt>
            {hitCount === 0 && <Txt v="bodySm" color="muted" style={{ paddingVertical: space[3] }}>{TL.cursorEmpty}</Txt>}
          </View>
          {nearest.map((n) => {
            if (!n.event) return null;
            const line = laneById.get(n.id);
            if (!line) return null;
            const ev = n.event;
            return (
              <Pressable
                key={`${n.id}-${ev.cite_id}`}
                testID={`tl-cursor-row-${n.id}`}
                accessibilityRole="button"
                onPress={() => setPreview(ev.cite_id)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space[4], minHeight: 48, paddingHorizontal: space[8], opacity: pressed ? 0.7 : 1 })}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: kindColor(line.kind, st) }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt v="bodySm" bold numberOfLines={1}>{ev.title}</Txt>
                  <Txt v="meta" color="muted" numberOfLines={1}>{`${line.name} · ${eventYear(ev)}`}</Txt>
                </View>
              </Pressable>
            );
          })}
          <Txt v="meta" color="muted" style={{ paddingHorizontal: space[8], paddingTop: space[4], fontSize: 11 }}>{TL.paralleloShown}</Txt>
          <SourceFooter />
        </ScrollView>

        {preview && <EventPreview citeId={preview} onClose={() => setPreview(null)} />}
        {lanesOpen && lines && (
          <LanesSheet
            lines={lines}
            selected={new Set(laneIds ?? [])}
            onToggle={toggleLane}
            onClose={() => setLanesOpen(false)}
          />
        )}
      </View>
    </TimelineGate>
  );
}

/** Ticks do eixo: passo que deixa rótulos com ≥ 64 px; o ano 0 não existe e fica de fora. */
function axisTicks(lo: number, hi: number, PW: number): number[] {
  if (PW <= 0) return [];
  const step = tickStep(hi - lo, PW);
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) if (t !== 0) out.push(t);
  return out;
}

/** Botão quadrado de zoom (− +). */
function ZoomButton({ testID, label, accessibilityLabel, onPress }: { testID: string; label: string; accessibilityLabel: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
    >
      <Txt v="lensTitle" style={{ fontSize: 20, lineHeight: 24 }}>{label}</Txt>
    </Pressable>
  );
}

/** Escolha das faixas: lista de todas as linhas com caixas de marcação e busca por nome. */
function LanesSheet({
  lines,
  selected,
  onToggle,
  onClose,
}: {
  lines: TimelineLine[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [text, setText] = useState('');
  const q = normalizeSearch(text);
  const list = q ? lines.filter((l) => normalizeSearch(l.name).includes(q)) : lines;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={TL.done} onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: c.scrim }} />
        <View testID="tl-lanes-sheet" accessibilityViewIsModal style={{ maxHeight: '82%', backgroundColor: c.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: space[4], paddingBottom: space[8], paddingHorizontal: space[8], gap: space[5] }}>
          <View style={{ alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: c.border }} />
          <Txt v="sheetTitle" accessibilityRole="header">{TL.lanesTitle}</Txt>
          <Txt v="meta" color="muted">{TL.lanesHint}</Txt>
          <SearchField testID="tl-lanes-search" value={text} onChangeText={setText} placeholder={TL.lanesSearch} />
          {list.length === 0 ? (
            <Txt v="bodySm" color="muted">{TL.noLaneMatch}</Txt>
          ) : (
            <FlatList
              data={list}
              keyExtractor={(l) => l.id}
              style={{ flexGrow: 0 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const on = selected.has(item.id);
                return (
                  <Pressable
                    testID={`tl-lane-opt-${item.id}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={item.name}
                    onPress={() => onToggle(item.id)}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space[5], minHeight: 48, opacity: pressed ? 0.7 : 1 })}
                  >
                    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {on && <Txt v="meta" tint={c.accentText} bold style={{ fontSize: 13, lineHeight: 15 }}>✓</Txt>}
                    </View>
                    <KindMark kind={item.kind} small />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt v="bodySm" bold numberOfLines={1}>{item.name}</Txt>
                      <Txt v="meta" color="muted" numberOfLines={1}>{`${TL.kindLabel[item.kind]} · ${TL.lineTitleOf(item.count)}`}</Txt>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
          <Pressable testID="tl-lanes-done" accessibilityRole="button" onPress={onClose} style={({ pressed }) => ({ alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: space[6], opacity: pressed ? 0.7 : 1 })}>
            <Txt v="button" tint={c.accent}>{TL.done}</Txt>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

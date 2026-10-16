// EM PARALELO: as linhas escolhidas (chips com ×, "+ Linha", "Limpar") e o gráfico com uma faixa por linha. A
// extensão é a das linhas (zoom máximo para fora); "Ajustar" volta a ela. Tocar no gráfico põe o cursor de ano e
// mostra, embaixo, o evento mais próximo de cada linha; tocar num ponto abre a prévia. Abre só com a linha de
// origem (?linha=<cite_id>); sem ela, com as favoritas; sem favoritas, com a tela de escolha.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { timelineCore, type TimelineLineEvent } from '@sensus/core';
import { Txt, radius, space, useTheme } from '@/design';
import { useRepo } from '@/data/db-context';
import { useAppPrefs } from '@/settings/app-prefs';
import {
  PARALLEL_MAX_LANES,
  clampView,
  cursorTolerance,
  eventYear,
  extentOf,
  laneBounds,
  nearestPerLane,
  yearText,
  zoomView,
  type Bounds,
} from './model';
import { addLane, initialLanes, PARALLEL_COMBOS } from './parallel-lanes';
import { TL } from './strings';
import { Chip, SourceFooter, TimelineGate, kindColor } from './parts';
import { lineEventsOf, useTimelineLines } from './useTimeline';
import { ParallelChart, type ChartLane } from './ParallelChart';
import { ParallelMap } from './ParallelMap';
import { LinePicker } from './LinePicker';
import { EventPreview, type PreviewCompare } from './EventPreview';

export function ParallelView({ lineId }: { lineId?: string }) {
  const { c, st } = useTheme();
  const repo = useRepo();
  const lines = useTimelineLines();
  const favLineIds = useAppPrefs((s) => s.timelineLines);
  const favEventIds = useAppPrefs((s) => s.timelineEvents);
  const recentIds = useAppPrefs((s) => s.timelineRecent);
  const pushRecent = useAppPrefs((s) => s.pushTimelineRecent);
  const favEvents = useMemo(() => new Set(favEventIds), [favEventIds]);

  const [laneIds, setLaneIds] = useState<string[] | null>(null);
  const [included, setIncluded] = useState<ReadonlySet<string>>(new Set());
  const [laneEvents, setLaneEvents] = useState<Record<string, TimelineLineEvent[]>>({});
  const [view, setViewState] = useState<Bounds | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ citeId: string; laneId: string } | null>(null);
  const [picking, setPicking] = useState(false);

  // Linhas iniciais, uma vez que o catálogo chegou.
  useEffect(() => {
    if (!lines || laneIds !== null) return;
    setLaneIds(initialLanes(lineId, favLineIds, new Set(lines.map((l) => l.id))));
    // Só na primeira carga do catálogo: as favoritas do momento de abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  // Eventos de cada linha escolhida (cache por banco; a faixa aparece quando chegam).
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

  const byId = useMemo(() => new Map((lines ?? []).map((l) => [l.id, l])), [lines]);

  /** Faixas prontas: eventos visíveis (sem os isolados, salvo incluídos), selo e intervalo de cada linha. */
  const laneViews = useMemo(
    () =>
      (laneIds ?? []).flatMap((id) => {
        const line = byId.get(id);
        if (!line) return [];
        const events = laneEvents[id] ?? null;
        const inc = included.has(id);
        const sortKeys = (events ?? []).map((e) => e.sortKey);
        const core = timelineCore(sortKeys);
        const visible = events ? (inc ? events : events.filter((e) => e.sortKey >= core.lo && e.sortKey <= core.hi)) : [];
        const lane: ChartLane & { events: TimelineLineEvent[] | null; bounds: Bounds | null } = {
          id,
          line,
          visible,
          total: events?.length ?? line.count,
          far: inc ? [] : core.far,
          events,
          bounds: events ? laneBounds(sortKeys, inc) : null,
        };
        return [lane];
      }),
    [laneIds, byId, laneEvents, included],
  );

  const ext = useMemo(() => extentOf(laneViews.flatMap((l) => (l.bounds ? [l.bounds] : []))), [laneViews]);
  const extLo = ext?.lo ?? null;
  const extHi = ext?.hi ?? null;
  const laneKey = (laneIds ?? []).join('|');

  // Ao mudar as linhas (ou a extensão delas), o gráfico ajusta à nova extensão.
  useEffect(() => {
    if (extLo !== null && extHi !== null) setViewState({ lo: extLo, hi: extHi });
    // Só a extensão e a lista de linhas disparam o ajuste.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laneKey, extLo, extHi]);

  /** Janela sempre dentro da extensão. */
  const setView = (v: Bounds) => {
    if (ext) setViewState(clampView(v, ext));
  };
  const shownView = view ?? ext;

  const lanesOnScreen = laneIds ?? [];
  const full = lanesOnScreen.length >= PARALLEL_MAX_LANES;
  const hasLanes = lanesOnScreen.length > 0;

  const addToScreen = (id: string) => {
    setLaneIds((ids) => addLane(ids ?? [], id));
    pushRecent(id);
    setPicking(false);
  };
  const removeLane = (id: string) => {
    setLaneIds((ids) => (ids ?? []).filter((x) => x !== id));
    setIncluded((s) => without(s, id));
  };
  const clearLanes = () => {
    setLaneIds([]);
    setIncluded(new Set());
    setCursor(null);
  };
  const applyCombo = (ids: readonly string[]) => {
    setLaneIds(ids.slice(0, PARALLEL_MAX_LANES).filter((id) => byId.has(id)));
    setIncluded(new Set());
    setCursor(null);
    setPicking(false);
  };

  const includeFar = (id: string) => setIncluded((s) => new Set(s).add(id));

  const onPoint = (laneId: string, e: TimelineLineEvent) => {
    setCursor(e.sortKey);
    setPreview({ citeId: e.cite_id, laneId });
  };

  // Zoom pelo botão: em torno do cursor, se estiver na janela, senão no meio.
  const zoomBy = (factor: number) => {
    if (!shownView || !ext) return;
    const centre = cursor !== null && cursor >= shownView.lo && cursor <= shownView.hi ? cursor : (shownView.lo + shownView.hi) / 2;
    setViewState(zoomView(shownView, factor, centre, ext));
  };

  // Cursor: evento mais próximo de cada linha dentro da tolerância.
  const tol = shownView ? cursorTolerance(shownView.lo, shownView.hi) : 1.5;
  const nearest = cursor !== null ? nearestPerLane(laneViews.map((l) => ({ id: l.id, events: l.visible })), cursor, tol) : [];
  const hits = nearest.filter((n) => n.event);
  const laneById = new Map(laneViews.map((l) => [l.id, l]));

  const compare: PreviewCompare = {
    onScreen: new Set(lanesOnScreen),
    full,
    onAdd: (line) => {
      addToScreen(line.id);
      setPreview(null);
    },
  };

  const ready = lines !== null && laneIds !== null;

  return (
    <TimelineGate>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Stack.Screen options={{ title: TL.parallelTitle }} />
        <View style={{ gap: space[3], paddingTop: space[4], paddingBottom: space[3], paddingHorizontal: space[4], borderBottomWidth: 1, borderBottomColor: c.border }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[3] }}>
            {laneViews.map((l) => (
              <LaneChip key={l.id} testID={`tl-lane-${l.id}`} name={l.line.name} color={kindColor(l.line.kind, st)} onRemove={() => removeLane(l.id)} />
            ))}
            <Chip testID="tl-add-line" label={TL.addLine} on={false} disabled={full || !lines} onPress={() => setPicking(true)} />
            {hasLanes && <Chip testID="tl-clear" label={TL.clearLines} on={false} onPress={clearLanes} />}
          </View>
          {full && <Txt v="meta" color="muted">{TL.laneLimit}</Txt>}
          {hasLanes && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }}>
              <Chip testID="tl-fit" label={TL.fitAll} on={false} onPress={() => ext && setViewState({ lo: ext.lo, hi: ext.hi })} />
              <View style={{ flexDirection: 'row', gap: space[3] }}>
                <ZoomButton testID="tl-zoom-out" label="−" accessibilityLabel={TL.zoomOut} onPress={() => zoomBy(2)} />
                <ZoomButton testID="tl-zoom-in" label="+" accessibilityLabel={TL.zoomIn} onPress={() => zoomBy(0.5)} />
              </View>
            </View>
          )}
        </View>

        {!ready && <Txt v="meta" color="muted" style={{ padding: space[8] }}>{TL.noDataYet}</Txt>}

        {ready && !hasLanes && (
          <ScrollView contentContainerStyle={{ padding: space[8], gap: space[5] }}>
            <Txt v="lensTitle" tint={c.text}>{TL.emptyTitle}</Txt>
            <Txt v="meta" color="muted">{TL.emptyBody}</Txt>
            <Txt v="eyebrow" color="muted" style={{ marginTop: space[3] }}>{TL.combos}</Txt>
            <View style={{ gap: space[3] }}>
              {PARALLEL_COMBOS.map((combo) => (
                <Pressable
                  key={combo.id}
                  testID={`tl-combo-${combo.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={combo.name}
                  onPress={() => applyCombo(combo.lines)}
                  style={({ pressed }) => ({ borderWidth: 1, borderColor: c.border, borderRadius: radius.card, backgroundColor: c.surface, padding: space[5], gap: 2, opacity: pressed ? 0.7 : 1 })}
                >
                  <Txt v="bodySm" bold>{combo.name}</Txt>
                  <Txt v="meta" color="muted" numberOfLines={2}>
                    {combo.lines.map((id) => byId.get(id)?.name ?? '').filter(Boolean).join(' · ')}
                  </Txt>
                </Pressable>
              ))}
            </View>
            <SourceFooter />
          </ScrollView>
        )}

        {ready && hasLanes && (
          <>
            <View style={{ flex: 1, minHeight: 290 }}>
              {shownView && ext ? (
                <ParallelChart
                  lanes={laneViews}
                  ext={ext}
                  view={shownView}
                  cursor={cursor}
                  favEvents={favEvents}
                  onView={setView}
                  onCursor={setCursor}
                  onPoint={onPoint}
                  onInclude={includeFar}
                />
              ) : (
                <Txt v="meta" color="muted" style={{ padding: space[8] }}>{TL.laneLoading}</Txt>
              )}
            </View>
            {ext && shownView && (
              <View style={{ marginHorizontal: space[4], marginTop: space[3] }}>
                <ParallelMap lanes={laneViews} ext={ext} view={shownView} onView={setView} />
              </View>
            )}
            <ScrollView style={{ flexGrow: 0, maxHeight: 230 }} contentContainerStyle={{ paddingBottom: space[6] }}>
              {cursor === null ? (
                <Txt v="meta" color="muted" style={{ padding: space[6], lineHeight: 18 }}>{TL.cursorHint}</Txt>
              ) : (
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: space[8], paddingTop: space[4], paddingBottom: space[2] }}>
                    <Txt v="eyebrow" color="muted">{TL.cursorHead(yearText(cursor))}</Txt>
                    <Txt v="meta" color="muted">{TL.cursorCount(hits.length, laneViews.length)}</Txt>
                  </View>
                  {hits.length === 0 && <Txt v="bodySm" color="muted" style={{ paddingHorizontal: space[8], paddingVertical: space[3] }}>{TL.cursorEmpty}</Txt>}
                  {hits.map(({ id, event }) => {
                    const l = laneById.get(id);
                    if (!l || !event) return null;
                    return (
                      <Pressable
                        key={`${id}-${event.cite_id}`}
                        testID={`tl-cursor-row-${id}`}
                        accessibilityRole="button"
                        onPress={() => setPreview({ citeId: event.cite_id, laneId: id })}
                        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space[4], minHeight: 48, paddingHorizontal: space[8], opacity: pressed ? 0.7 : 1 })}
                      >
                        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: kindColor(l.line.kind, st) }} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Txt v="bodySm" bold numberOfLines={1}>{event.title}</Txt>
                          <Txt v="meta" color="muted" numberOfLines={1}>{`${l.line.name} · ${eventYear(event)}`}</Txt>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </>
        )}

        {preview && (
          <EventPreview citeId={preview.citeId} currentLineId={preview.laneId} compare={compare} onClose={() => setPreview(null)} />
        )}
        {picking && lines && (
          <LinePicker
            lines={lines}
            laneIds={lanesOnScreen}
            favorites={favLineIds}
            recent={recentIds}
            onAdd={(line) => addToScreen(line.id)}
            onCombo={applyCombo}
            onClose={() => setPicking(false)}
          />
        )}
      </View>
    </TimelineGate>
  );
}

function without(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!set.has(id)) return set;
  const next = new Set(set);
  next.delete(id);
  return next;
}

/** Chip de linha na tela: bolinha da cor do tipo, nome e × para tirar. */
function LaneChip({ testID, name, color, onRemove }: { testID: string; name: string; color: string; onRemove: () => void }) {
  const { c } = useTheme();
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 34, paddingLeft: space[5], paddingRight: space[2], borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, maxWidth: '100%' }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Txt v="button" style={{ fontSize: 12.5, lineHeight: 16, flexShrink: 1 }} numberOfLines={1}>{name}</Txt>
      <Pressable
        testID={`${testID}-remove`}
        accessibilityRole="button"
        accessibilityLabel={TL.removeLane(name)}
        onPress={onRemove}
        hitSlop={8}
        style={({ pressed }) => ({ width: 26, height: 26, borderRadius: 13, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
      >
        <Txt v="button" color="muted" style={{ fontSize: 13, lineHeight: 15 }}>×</Txt>
      </Pressable>
    </View>
  );
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

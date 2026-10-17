// EM PARALELO: sem linhas, a entrada com "Criar combinação" e as combinações (cartões); com linhas, as escolhidas
// (chips com ×, "+ Linha", "Limpar", "★ Salvar combinação") e o gráfico com uma faixa por linha, que rola na vertical
// quando há muitas. A extensão é a das linhas (zoom máximo para fora); "Ajustar" volta a ela. Tocar no gráfico põe o
// cursor de ano e mostra, embaixo, o evento mais próximo de cada linha; tocar num ponto abre a prévia. Abre só com a
// linha de origem (?linha=<cite_id>); sem ela, na entrada.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { timelineCore, type TimelineLineEvent } from '@sensus/core';
import { Txt, radius, space, useTheme } from '@/design';
import { useRepo } from '@/data/db-context';
import { useAppPrefs } from '@/settings/app-prefs';
import {
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
import { addLane, initialLanes } from './parallel-lanes';
import { buildCards, canConfirm, comboKey, defaultComboName, type ComboCard } from '@sensus/core';
import { TL } from './strings';
import { Chip, LaneChip, TimelineGate, kindColor } from './parts';
import { lineEventsOf, useTimelineLines } from './useTimeline';
import { ParallelChart, type ChartLane } from './ParallelChart';
import { ParallelMap } from './ParallelMap';
import { CombinationPicker } from './CombinationPicker';
import { CombinationEntry } from './CombinationEntry';
import { SaveComboSheet } from './SaveCombination';
import { EventPreview, type PreviewCompare } from './EventPreview';
import { TimelineTranslationNote } from '@/translate/TimelineTranslationNote';
import { useTimelineTexts } from '@/translate/timeline-translate';

export function ParallelView({ lineId }: { lineId?: string }) {
  const { c, st } = useTheme();
  const repo = useRepo();
  const lines = useTimelineLines();
  const favEventIds = useAppPrefs((s) => s.timelineEvents);
  const favEvents = useMemo(() => new Set(favEventIds), [favEventIds]);
  const combos = useAppPrefs((s) => s.timelineCombos);
  const recordCombo = useAppPrefs((s) => s.recordCombo);
  const favoriteCombo = useAppPrefs((s) => s.favoriteCombo);
  const unfavoriteCombo = useAppPrefs((s) => s.unfavoriteCombo);
  const removeCombo = useAppPrefs((s) => s.removeCombo);
  const cards = useMemo(() => buildCards(combos), [combos]);

  const [laneIds, setLaneIds] = useState<string[] | null>(null);
  const [included, setIncluded] = useState<ReadonlySet<string>>(new Set());
  const [laneEvents, setLaneEvents] = useState<Record<string, TimelineLineEvent[]>>({});
  const [view, setViewState] = useState<Bounds | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ citeId: string; laneId: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  // Linhas iniciais, uma vez que o catálogo chegou (só a de origem; sem ela, a entrada).
  useEffect(() => {
    if (!lines || laneIds !== null) return;
    setLaneIds(initialLanes(lineId, new Set(lines.map((l) => l.id))));
    // Só na primeira carga do catálogo.
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
  const hasLanes = lanesOnScreen.length > 0;
  const nameOf = (id: string) => byId.get(id)?.name ?? '';

  const removeLane = (id: string) => {
    setLaneIds((ids) => (ids ?? []).filter((x) => x !== id));
    setIncluded((s) => without(s, id));
  };
  const clearLanes = () => {
    setLaneIds([]);
    setIncluded(new Set());
    setCursor(null);
  };
  /** Confirmar no seletor: abre o paralelo com essas linhas e a combinação vira recente. */
  const confirmPick = (ids: readonly string[]) => {
    const sel = ids.filter((id) => byId.has(id));
    if (!canConfirm(sel)) return;
    setLaneIds(sel);
    setIncluded((s) => new Set([...s].filter((id) => sel.includes(id))));
    setCursor(null);
    recordCombo(sel, defaultComboName(sel.map(nameOf)));
    setPicking(false);
  };
  /** Cartão: abre o paralelo com as linhas dele (as prontas não são gravadas). */
  const openCard = (card: ComboCard) => {
    const sel = card.lines.filter((id) => byId.has(id));
    if (!canConfirm(sel)) return;
    setLaneIds(sel);
    setIncluded(new Set());
    setCursor(null);
  };
  const starCard = (card: ComboCard) => {
    if (card.source === 'mine' && card.favorite) unfavoriteCombo(card.id);
    else favoriteCombo(card.lines, card.name);
  };
  const savedNow = combos.some((c) => c.favorite && comboKey(c.lines) === comboKey(lanesOnScreen));
  const saveCurrent = (name: string) => {
    favoriteCombo(lanesOnScreen, name);
    setSaving(false);
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
    onAdd: (line) => {
      setLaneIds((ids) => addLane(ids ?? [], line.id));
      setPreview(null);
    },
  };

  const ready = lines !== null && laneIds !== null;

  // Textos do gráfico: traduzidos num só lote quando configurado (os cartões traduzem os seus).
  const chartTexts = useMemo(
    () => [...laneViews.map((l) => l.line.name), ...laneViews.flatMap((l) => l.visible.map((e) => e.title))],
    [laneViews],
  );
  const tr = useTimelineTexts(chartTexts);

  return (
    <TimelineGate>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Stack.Screen options={{ title: TL.parallelTitle }} />
        {hasLanes && (
          <View style={{ gap: space[3], paddingTop: space[4], paddingBottom: space[3], paddingHorizontal: space[4], borderBottomWidth: 1, borderBottomColor: c.border }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[3] }}>
              {laneViews.map((l) => (
                <LaneChip key={l.id} testID={`tl-lane-${l.id}`} name={tr(l.line.name)} color={kindColor(l.line.kind, st)} onRemove={() => removeLane(l.id)} />
              ))}
              <Chip testID="tl-add-line" label={TL.addLine} on={false} disabled={!lines} onPress={() => setPicking(true)} />
              <Chip testID="tl-save" label={savedNow ? TL.savedCombo : TL.saveCombo} on={false} disabled={savedNow} onPress={() => setSaving(true)} />
              <Chip testID="tl-clear" label={TL.clearLines} on={false} onPress={clearLanes} />
            </View>
            <TimelineTranslationNote testID="tl-paralelo-note" />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }}>
              <Chip testID="tl-fit" label={TL.fitAll} on={false} onPress={() => ext && setViewState({ lo: ext.lo, hi: ext.hi })} />
              <View style={{ flexDirection: 'row', gap: space[3] }}>
                <ZoomButton testID="tl-zoom-out" label="−" accessibilityLabel={TL.zoomOut} onPress={() => zoomBy(2)} />
                <ZoomButton testID="tl-zoom-in" label="+" accessibilityLabel={TL.zoomIn} onPress={() => zoomBy(0.5)} />
              </View>
            </View>
          </View>
        )}

        {!ready && <Txt v="meta" color="muted" style={{ padding: space[8] }}>{TL.noDataYet}</Txt>}

        {ready && !hasLanes && (
          <CombinationEntry
            cards={cards}
            nameOf={nameOf}
            onCreate={() => setPicking(true)}
            onOpen={openCard}
            onStar={starCard}
            onRemove={(card) => removeCombo(card.id)}
          />
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
                  tr={tr}
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
                          <Txt v="bodySm" bold numberOfLines={1}>{tr(event.title)}</Txt>
                          <Txt v="meta" color="muted" numberOfLines={1}>{`${tr(l.line.name)} · ${eventYear(event)}`}</Txt>
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
          <CombinationPicker lines={lines} initial={lanesOnScreen} onConfirm={confirmPick} onClose={() => setPicking(false)} />
        )}
        {saving && <SaveComboSheet defaultName={defaultComboName(lanesOnScreen.map(nameOf))} onSave={saveCurrent} onClose={() => setSaving(false)} />}
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

// LISTA de uma linha do tempo (pessoa, lugar ou período): eventos em ordem, com ano, ponto, título, referência e
// participantes. Filtro de texto dentro da linha, "Só marcadores", favorito da linha e de cada evento, "Em paralelo"
// (zoom nesta linha) e a prévia de cada evento.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { refShort } from '@/features/common/format';
import { useBooks } from '@/features/common/hooks';
import { Txt, space, useTheme } from '@/design';
import { matchesTranslatedText } from '@sensus/core';
import { cachedTranslation } from '@/translate/engine';
import { TimelineTranslationNote } from '@/translate/TimelineTranslationNote';
import { useTimelineActive, useTimelineText, useTimelineTexts, useTimelineVersion } from '@/translate/timeline-translate';
import { useAppPrefs } from '@/settings/app-prefs';
import { eventYear, matchesEventText } from './model';
import { TL } from './strings';
import { useLineEvents, useTimelineLines } from './useTimeline';
import { Chip, KindMark, SearchField, SourceFooter, StarButton, TimelineGate, kindColor, lineMetaText } from './parts';
import { EventPreview } from './EventPreview';

export function LineList({ lineId }: { lineId: string }) {
  const { c, st } = useTheme();
  const router = useRouter();
  const books = useBooks();
  const lines = useTimelineLines();
  const line = lines?.find((l) => l.id === lineId) ?? null;
  const events = useLineEvents(lineId);
  const favLine = useAppPrefs((s) => s.timelineLines.includes(lineId));
  const toggleLine = useAppPrefs((s) => s.toggleTimelineLine);
  const favEventIds = useAppPrefs((s) => s.timelineEvents);
  const toggleEvent = useAppPrefs((s) => s.toggleTimelineEvent);
  const favEventSet = useMemo(() => new Set(favEventIds), [favEventIds]);

  const [text, setText] = useState('');
  const [onlyMarks, setOnlyMarks] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const lineName = useTimelineText(line?.name);
  const tlActive = useTimelineActive();
  const version = useTimelineVersion();
  // Filtro: original, e a tradução quando ela já está no cache.
  const shown = useMemo(
    () =>
      (events ?? []).filter(
        (e) =>
          (!onlyMarks || favEventSet.has(e.cite_id)) &&
          (matchesEventText(e, text) || (tlActive && matchesTranslatedText(text, e.title, cachedTranslation(e.title)))),
      ),
    // version: a tradução chegou ao cache; o filtro considera a tradução nova.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, onlyMarks, favEventSet, text, tlActive, version],
  );
  const rowTexts = useMemo(() => shown.flatMap((e) => [e.title, ...e.participants.map((p) => p.name)]), [shown]);
  const tr = useTimelineTexts(rowTexts);
  const color = line ? kindColor(line.kind, st) : c.muted;

  return (
    <TimelineGate>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Stack.Screen options={{ title: line ? lineName : TL.title }} />
        <View style={{ gap: space[5], paddingHorizontal: space[8], paddingTop: space[5], paddingBottom: space[5], borderBottomWidth: 1, borderBottomColor: c.border }}>
          {line && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
              <KindMark kind={line.kind} small />
              <Txt v="meta" color="muted" style={{ flex: 1, minWidth: 0 }} numberOfLines={2} testID="tl-line-meta">
                {lineMetaText(line)}
              </Txt>
              <StarButton on={favLine} label={favLine ? TL.unfavorite : TL.favoriteLine(line.name)} onPress={() => toggleLine(lineId)} testID="tl-fav-line" />
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <SearchField testID="tl-line-filter" value={text} onChangeText={setText} placeholder={TL.lineFilter} />
            </View>
            <Pressable
              testID="tl-to-parallel"
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/timeline/paralelo', params: { linha: lineId } })}
              style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: space[5], justifyContent: 'center', borderRadius: 999, backgroundColor: c.accent, opacity: pressed ? 0.8 : 1 })}
            >
              <Txt v="button" tint={c.accentText}>{TL.parallelButton}</Txt>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Chip testID="tl-only-marks" label={TL.onlyMarks} on={onlyMarks} star onPress={() => setOnlyMarks((x) => !x)} />
          </ScrollView>
          <TimelineTranslationNote testID="tl-line-note" />
        </View>

        <ScrollView testID="tl-line-list" contentContainerStyle={{ paddingTop: space[5], paddingBottom: space[12] }} keyboardShouldPersistTaps="handled">
          {events === null && <Txt v="meta" color="muted" style={{ marginHorizontal: space[8] }}>{TL.noDataYet}</Txt>}
          {events !== null && shown.length === 0 && (
            <Txt v="bodySm" color="muted" center style={{ marginHorizontal: space[8], marginTop: space[6] }}>
              {onlyMarks && !(events ?? []).some((e) => favEventSet.has(e.cite_id)) ? TL.noMarks : TL.noLineFilter}
            </Txt>
          )}
          {shown.map((e, i) => {
            const marked = favEventSet.has(e.cite_id);
            const last = i === shown.length - 1;
            return (
              <View key={e.cite_id} style={{ flexDirection: 'row', alignItems: 'stretch', paddingRight: space[2] }}>
                <Pressable
                  testID={`tl-line-event-${e.cite_id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${tr(e.title)}, ${eventYear(e)}, ${refShort(e.first_vid, e.last_vid, books, true)}`}
                  onPress={() => setPreview(e.cite_id)}
                  style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: 'row', gap: space[4], paddingLeft: space[6], opacity: pressed ? 0.7 : 1 })}
                >
                  <Txt v="mono" color="muted" style={{ width: 64, textAlign: 'right', fontSize: 11, lineHeight: 16, paddingTop: 2 }} numberOfLines={1}>
                    {eventYear(e)}
                  </Txt>
                  <View style={{ width: 18, alignItems: 'center' }}>
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        marginTop: 5,
                        borderRadius: 5,
                        backgroundColor: marked ? c.accent : color,
                        borderWidth: marked ? 3 : 0,
                        borderColor: c.bg,
                      }}
                    />
                    {!last && <View style={{ flex: 1, width: 2, marginTop: 2, backgroundColor: c.border }} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, paddingBottom: space[7], gap: 2 }}>
                    <Txt v="bodySm" bold numberOfLines={2}>{tr(e.title)}</Txt>
                    <Txt v="meta" color="muted" style={{ fontSize: 11.5 }} numberOfLines={1}>
                      {refShort(e.first_vid, e.last_vid, books, true)}
                    </Txt>
                    {e.participants.length > 0 && (
                      <Txt v="meta" color="muted" style={{ fontSize: 11.5 }} numberOfLines={1}>
                        {[...new Set(e.participants.map((p) => tr(p.name)).filter(Boolean))].join(', ')}
                      </Txt>
                    )}
                  </View>
                </Pressable>
                <StarButton on={marked} label={marked ? TL.unfavorite : TL.favoriteEvent(tr(e.title))} onPress={() => toggleEvent(e.cite_id)} testID={`tl-fav-line-event-${e.cite_id}`} />
              </View>
            );
          })}
          <SourceFooter />
        </ScrollView>

        {preview && <EventPreview citeId={preview} currentLineId={lineId} onClose={() => setPreview(null)} />}
      </View>
    </TimelineGate>
  );
}

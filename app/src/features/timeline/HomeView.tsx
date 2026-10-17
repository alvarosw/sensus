// Tela inicial da linha do tempo: busca, filtros (tipo, era, favoritos), favoritos, visão geral (Bíblia inteira e
// Em paralelo) e as listas de períodos, pessoas e lugares. Tocar numa linha abre a lista dela; tocar num evento
// da busca abre a prévia.
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { matchesTranslatedText, type TimelineLine, type TimelineLineEvent, type TimelineLineRef } from '@sensus/core';
import { cachedTranslation } from '@/translate/engine';
import { TimelineTranslationNote } from '@/translate/TimelineTranslationNote';
import { useTimelineActive, useTimelineText, useTimelineTexts, useTimelineVersion } from '@/translate/timeline-translate';
import { Txt, radius, space, useTheme } from '@/design';
import { useAppPrefs } from '@/settings/app-prefs';
import { eraById, eventYear, filterEvents, filterLines, spanText, type KindFilter } from './model';
import { TL } from './strings';
import { useAllTimelineEvents, useEventsByIds, useTimelineLines, useTimelineSearch, useTimelineSummary } from './useTimeline';
import { Density, KindMark, LineCard, SearchField, SourceFooter, StarButton, TimelineGate } from './parts';
import { EventPreview } from './EventPreview';
import { LineFilterChips, useLineMatches } from './LineFilters';

/** Quantos cartões cada lista mostra antes de "Mostrar todas". */
const SHOWN = 30;

export function TimelineHome({ eventId }: { eventId?: string }) {
  return (
    <TimelineGate>
      <HomeBody eventId={eventId} />
    </TimelineGate>
  );
}

function HomeBody({ eventId }: { eventId?: string }) {
  const { c, st } = useTheme();
  const router = useRouter();
  const lines = useTimelineLines();
  const summary = useTimelineSummary();
  const favLineIds = useAppPrefs((s) => s.timelineLines);
  const favEventIds = useAppPrefs((s) => s.timelineEvents);
  const toggleLine = useAppPrefs((s) => s.toggleTimelineLine);
  const toggleEvent = useAppPrefs((s) => s.toggleTimelineEvent);

  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [eraId, setEraId] = useState('all');
  const [onlyFav, setOnlyFav] = useState(false);
  const [preview, setPreview] = useState<string | null>(eventId ?? null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const favorites = useMemo(() => new Set(favLineIds), [favLineIds]);
  const favEventSet = useMemo(() => new Set(favEventIds), [favEventIds]);
  const era = eraById(eraId);
  const all = lines ?? [];
  const filter = { kind, era, onlyFavorites: onlyFav, favorites };
  const searching = query.trim().length > 0;
  const hits = useTimelineSearch(query);
  const favEvents = useEventsByIds(favEventIds);
  const allEvents = useAllTimelineEvents();
  const tlActive = useTimelineActive();
  const version = useTimelineVersion();

  // Busca: além do banco (original), o que casa a tradução já em cache (linhas e eventos ainda não buscados).
  const q = query.trim();
  const searchLines = useLineMatches(query, all, hits);
  const searchEvents = useMemo(() => {
    const db = hits?.events ?? [];
    if (!searching || !tlActive || !allEvents) return db;
    const extra = allEvents.filter((e) => !db.some((x) => x.cite_id === e.cite_id) && matchesTranslatedText(q, e.title, cachedTranslation(e.title)));
    return [...db, ...extra];
    // version: a tradução chegou ao cache; recalcula a busca por ela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hits, searching, tlActive, allEvents, q, version]);

  // Visão geral: intervalo da Bíblia inteira a partir das linhas (primeiro e último ano de todas).
  const span = useMemo(() => (all.length ? { from: Math.min(...all.map((l) => l.from)), to: Math.max(...all.map((l) => l.to)) } : null), [all]);

  const openLine = (line: TimelineLine) => router.push({ pathname: '/timeline/linha', params: { id: line.id } });

  const renderLine = (line: TimelineLine) => (
    <LineCard
      key={line.id}
      line={line}
      favorite={favorites.has(line.id)}
      onOpen={() => openLine(line)}
      onFavorite={() => toggleLine(line.id)}
    />
  );

  let body: ReactNode;
  if (lines === null || hits === null && searching) {
    body = <Txt v="meta" color="muted" style={{ margin: space[8] }}>{TL.noDataYet}</Txt>;
  } else if (searching) {
    const hitLines = filterLines(searchLines, filter);
    const hitEvents = kind === 'all' ? filterEvents(searchEvents, era, onlyFav, favEventSet) : [];
    const eventsShown = expanded.events ? hitEvents : hitEvents.slice(0, SHOWN);
    body = (
      <>
        <Section title={TL.linesHeading} meta={String(hitLines.length)} />
        {hitLines.length > 0 ? hitLines.map(renderLine) : <Hint text={TL.noLinesFor(query.trim())} />}
        {kind === 'all' && (
          <>
            <Section title={TL.eventsHeading} meta={String(hitEvents.length)} />
            {hitEvents.length > 0 ? (
              eventsShown.map((e) => (
                <EventHit
                  key={e.cite_id}
                  event={e}
                  lines={e.lines}
                  marked={favEventSet.has(e.cite_id)}
                  onOpen={() => setPreview(e.cite_id)}
                  onMark={() => toggleEvent(e.cite_id)}
                />
              ))
            ) : (
              <Hint text={TL.noEvents} />
            )}
            {hitEvents.length > SHOWN && !expanded.events && (
              <ShowAll n={hitEvents.length} onPress={() => setExpanded((x) => ({ ...x, events: true }))} />
            )}
          </>
        )}
      </>
    );
  } else {
    const favLines = filterLines(
      all.filter((l) => favorites.has(l.id)),
      { ...filter, onlyFavorites: false },
    );
    const favEventList = filterEvents(favEvents ?? [], era, false, new Set());
    const showFavs = favLineIds.length > 0 || favEventIds.length > 0;
    body = (
      <>
        {(showFavs || onlyFav) && (
          <>
            <Section title={TL.favSection} meta={String(favLines.length + favEventList.length)} />
            {showFavs && favLines.length + favEventList.length === 0 && <Hint text={TL.favHint} />}
            {favLines.map(renderLine)}
            {favEventList.map((e) => (
              <EventHit
                key={e.cite_id}
                event={e}
                lines={[]}
                marked
                onOpen={() => setPreview(e.cite_id)}
                onMark={() => toggleEvent(e.cite_id)}
              />
            ))}
          </>
        )}

        {kind === 'all' && era === null && !onlyFav && (
          <>
            <Section title={TL.overview} />
            <OverviewCard
              testID="tl-bible-card"
              glyph="∑"
              title={TL.bibleCard}
              sub={TL.bibleCardSub(summary?.total ?? 0, span ? spanText(span.from, span.to) : '')}
              onPress={() => router.push('/timeline/bible')}
            >
              {summary && <Density bins={summary.eras.map((e) => e.count)} height={10} color={st.ent} />}
            </OverviewCard>
            <OverviewCard
              testID="tl-parallel-card"
              glyph="≡"
              title={TL.parallelCard}
              sub={TL.parallelCardSub}
              onPress={() => router.push('/timeline/paralelo')}
            />
          </>
        )}

        {(['period', 'person', 'place'] as const).map((k) => {
          const list = filterLines(all, { ...filter, kind: k, onlyFavorites: onlyFav });
          if (list.length === 0) return null;
          const shown = expanded[k] ? list : list.slice(0, SHOWN);
          const heading = k === 'period' ? TL.periods : k === 'person' ? TL.persons : TL.places;
          return (
            <View key={k} style={{ gap: 0 }}>
              <Section title={heading} meta={String(list.length)} />
              {shown.map(renderLine)}
              {list.length > SHOWN && !expanded[k] && <ShowAll n={list.length} onPress={() => setExpanded((x) => ({ ...x, [k]: true }))} />}
            </View>
          );
        })}

        {filterLines(all, filter).length === 0 && (!onlyFav || favLines.length === 0) && (
          <Hint text={TL.noLines} />
        )}
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ gap: space[5], paddingHorizontal: space[8], paddingTop: space[5], paddingBottom: space[5], borderBottomWidth: 1, borderBottomColor: c.border }}>
        <SearchField testID="tl-search" value={query} onChangeText={setQuery} placeholder={TL.searchPlaceholder} />
        <LineFilterChips
          prefix="tl"
          kind={kind}
          onKind={setKind}
          eraId={eraId}
          onEra={setEraId}
          onlyFav={onlyFav}
          onOnlyFav={setOnlyFav}
        />
      </View>

      <ScrollView testID="tl-home" contentContainerStyle={{ paddingTop: space[4], paddingBottom: space[12], gap: space[2] }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: space[8] }}>
          <TimelineTranslationNote testID="tl-note" />
        </View>
        {body}
        <SourceFooter />
      </ScrollView>

      {preview && <EventPreview citeId={preview} onClose={() => setPreview(null)} />}
    </View>
  );
}

function Section({ title, meta }: { title: string; meta?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: space[8], paddingTop: space[6], paddingBottom: space[3] }}>
      <Txt v="eyebrow" color="muted">{title}</Txt>
      {meta !== undefined && <Txt v="meta" color="muted">{meta}</Txt>}
    </View>
  );
}

function Hint({ text }: { text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ marginHorizontal: space[8], marginVertical: space[3], padding: space[6], borderRadius: radius.card, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border }}>
      <Txt v="bodySm" color="muted" center>{text}</Txt>
    </View>
  );
}

function ShowAll({ n, onPress }: { n: number; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ alignSelf: 'flex-start', marginHorizontal: space[8], minHeight: 44, justifyContent: 'center' }}>
      <Txt v="button" tint={c.accent}>{TL.showAll(n)}</Txt>
    </Pressable>
  );
}

/** Cartão de visão geral (Bíblia inteira, Em paralelo), com ícone, título, resumo e um detalhe opcional. */
function OverviewCard({ testID, glyph, title, sub, onPress, children }: { testID: string; glyph: string; title: string; sub: string; onPress: () => void; children?: ReactNode }) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[5],
        marginHorizontal: space[4],
        marginBottom: space[4],
        padding: space[5],
        paddingRight: space[6],
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <KindMark glyph={glyph} />
      <View style={{ flex: 1, minWidth: 0, gap: space[2] }}>
        <Txt v="lensTitle" style={{ fontSize: 15.5, lineHeight: 20 }}>{title}</Txt>
        <Txt v="meta" color="muted">{sub}</Txt>
        {children}
      </View>
    </Pressable>
  );
}

/** Evento de uma busca ou de favoritos: ano, título, linhas em que aparece; estrela de marcador. */
function EventHit({
  event,
  lines,
  marked,
  onOpen,
  onMark,
}: {
  event: TimelineLineEvent;
  lines: readonly TimelineLineRef[];
  marked: boolean;
  onOpen: () => void;
  onMark: () => void;
}) {
  const { c, st } = useTheme();
  const title = useTimelineText(event.title);
  const lineNames = lines.slice(0, 3).map((l) => l.name);
  const trLine = useTimelineTexts(lineNames);
  const people = [...new Set(event.participants.map((p) => p.name).filter(Boolean))];
  const trPeople = useTimelineTexts(people);
  const where = lineNames.map(trLine).join(' · ') || people.map(trPeople).join(', ');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4], paddingLeft: space[8], paddingRight: space[2] }}>
      <Pressable
        testID={`tl-event-${event.cite_id}`}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${eventYear(event)}`}
        onPress={onOpen}
        style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space[4], minHeight: 48, opacity: pressed ? 0.7 : 1 })}
      >
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: marked ? c.accent : st.ent }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="bodySm" bold numberOfLines={2}>{title}</Txt>
          <Txt v="meta" color="muted" numberOfLines={1}>
            {[eventYear(event), where].filter(Boolean).join(' · ')}
          </Txt>
        </View>
      </Pressable>
      <StarButton on={marked} label={marked ? TL.unfavorite : TL.favoriteEvent(title)} onPress={onMark} testID={`tl-fav-event-${event.cite_id}`} />
    </View>
  );
}

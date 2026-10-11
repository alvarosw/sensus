// Miniatura do mapa no Histórico: os lugares da passagem em mapa real, não interativo. Tocar abre o mapa cheio.
import { Pressable, View } from 'react-native';
import { Card, CardTop, LinkButton, Txt, TypeMark, useTheme } from '@/design';
import { useStudy } from '@/state/study';
import { MapLegend } from './MapLegend';
import { SensusMap } from './SensusMap';
import { MAPS } from './strings';
import { bookRangeOf, useMarkers, usePlaceSites } from './usePlaceSites';
import type { VerseRange } from '@sensus/core';

export function openMapPanel(range: VerseRange, unit: VerseRange | null, initial: 'selection' | 'unit' | 'book' = 'selection'): void {
  useStudy.getState().pushPanel({
    kind: 'map',
    scope: {
      range: { start: range.start, end: range.end },
      unit: unit ? { start: unit.start, end: unit.end } : null,
      book: bookRangeOf(range.start),
      initial,
    },
  });
}

export function PassageMapCard({ range, unit }: { range: VerseRange; unit: VerseRange | null }) {
  const { c } = useTheme();
  const { sites, loading } = usePlaceSites(range);
  const markers = useMarkers(sites);
  if (!loading && sites.length === 0) return null;
  return (
    <Card testID="passage-map">
      <CardTop>
        <TypeMark kind="ent" label={MAPS.title} />
        <Txt v="meta" color="muted">{MAPS.passageTitle}</Txt>
        <Txt v="meta" color="muted" style={{ marginLeft: 'auto' }} testID="passage-map-count">{MAPS.placesCount(sites.length)}</Txt>
      </CardTop>
      <View style={{ height: 168, borderRadius: 10, overflow: 'hidden', backgroundColor: c.surfaceAlt }}>
        <SensusMap lite markers={markers} style={{ flex: 1 }} testID="passage-map-lite" />
        <Pressable
          testID="passage-map-open"
          accessibilityRole="button"
          accessibilityLabel={MAPS.openMap}
          onPress={() => openMapPanel(range, unit)}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
      </View>
      <MapLegend compact testID="passage-map-legend" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 }}>
        <LinkButton label={MAPS.openMap} onPress={() => openMapPanel(range, unit)} testID="passage-map-link" />
      </View>
    </Card>
  );
}

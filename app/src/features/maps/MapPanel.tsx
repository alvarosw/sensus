// Mapa em tela cheia (painel empilhado): lugares da seleção, da perícope ou do livro.
// Toque num marcador → cartão com identificação, coordenadas, "Abrir lugar" e as passagens.
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { confidenceLabel, shownEntityName, type Book, type PlaceSite } from '@sensus/core';
import { Empty, IconButton, LinkButton, Segmented, shadow, Skeleton, Txt, TypeMark, radius, useTheme } from '@/design';
import { useStudy, type MapScope } from '@/state/study';
import { useBooks } from '../common/hooks';
import { showInText } from '../common/actions';
import { RefChips } from '../common/PanelParts';
import { MapLegend } from './MapLegend';
import { SensusMap } from './SensusMap';
import { MAPS } from './strings';
import { useMarkers, usePlaceSites } from './usePlaceSites';
import { placeTitle, usePlaceTranslation } from './usePlaceName';

type Which = 'selection' | 'unit' | 'book';

export function formatCoords(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lon).toFixed(3)}° ${lon >= 0 ? 'L' : 'O'}`;
}

export function MapPanel({ scope }: { scope: MapScope }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const books = useBooks();
  const [which, setWhich] = useState<Which>(scope.initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const options = useMemo(
    () => [
      { key: 'selection' as const, label: MAPS.scopeSelection },
      ...(scope.unit ? [{ key: 'unit' as const, label: MAPS.scopeUnit }] : []),
      { key: 'book' as const, label: MAPS.scopeBook },
    ],
    [scope.unit],
  );
  const active: Which = options.some((o) => o.key === which) ? which : 'selection';
  const range = active === 'unit' && scope.unit ? scope.unit : active === 'book' ? scope.book : scope.range;
  const { sites, loading, error } = usePlaceSites(range);
  const markers = useMarkers(sites);
  const selected = sites.find((s) => s.id === selectedId) ?? null;

  // Trocar de escopo sem o lugar selecionado fecha o cartão.
  useEffect(() => {
    if (selectedId && !sites.some((s) => s.id === selectedId)) setSelectedId(null);
  }, [sites, selectedId]);

  return (
    <View testID="map-panel" style={{ flex: 1, backgroundColor: c.surface, paddingBottom: insets.bottom }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, gap: 10 }}>
        <Segmented options={options} value={active} onChange={(k) => setWhich(k)} testID="map-scope" />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <Txt v="meta" color="muted" testID="map-count">{loading ? MAPS.loading : MAPS.placesCount(sites.length)}</Txt>
          <MapLegend compact />
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {error ? <Empty text={MAPS.loadError} /> : null}
        {!loading && !error && sites.length === 0 ? <Empty text={MAPS.noPlaces} /> : null}
        {loading ? (
          <View style={{ padding: 16 }}><Skeleton height={220} /></View>
        ) : (
          <SensusMap
            markers={markers}
            selectedId={selectedId}
            onSelect={setSelectedId}
            controls
            style={{ flex: 1, borderTopWidth: 1, borderTopColor: c.border }}
            testID="map-full"
          />
        )}
        {selected ? (
          <PlaceCardSheet site={selected} books={books} onClose={() => setSelectedId(null)} />
        ) : sites.length > 0 ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 14, borderRadius: radius.card, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 9 }}>
            <Txt v="meta" color="muted" center>{MAPS.placeHint}</Txt>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Cartão do lugar selecionado, sobre o mapa. */
function PlaceCardSheet({ site, books, onClose }: { site: PlaceSite; books: readonly Book[]; onClose: () => void }) {
  const { c } = useTheme();
  const words = MAPS.bands;
  const name = site.candidates[0]?.name ?? site.name;
  // Nome pt da fonte vale como está (texto em português, sem tradução); sem ele, o nome da fonte pode ser traduzido.
  const ptName = shownEntityName(site, true);
  const translated = usePlaceTranslation(ptName.pt ? '' : site.name);
  const title = ptName.pt ? ptName.text : placeTitle(site.name, translated);
  const ident = `${name} · ${MAPS.confidence.toLowerCase()} ${confidenceLabel(site, words)}`;
  const vids = site.vids.slice(0, 60);
  const openPlace = () => useStudy.getState().pushPanel({ kind: 'entity', citeId: site.citeIds[0]! });
  return (
    <View
      testID="map-place-card"
      style={[{ position: 'absolute', left: 12, right: 12, bottom: 12, borderRadius: radius.card, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, padding: 14, gap: 8, maxHeight: '60%' }, shadow.pop]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TypeMark kind="ent" label={MAPS.place} />
        <View style={{ flex: 1 }} />
        <IconButton icon="close" label={MAPS.close} onPress={onClose} testID="map-place-close" />
      </View>
      <Txt v="sheetTitle" testID="map-place-name">{title}</Txt>
      <Txt v="mono" color="muted" testID="map-place-coords">{formatCoords(site.lat, site.lon)}</Txt>
      <Txt v="bodySm" testID="map-place-ident">{`${MAPS.identification}: ${ident}`}</Txt>
      {vids.length > 0 ? (
        <View style={{ gap: 4 }}>
          <Txt v="meta" color="muted">{`${MAPS.passages} (${site.vids.length})`}</Txt>
          <RefChips vids={vids} books={books as Book[]} onPress={(vid) => showInText(vid)} testIDPrefix="map-ref" />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 }}>
        <LinkButton label={MAPS.openPlace} onPress={openPlace} testID="map-open-place" />
      </View>
    </View>
  );
}


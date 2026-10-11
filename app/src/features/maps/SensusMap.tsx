// Mapa do Sensus: MapLibre com o estilo próprio (claro/escuro), marcadores por lugar e atribuição visível.
// `lite` = miniatura do Histórico: sem gestos, sem rótulos; só os marcadores e o enquadramento.
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type LngLatBounds,
} from '@maplibre/maplibre-react-native';
import { fontFamilies, radius, Txt, useTheme } from '@/design';
import { MAPS } from './strings';
import { sensusMapStyle } from './styles/sensus-map-style';
import { radiusOf, viewFor, type MapMarker } from './geometry';

export type { MapMarker } from './geometry';
export { radiusOf, viewFor } from './geometry';

interface Props {
  markers: MapMarker[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  lite?: boolean;
  /** Mostra o botão "Enquadrar" (só no mapa cheio). */
  controls?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const SensusMap = memo(function SensusMap({ markers, selectedId, onSelect, lite = false, controls = false, style, testID }: Props) {
  const { scheme, c, st } = useTheme();
  const style_ = useMemo(() => sensusMapStyle(scheme), [scheme]);
  const cameraRef = useRef<CameraRef>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const initial = useMemo(() => viewFor(markers), [markers]);

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: markers.map((m) => {
        const { r, op, hollow } = radiusOf(m.band);
        const sel = m.id === selectedId;
        return {
          type: 'Feature' as const,
          id: m.id,
          geometry: { type: 'Point' as const, coordinates: [m.lon, m.lat] },
          properties: { id: m.id, name: m.name, r, op, hollow: hollow ? 1 : 0, sel: sel ? 1 : 0 },
        };
      }),
    }),
    [markers, selectedId],
  );

  // Enquadra de novo quando o conjunto de lugares muda (outra passagem, outro escopo).
  const setKey = markers.map((m) => m.id).join('|');
  useEffect(() => {
    if (!ready) return;
    const v = viewFor(markers);
    if (v.bounds) cameraRef.current?.fitBounds(v.bounds, { padding: { top: 28, right: 28, bottom: 36, left: 28 }, duration: 350 });
    else cameraRef.current?.flyTo({ center: v.center, zoom: v.zoom, duration: 350 });
    // markers muda de identidade a cada render do pai; a chave é o conjunto de ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setKey, ready]);

  // Seleção: leva o marcador ao centro sem perder o zoom de quem já aproximou.
  const selected = markers.find((m) => m.id === selectedId) ?? null;
  useEffect(() => {
    if (!ready || !selected || lite) return;
    cameraRef.current?.flyTo({ center: [selected.lon, selected.lat], zoom: 7.5, duration: 300 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, ready]);

  const selectedColor = c.accent;
  const markerColor = st.ent;

  return (
    <View testID={testID} style={[{ flex: 1, minHeight: 60, backgroundColor: c.bg, borderRadius: lite ? radius.lg : 0, overflow: 'hidden' }, style]}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={style_}
        attribution={false}
        logo={false}
        compass={false}
        dragPan={!lite}
        touchZoom={!lite}
        doubleTapZoom={!lite}
        touchRotate={false}
        touchPitch={false}
        onDidFinishLoadingStyle={() => setReady(true)}
        onDidFailLoadingMap={() => setFailed(true)}
      >
        <Camera ref={cameraRef} initialViewState={initial.bounds ? { bounds: initial.bounds } : { center: initial.center, zoom: initial.zoom }} />
        <GeoJSONSource
          id="sensus-places"
          data={geojson}
          onPress={
            onSelect && !lite
              ? (e) => {
                  const id = (e.nativeEvent as { features?: Array<{ properties?: { id?: string } }> }).features?.[0]?.properties?.id;
                  if (id) onSelect(id);
                }
              : undefined
          }
        >
          <Layer
            id="sensus-place-circles"
            type="circle"
            paint={{
              'circle-radius': ['case', ['==', ['get', 'sel'], 1], ['+', ['get', 'r'], 2.5], ['get', 'r']],
              'circle-color': ['case', ['==', ['get', 'sel'], 1], selectedColor, ['==', ['get', 'hollow'], 1], c.surface, markerColor],
              'circle-opacity': ['get', 'op'],
              'circle-stroke-color': ['case', ['==', ['get', 'hollow'], 1], markerColor, c.surface],
              'circle-stroke-width': ['case', ['==', ['get', 'hollow'], 1], 2, 1.5],
            }}
          />
          {!lite ? (
            <Layer
              id="sensus-place-labels"
              type="symbol"
              layout={{
                'text-field': ['get', 'name'],
                'text-font': ['Noto Sans Bold'],
                'text-size': 12,
                'text-anchor': 'top',
                'text-offset': [0, 0.9],
                'text-max-width': 9,
                'text-optional': true,
              }}
              paint={{
                'text-color': ['case', ['==', ['get', 'sel'], 1], selectedColor, c.text],
                'text-halo-color': c.bg,
                'text-halo-width': 1.6,
              }}
            />
          ) : null}
        </GeoJSONSource>
      </Map>

      {failed ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: c.surfaceAlt }]} testID={testID ? `${testID}-error` : undefined}>
          <Txt v="bodySm" color="muted" center>{MAPS.loadError}</Txt>
        </View>
      ) : null}

      {!failed && !ready ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt }]} pointerEvents="none">
          <Txt v="meta" color="muted">{MAPS.loading}</Txt>
        </View>
      ) : null}

      {controls && ready ? (
        <Pressable
          testID={testID ? `${testID}-fit` : undefined}
          accessibilityRole="button"
          accessibilityLabel={MAPS.fit}
          hitSlop={8}
          onPress={() => {
            const v = viewFor(markers);
            if (v.bounds) cameraRef.current?.fitBounds(v.bounds, { padding: { top: 28, right: 28, bottom: 36, left: 28 }, duration: 350 });
            else cameraRef.current?.flyTo({ center: v.center, zoom: v.zoom, duration: 350 });
          }}
          style={{ position: 'absolute', top: 10, right: 10, height: 32, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, justifyContent: 'center' }}
        >
          <Txt v="button" color="text">{MAPS.fit}</Txt>
        </Pressable>
      ) : null}

      <View pointerEvents="none" style={{ position: 'absolute', left: 6, bottom: 4, paddingHorizontal: 5, paddingVertical: 1, borderRadius: radius.xs, backgroundColor: c.surface, opacity: 0.9 }}>
        <Txt style={{ fontFamily: fontFamilies.ui, fontSize: 9.5, lineHeight: 13, color: c.muted }} testID={testID ? `${testID}-attribution` : undefined}>
          {MAPS.attribution}
        </Txt>
      </View>
    </View>
  );
});

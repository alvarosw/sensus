// Versão web do mapa: o MapLibre é nativo (Android/iOS). Na web (pré-visualização do Expo) mostra um quadro
// com a atribuição; o restante da experiência (listas, legenda, cartões) funciona igual.
import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { fontFamilies, radius, Txt, useTheme } from '@/design';
import type { MapMarker } from './geometry';
import { MAPS } from './strings';

export type { MapMarker } from './geometry';
export { radiusOf, viewFor } from './geometry';

interface Props {
  markers: MapMarker[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  lite?: boolean;
  controls?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const SensusMap = memo(function SensusMap({ markers, lite = false, style, testID }: Props) {
  const { c } = useTheme();
  const names = markers.slice(0, 6).map((m) => m.name).join(', ');
  return (
    <View testID={testID} style={[{ flex: 1, minHeight: 60, backgroundColor: c.surfaceAlt, borderRadius: lite ? radius.lg : 0, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 14 }, style]}>
      <Txt v="meta" color="muted" center>{names ? `${MAPS.placesCount(markers.length)}: ${names}` : MAPS.noPlaces}</Txt>
      <Txt v="meta" color="muted" center style={{ marginTop: 4 }}>{'Mapa interativo disponível no aplicativo Android.'}</Txt>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', alignItems: 'flex-start', padding: 6 }]}>
        <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: radius.xs, backgroundColor: c.surface, opacity: 0.9 }}>
          <Txt style={{ fontFamily: fontFamilies.ui, fontSize: 9.5, lineHeight: 13, color: c.muted }}>{MAPS.attribution}</Txt>
        </View>
      </View>
    </View>
  );
});

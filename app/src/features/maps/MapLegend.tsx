// Legenda da confiança da identificação: a cor é a do tipo "lugar"; tamanho e opacidade mostram a faixa.
import { View } from 'react-native';
import type { ConfidenceBand } from '@sensus/core';
import { Txt, useTheme } from '@/design';
import { radiusOf } from './geometry';
import { MAPS } from './strings';

const BANDS: ConfidenceBand[] = ['high', 'mid', 'low', 'none'];

export function MapLegend({ compact = false, testID = 'map-legend' }: { compact?: boolean; testID?: string }) {
  return (
    <View testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: compact ? 8 : 12, rowGap: 6 }}>
      {BANDS.map((b) => (
        <View key={b} testID={`${testID}-${b}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <LegendDot band={b} />
          <Txt v="meta" color="muted" style={{ fontSize: compact ? 10.5 : 11.5 }}>
            {compact ? MAPS.bands[b] : `${MAPS.bands[b]} (${MAPS.bandRange[b]})`}
          </Txt>
        </View>
      ))}
    </View>
  );
}

export function LegendDot({ band }: { band: ConfidenceBand }) {
  const { c, st } = useTheme();
  const { r, op, hollow } = radiusOf(band);
  const d = r * 2;
  return (
    <View
      style={{
        width: d,
        height: d,
        borderRadius: r,
        backgroundColor: hollow ? c.surface : st.ent,
        opacity: op,
        borderWidth: hollow ? 2 : 0,
        borderColor: st.ent,
      }}
    />
  );
}

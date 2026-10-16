// Bíblia inteira: um cartão por era, com intervalo, contagem e histograma de densidade. O período
// intertestamentário aparece como lacuna tracejada (a fonte não tem eventos ali).
import { ScrollView, View } from 'react-native';
import type { TimelineEraSummary } from '@sensus/core';
import { Txt, radius, space, useTheme } from '@/design';
import { spanText } from './model';
import { TL } from './strings';
import { useTimelineSummary } from './useTimeline';
import { Density, SourceFooter, TimelineGate } from './parts';

export function BibleView() {
  const { c, st } = useTheme();
  const summary = useTimelineSummary();
  return (
    <TimelineGate>
      <ScrollView testID="tl-bible" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: space[12] }}>
        {summary === null && <Txt v="meta" color="muted" style={{ margin: space[4] }}>{TL.noDataYet}</Txt>}
        {summary?.eras.map((era) => (era.gap ? <GapCard key={era.id} era={era} /> : <EraCard key={era.id} era={era} color={st.ent} />))}
        {summary && (
          <Txt v="meta" color="muted" style={{ marginHorizontal: space[4] }}>{TL.sourceTotal(summary.total)}</Txt>
        )}
        <SourceFooter text={`${TL.bibleFoot} ${TL.footer}`} />
      </ScrollView>
    </TimelineGate>
  );
}

function EraCard({ era, color }: { era: TimelineEraSummary; color: string }) {
  const { c } = useTheme();
  return (
    <View
      testID={`tl-era-card-${era.id}`}
      style={{ gap: space[3], padding: space[6], borderRadius: radius.card, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[4] }}>
        <Txt v="lensTitle" style={{ flex: 1, minWidth: 0, fontSize: 16, lineHeight: 20 }}>{era.name}</Txt>
        <Txt v="meta" color="muted">{TL.eraEvents(era.count)}</Txt>
      </View>
      <Txt v="mono" color="muted" style={{ fontSize: 11 }}>{spanText(era.from, era.to)}</Txt>
      <Density bins={era.density} height={18} color={color} />
    </View>
  );
}

function GapCard({ era }: { era: TimelineEraSummary }) {
  const { c } = useTheme();
  return (
    <View
      testID={`tl-era-gap-${era.id}`}
      style={{ gap: space[2], padding: space[6], borderRadius: radius.card, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border }}
    >
      <Txt v="lensTitle" tint={c.muted} style={{ fontSize: 15, lineHeight: 20 }}>{TL.gapTitle}</Txt>
      <Txt v="mono" color="muted" style={{ fontSize: 11 }}>{spanText(era.from, era.to)}</Txt>
      <Txt v="meta" color="muted">{TL.gapBody}</Txt>
    </View>
  );
}

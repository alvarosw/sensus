// Aviso único da linha do tempo numa tela: "Títulos traduzidos automaticamente · Ver original". Some quando a
// tradução não está configurada (o texto segue em inglês, como antes).
import { View } from 'react-native';
import { LinkButton, Txt } from '@/design';
import { useTimelineTranslation } from './timeline-translate';
import { TR } from './strings';

export function TimelineTranslationNote({ testID }: { testID?: string }) {
  const { active, showOriginal, toggle } = useTimelineTranslation();
  if (!active) return null;
  return (
    <View testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, paddingHorizontal: 4 }}>
      <Txt v="meta" color="muted" style={{ fontSize: 12, lineHeight: 17 }}>
        {showOriginal ? TR.timelineOriginalNote : TR.timelineNote}
      </Txt>
      <LinkButton testID={testID ? `${testID}-toggle` : undefined} label={showOriginal ? TR.timelineShowTranslation : TR.timelineShowOriginal} onPress={toggle} />
    </View>
  );
}

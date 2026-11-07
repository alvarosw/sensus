// Nota única da linha do tempo numa tela. Só aparece quando algum texto da tela foi de fato traduzido pelo modelo
// (aviso "Títulos traduzidos automaticamente", ou "Alguns…" quando há pt também). Só texto pt do banco: sem aviso de
// tradução, apenas um "Ver original" discreto. A decisão é a função pura timelineNoteKind (policy.ts); a tela passa
// as contagens dos textos que mostra (useTimelineNoteCounts).
import { View } from 'react-native';
import { LinkButton, Txt } from '@/design';
import { timelineNoteKind, type NoteCounts } from './policy';
import { useTimelineTranslation } from './timeline-translate';
import { TR } from './strings';

export function TimelineTranslationNote({ testID, counts }: { testID?: string; counts: NoteCounts }) {
  const { active, showOriginal, toggle, names } = useTimelineTranslation();
  const kind = timelineNoteKind({ active, showOriginal, ...counts });
  if (kind === 'none') return null;
  const text =
    kind === 'machine'
      ? TR.timelineNote
      : kind === 'partial'
        ? TR.timelinePartialNote
        : kind === 'original'
          ? TR.timelineOriginalNote(names?.from ?? '')
          : null;
  return (
    <View testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, paddingHorizontal: 4 }}>
      {text ? (
        <Txt v="meta" color="muted" style={{ fontSize: 12, lineHeight: 17 }}>
          {text}
        </Txt>
      ) : null}
      <LinkButton
        testID={testID ? `${testID}-toggle` : undefined}
        label={showOriginal ? TR.timelineShowTranslation : TR.timelineShowOriginal}
        onPress={toggle}
      />
    </View>
  );
}

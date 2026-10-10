import { Text, View } from 'react-native';
import type { CitedSegment } from '@sensus/core';
import { t } from '@/i18n';
import { Chip } from '@/ui/primitives';
import { Label } from '@/ui/text';
import { useTheme } from '@/ui/theme';
import { citeLabel } from './cite';
import { openSource } from './navigation';

/**
 * Renderiza a resposta da IA segmento a segmento:
 * - citações válidas viram chips tocáveis (abrem a fonte);
 * - citações inválidas e segmentos sem citação ficam sinalizados;
 * - segmentos de inferência ficam em destaque próprio.
 */
export function CitedText({
  segments,
  titleOf,
}: {
  segments: CitedSegment[];
  titleOf: (sourceId: string) => string | undefined;
}) {
  return (
    <View style={{ gap: 10 }}>
      {segments
        .filter((segment) => segment.text.trim().length > 0)
        .map((segment, index) => (
          <Segment key={index} segment={segment} titleOf={titleOf} />
        ))}
    </View>
  );
}

function Segment({
  segment,
  titleOf,
}: {
  segment: CitedSegment;
  titleOf: (sourceId: string) => string | undefined;
}) {
  const theme = useTheme();
  const inference = segment.kind === 'inference';
  const uncited = segment.kind === 'uncited';
  const hasChips = segment.cites.length > 0 || segment.invalidCites.length > 0 || uncited;

  return (
    <View
      style={{
        borderRadius: 10,
        padding: inference || uncited ? 10 : 0,
        gap: 6,
        backgroundColor: inference ? theme.inference : uncited ? theme.warn : 'transparent',
        borderLeftWidth: inference || uncited ? 3 : 0,
        borderLeftColor: inference ? theme.inferenceBorder : theme.warnText,
        borderStyle: uncited ? 'dashed' : 'solid',
      }}
    >
      {inference ? <Label>{t('study.inference')}</Label> : null}
      <Text
        style={{
          color: theme.text,
          fontSize: 15,
          lineHeight: 23,
          fontStyle: inference ? 'italic' : 'normal',
        }}
      >
        {segment.text.trim()}
      </Text>
      {hasChips ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {segment.cites.map((cite) => (
            <Chip
              key={cite}
              tone="source"
              label={citeLabel(cite, titleOf)}
              onPress={() => openSource(cite)}
            />
          ))}
          {segment.invalidCites.map((cite) => (
            <Chip key={`invalid-${cite}`} tone="danger" label={t('study.invalidCite')} />
          ))}
          {uncited ? <Chip tone="warn" label={t('study.uncited')} /> : null}
        </View>
      ) : null}
    </View>
  );
}

// Card de variante textual (proto: variantCard): leituras das edições-base lado a lado, com a palavra omitida.
import { View } from 'react-native';
import type { Book } from '@sensus/core';
import { Card, CardTop, EditionBadge, fontFamilies, LinkButton, space, Txt, TypeMark } from '@/design';
import { refShort } from '@/features/common/format';
import { STUDY } from '../strings';

// ---- variante -------------------------------------------------------------------------------------------

export function VariantCard({
  vid,
  readings,
  books,
  onAnalyze,
  onAsk,
}: {
  vid: number;
  readings: { editions: string[]; text: string }[];
  books: readonly Book[];
  onAnalyze: () => void;
  onAsk: () => void;
}) {
  return (
    <Card testID={`variant-${vid}`}>
      <CardTop>
        <TypeMark kind="tok" label={STUDY.variantType} />
        <Txt v="meta" color="muted">{refShort(vid, vid, books, true)}</Txt>
      </CardTop>
      <View style={{ gap: space[2] }}>
        {readings.map((r, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 3, minWidth: 98 }}>
              {r.editions.map((e) => (
                <EditionBadge key={e} edition={e} />
              ))}
            </View>
            {r.text ? (
              <Txt v="greek" style={{ fontSize: 17, flex: 1 }}>{r.text}</Txt>
            ) : (
              <Txt v="meta" color="muted" italic style={{ fontStyle: 'italic', fontFamily: fontFamilies.ui }}>{STUDY.omits}</Txt>
            )}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        <LinkButton label={STUDY.analyzeWord} onPress={onAnalyze} />
        <LinkButton label={STUDY.ask} onPress={onAsk} />
      </View>
    </Card>
  );
}

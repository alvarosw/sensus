// Linha discreta sob um texto em inglês: oferta da primeira vez, carregando, falha ou "Tradução automática · Ver original".
import { ActivityIndicator, View } from 'react-native';
import { LinkButton, Tag, Txt, useTheme } from '@/design';
import type { AutoTranslation } from './useAutoTranslate';
import { TR } from './strings';

export function AutoTranslateNote({ tr, testID }: { tr: AutoTranslation; testID?: string }) {
  const { c } = useTheme();

  if (tr.offer) {
    return (
      <View testID={testID ? `${testID}-offer` : undefined} style={{ gap: 2, paddingTop: 2 }}>
        <Txt v="meta" color="muted" style={{ fontSize: 12, lineHeight: 17 }}>
          {`${TR.offerQuestion} ${TR.offerHelp}`}
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 }}>
          <LinkButton testID={testID ? `${testID}-yes` : undefined} label={TR.offerYes} onPress={() => tr.answerOffer(true)} />
          <LinkButton testID={testID ? `${testID}-no` : undefined} label={TR.offerNo} onPress={() => tr.answerOffer(false)} tone="accent" />
        </View>
      </View>
    );
  }

  if (tr.loading) {
    return (
      <View testID={testID ? `${testID}-loading` : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2 }}>
        <ActivityIndicator size="small" color={c.muted} />
        <Txt v="meta" color="muted" style={{ fontSize: 12 }}>{TR.translating}</Txt>
      </View>
    );
  }

  if (tr.failed) {
    return (
      <View testID={testID ? `${testID}-failed` : undefined} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, paddingTop: 2 }}>
        <Txt v="meta" color="danger" style={{ fontSize: 12 }}>{TR.failed}</Txt>
        <LinkButton testID={testID ? `${testID}-retry` : undefined} label={TR.retry} onPress={tr.retry} />
      </View>
    );
  }

  if (!tr.available) return null;

  return (
    <View testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, paddingTop: 2 }}>
      {tr.translated ? <Tag label={TR.tag} /> : null}
      <LinkButton
        testID={testID ? `${testID}-toggle` : undefined}
        label={tr.showOriginal ? TR.showTranslation : TR.showOriginal}
        onPress={tr.toggleOriginal}
      />
    </View>
  );
}

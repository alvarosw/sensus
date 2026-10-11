// Sobre e licenças: versão, licença do app, atribuições e a lista completa de fontes (uma tela abaixo).
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Card, ListGroup, ListRow, Txt, useTheme } from '@/design';
import { useSources, licenseGroupOf } from '@/settings/use-sources';
import { SETTINGS_COPY as COPY } from '@/settings/strings';
import { MAP_ATTRIBUTIONS } from '@/features/maps/strings';

function Line({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 11, borderTopWidth: 1, borderTopColor: c.border }}>
      <Txt v="bodySm" color="muted">{label}</Txt>
      <Txt v="bodySm">{value}</Txt>
    </View>
  );
}

export default function AboutScreen() {
  const { c } = useTheme();
  const { sources, error } = useSources();
  const version = Constants.expoConfig?.version ?? '';
  const nonCommercial = (sources ?? []).filter((s) => licenseGroupOf(s.license) === 'nc');
  const count = sources?.length ?? 0;

  return (
    <ScrollView testID="settings-about" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 22 }} contentInsetAdjustmentBehavior="automatic">
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 11 }}>
          <Txt v="bodySm" color="muted">{COPY.version}</Txt>
          <Txt v="bodySm">{version}</Txt>
        </View>
        <Line label={COPY.appLicense} value="AGPL-3.0" />
      </Card>

      <View style={{ gap: 8 }}>
        <Txt v="eyebrow" color="muted" style={{ paddingLeft: 2 }}>{COPY.secAttribution}</Txt>
        <Card style={{ gap: 10 }}>
          <Txt v="bodySm" color="muted">{COPY.attributionHint}</Txt>
          {nonCommercial.map((s) => (
            <Txt key={s.id} v="bodySm" tint={c.warnText}>{COPY.nonCommercial(s.title)}</Txt>
          ))}
          {MAP_ATTRIBUTIONS.map((line) => (
            <Txt key={line} v="bodySm" color="muted" testID="about-map-attribution">{line}</Txt>
          ))}
          {error ? <Txt v="bodySm" tint={c.danger}>{COPY.noSources}</Txt> : null}
        </Card>
      </View>

      <ListGroup>
        <ListRow
          testID="settings-row-sources"
          first
          title={COPY.sourcesTitle}
          subtitle={sources === null ? COPY.sourcesLoading : COPY.sourcesCount(count)}
          onPress={() => router.push('/settings/sources')}
        />
      </ListGroup>
    </ScrollView>
  );
}

// Configurações (principal): três linhas. A do assistente vira alerta quando há limite, atenção ou falta método.
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { sourceAbbr } from '@sensus/core';
import { describePreference } from '@/settings/commentary-model';
import { ListGroup, ListRow, useTheme } from '@/design';
import { useSettings } from '@/settings/settings-context';
import { aiSummary } from '@/settings/ai-status';
import { useAiSnapshot } from '@/settings/use-ai-snapshot';
import { useAppPrefs } from '@/settings/app-prefs';
import { SETTINGS_COPY as COPY } from '@/settings/strings';
import { COMMENTARY_STRINGS } from '@/settings/commentary-strings';
import { useDataStore } from '@/data/data-store';
import { dataRowSubtitle } from '@/data/view';
import { DATA_COPY } from '@/data/strings';
import { appLangInfo } from '@sensus/core';
import { useLang } from '@/i18n';

export default function SettingsScreen() {
  const { c } = useTheme();
  const { loaded } = useSettings();
  const ai = aiSummary(useAiSnapshot());
  const lang = useLang();
  // Dentro da função: os textos mudam com o idioma (um const de módulo ficaria no idioma do primeiro acesso).
  const themeLabel = { system: COPY.themeSystem, light: COPY.themeLight, dark: COPY.themeDark } as const;
  const theme = useAppPrefs((s) => s.theme);
  const textSource = useAppPrefs((s) => s.textSource);
  const commentaryPrefs = useAppPrefs((s) => s.commentaryPrefs);
  const version = Constants.expoConfig?.version ?? '';
  const dataMachine = useDataStore((s) => s.machine);
  const dataEdition = useDataStore((s) => s.edition);
  const dataInstalled = useDataStore((s) => s.installed);
  const dataManifest = useDataStore((s) => s.manifest);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  return (
    <ScrollView testID="settings" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16 }} contentInsetAdjustmentBehavior="automatic">
      <ListGroup>
        <ListRow
          testID="settings-row-ai"
          first
          title={COPY.rowAi}
          subtitle={ai.subtitle}
          warn={ai.warn !== null}
          onPress={() => router.push('/settings/ai')}
        />
        <ListRow
          testID="settings-row-look"
          title={COPY.rowLook}
          subtitle={`${themeLabel[theme]} · texto ${sourceAbbr(textSource)}`}
          onPress={() => router.push('/settings/appearance')}
        />
        <ListRow
          testID="settings-row-commentaries"
          title={COMMENTARY_STRINGS.rowTitle}
          subtitle={describePreference(commentaryPrefs, lang)}
          onPress={() => router.push('/settings/commentaries')}
        />
        <ListRow
          testID="settings-row-language"
          title={COPY.rowLanguage}
          subtitle={appLangInfo(lang).endonym}
          onPress={() => router.push('/settings/language')}
        />
        <ListRow
          testID="settings-row-data"
          title={DATA_COPY.rowTitle}
          subtitle={dataRowSubtitle({
            machine: dataMachine,
            edition: dataEdition,
            installedVersion: dataInstalled?.dataVersion ?? null,
            downloadBytes: dataManifest?.full.size ?? null,
          })}
          onPress={() => router.push('/settings/data')}
        />
        <ListRow
          testID="settings-row-about"
          title={COPY.rowAbout}
          subtitle={`${COPY.version} ${version} · AGPL-3.0`}
          onPress={() => router.push('/settings/about')}
        />
      </ListGroup>
    </ScrollView>
  );
}

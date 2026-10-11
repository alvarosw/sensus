// Configurações (principal): três linhas. A do assistente vira alerta quando há limite, atenção ou falta método.
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { ListGroup, ListRow, useTheme } from '@/design';
import { useSettings } from '@/settings/settings-context';
import { aiSummary } from '@/settings/ai-status';
import { useAiSnapshot } from '@/settings/use-ai-snapshot';
import { useAppPrefs } from '@/settings/app-prefs';
import { SETTINGS_COPY as COPY } from '@/settings/strings';

const THEME_LABEL = { system: COPY.themeSystem, light: COPY.themeLight, dark: COPY.themeDark } as const;

export default function SettingsScreen() {
  const { c } = useTheme();
  const { loaded } = useSettings();
  const ai = aiSummary(useAiSnapshot());
  const theme = useAppPrefs((s) => s.theme);
  const textSource = useAppPrefs((s) => s.textSource);
  const version = Constants.expoConfig?.version ?? '';

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
          subtitle={`${THEME_LABEL[theme]} · texto ${textSource === 'kjv' ? 'KJV' : 'BLivre'}`}
          onPress={() => router.push('/settings/appearance')}
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

// Aparência e leitura: tema (sistema, claro, escuro) e padrões do leitor (texto BLivre/KJV e grego TR).
import { ScrollView, Switch, View } from 'react-native';
import { Card, Segmented, Txt, useTheme, type SchemePreference } from '@/design';
import { useAppPrefs, type TextSourceId } from '@/settings/app-prefs';
import { SETTINGS_COPY as COPY } from '@/settings/strings';
import { TranslateSettingsCard } from '@/translate/SettingsCard';
import { TR } from '@/translate/strings';

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Txt v="eyebrow" color="muted" style={{ paddingLeft: 2 }}>{label}</Txt>
      {children}
    </View>
  );
}

export default function AppearanceScreen() {
  const { c, preference, setPreference } = useTheme();
  const textSource = useAppPrefs((s) => s.textSource);
  const greekDefault = useAppPrefs((s) => s.greekDefault);
  const setTheme = useAppPrefs((s) => s.setTheme);
  const setTextSource = useAppPrefs((s) => s.setTextSource);
  const setGreekDefault = useAppPrefs((s) => s.setGreekDefault);

  const chooseTheme = (p: SchemePreference) => {
    setPreference(p);
    setTheme(p);
  };

  return (
    <ScrollView testID="settings-look" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 22 }} contentInsetAdjustmentBehavior="automatic">
      <Section label={COPY.secTheme}>
        <Card style={{ gap: 10 }}>
          <Segmented<SchemePreference>
            testID="theme-pref"
            value={preference}
            onChange={chooseTheme}
            options={[
              { key: 'system', label: COPY.themeSystem },
              { key: 'light', label: COPY.themeLight },
              { key: 'dark', label: COPY.themeDark },
            ]}
          />
          <Txt v="bodySm" color="muted">{COPY.themeHelp}</Txt>
        </Card>
      </Section>

      <Section label={COPY.secReading}>
        <Card style={{ gap: 14 }}>
          <View style={{ gap: 8 }}>
            <Txt v="eyebrow" color="muted">{COPY.textDefault}</Txt>
            <Segmented<TextSourceId>
              testID="text-source"
              value={textSource}
              onChange={setTextSource}
              options={[
                { key: 'blivre', label: 'BLivre' },
                { key: 'kjv', label: 'KJV' },
              ]}
            />
            <Txt v="bodySm" color="muted">{COPY.textHelp}</Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt v="bodySm" bold>{COPY.greekTitle}</Txt>
              <Txt v="bodySm" color="muted">{COPY.greekHelp}</Txt>
            </View>
            <Switch
              testID="greek-default"
              value={greekDefault}
              onValueChange={setGreekDefault}
              trackColor={{ false: c.border, true: c.accent }}
              thumbColor={c.surface}
              accessibilityLabel={COPY.greekTitle}
            />
          </View>
        </Card>
      </Section>

      <Section label={TR.settingsSection}>
        <TranslateSettingsCard />
      </Section>
    </ScrollView>
  );
}

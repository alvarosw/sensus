// Assistente de IA: ChatGPT (principal), modo de resposta, chave de API (avançado) e privacidade.
import { ScrollView, View } from 'react-native';
import { Card, Txt, useTheme } from '@/design';
import { ChatGPTCard } from '@/settings/chatgpt-card';
import { ModeCard } from '@/settings/mode-card';
import { ApiKeySection } from '@/settings/api-key-section';
import { useSettings } from '@/settings/settings-context';
import { SETTINGS_COPY as COPY } from '@/settings/strings';

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Txt v="eyebrow" color="muted" style={{ paddingLeft: 2 }}>{label}</Txt>
      {children}
    </View>
  );
}

export default function AiSettingsScreen() {
  const { c } = useTheme();
  const { loaded } = useSettings();
  if (!loaded) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  return (
    <ScrollView
      testID="settings-ai"
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 16, gap: 22 }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Section label={COPY.secAccount}>
        <ChatGPTCard />
      </Section>
      <Section label={COPY.secMode}>
        <ModeCard />
      </Section>
      <Section label={COPY.secAdvanced}>
        <ApiKeySection />
      </Section>
      <Section label={COPY.secPrivacy}>
        <Card style={{ backgroundColor: c.surfaceAlt, borderColor: 'transparent', gap: 8 }}>
          <Txt v="bodySm">{COPY.privacyKeys}</Txt>
          <Txt v="bodySm">{COPY.privacyOutputs}</Txt>
        </Card>
      </Section>
    </ScrollView>
  );
}

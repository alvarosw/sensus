// Assistente de IA: o que ele faz e "Configurar agora" (abre Configurações > Assistente de IA) ou "Depois".
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Txt, useTheme } from '@/design';
import { FormButton } from '@/ui/Buttons';
import { DATA_COPY } from '@/data/strings';
import { ONBOARDING_COPY } from './strings';

export function StepAi({ onNext }: { onNext: () => void }) {
  const { c } = useTheme();
  return (
    <ScrollView testID="onb-ia" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Txt v="bookTitle">{ONBOARDING_COPY.aiTitle}</Txt>
      <Txt v="body" color="muted">{ONBOARDING_COPY.aiBody}</Txt>
      <FormButton testID="onb-ai-configure" label={ONBOARDING_COPY.aiConfigure} onPress={() => router.push('/settings/ai')} />
      <FormButton testID="onb-next" variant="secondary" label={DATA_COPY.later} onPress={onNext} />
    </ScrollView>
  );
}

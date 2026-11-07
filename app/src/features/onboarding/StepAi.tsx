// Assistente de IA: o que ele faz e "Configurar agora" (abre Configurações > Assistente de IA) ou "Depois".
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Txt, useTheme } from '@/design';
import { FormButton } from '@/ui/Buttons';
import { DATA_COPY } from '@/data/strings';
import { ONBOARDING_COPY } from './strings';

export function StepAi({ onNext }: { onNext: () => void }) {
  const { c } = useTheme();
  // Depois de abrir as Configurações da IA, a volta mostra "Continuar" (não "Depois").
  const [visited, setVisited] = useState(false);
  return (
    <ScrollView testID="onb-ia" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Txt v="bookTitle">{ONBOARDING_COPY.aiTitle}</Txt>
      <Txt v="body" color="muted">{ONBOARDING_COPY.aiBody}</Txt>
      <FormButton testID="onb-ai-configure" label={ONBOARDING_COPY.aiConfigure} onPress={() => {
          setVisited(true);
          router.push('/settings/ai');
        }}
      />
      <FormButton testID="onb-next" variant="secondary" label={visited ? ONBOARDING_COPY.continueLabel : DATA_COPY.later} onPress={onNext} />
    </ScrollView>
  );
}

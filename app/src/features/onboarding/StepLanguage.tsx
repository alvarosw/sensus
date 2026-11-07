// Idioma: os 14 endônimos; o atual marcado. Tocar aplica na hora (a raiz remonta; o passo continua no store).
import { ScrollView } from 'react-native';
import { APP_LANGS } from '@sensus/core';
import { Txt, useTheme, ListGroup, RadioOption } from '@/design';
import { FormButton } from '@/ui/Buttons';
import { useAppPrefs } from '@/settings/app-prefs';
import { useLang } from '@/i18n';
import { DATA_COPY } from '@/data/strings';
import { ONBOARDING_COPY } from './strings';

export function StepLanguage({ onNext }: { onNext: () => void }) {
  const { c } = useTheme();
  const lang = useLang();
  const setAppLang = useAppPrefs((s) => s.setAppLang);

  return (
    <ScrollView testID="onb-idioma" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Txt v="bookTitle">{ONBOARDING_COPY.langTitle}</Txt>
      <Txt v="bodySm" color="muted">{ONBOARDING_COPY.langHelp}</Txt>
      <ListGroup testID="onb-langs">
        {APP_LANGS.map((info, i) => (
          <RadioOption
            key={info.code}
            testID={`onb-lang-${info.code}`}
            first={i === 0}
            selected={info.code === lang}
            title={info.endonym}
            onPress={() => {
              if (info.code !== lang) setAppLang(info.code);
            }}
          />
        ))}
      </ListGroup>
      <FormButton testID="onb-next" label={DATA_COPY.continue} onPress={onNext} />
    </ScrollView>
  );
}

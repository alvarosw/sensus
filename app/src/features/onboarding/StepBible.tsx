// Bíblia: nenhuma vem com o app, então este passo pede pelo menos uma. A lista é a de Configurações > Bíblias
// (recomendadas do idioma do app e do inglês, as baixadas e, pelo botão, todas): baixar pelo ícone, tocar numa
// baixada para torná-la a principal. A primeira baixada vira a principal sozinha (app-prefs). Continuar só com uma.
// `required`: o passo aberto sozinho para quem já usava o app e está sem Bíblia (ver OnboardingGate).
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { Txt, useTheme } from '@/design';
import { FormButton } from '@/ui/Buttons';
import { useLang } from '@/i18n';
import { BiblePicker } from '@/data/bibles/BiblePicker';
import { useBibles } from '@/data/bibles/bibles-store';
import { useAppPrefs } from '@/settings/app-prefs';
import { DATA_COPY } from '@/data/strings';
import { ONBOARDING_COPY } from './strings';

export function StepBible({ onNext, required = false }: { onNext: () => void; required?: boolean }) {
  const { c } = useTheme();
  const lang = useLang();
  const catalog = useBibles((s) => s.catalog);
  const catalogError = useBibles((s) => s.catalogError);
  const checking = useBibles((s) => s.checking);
  const hasBible = useBibles((s) => s.installed.length > 0);
  const refreshCatalog = useBibles((s) => s.refreshCatalog);
  const principal = useAppPrefs((s) => s.textSource);
  const setTextSource = useAppPrefs((s) => s.setTextSource);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView testID="onb-biblia" style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Txt v="bookTitle">{required ? ONBOARDING_COPY.bibleRequiredTitle : ONBOARDING_COPY.bibleTitle}</Txt>
        <Txt v="bodySm" color="muted">{required ? ONBOARDING_COPY.bibleRequiredHelp : ONBOARDING_COPY.bibleHelp}</Txt>

        {!catalog && catalogError ? (
          <View style={{ gap: 10 }}>
            <Txt v="bodySm" tint={c.danger} testID="onb-biblia-offline">{ONBOARDING_COPY.bibleOffline}</Txt>
            <FormButton
              testID="onb-biblia-retry"
              variant="secondary"
              label={ONBOARDING_COPY.bibleRetry}
              disabled={checking}
              onPress={() => void refreshCatalog()}
            />
          </View>
        ) : null}

        <BiblePicker lang={lang} principal={principal} onSelect={setTextSource} />
      </ScrollView>

      {/* Fixo embaixo: a lista completa é longa, e o Continuar não pode sumir rolando. */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 8, borderTopWidth: 1, borderTopColor: c.border }}>
        {hasBible ? null : (
          <Txt v="meta" color="muted" style={{ textAlign: 'center' }} testID="onb-biblia-need">{ONBOARDING_COPY.bibleNeedOne}</Txt>
        )}
        <FormButton testID="onb-next" label={DATA_COPY.continue} disabled={!hasBible} onPress={onNext} />
      </View>
    </View>
  );
}
